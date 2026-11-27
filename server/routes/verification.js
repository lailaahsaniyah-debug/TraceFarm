
import express from 'express'
import { randomUUID, createHash } from 'crypto'
import pool from '../db.js'
import {
  Connection,
  PublicKey,
  clusterApiUrl
} from '@solana/web3.js'

const router = express.Router()

// Solana Devnet only. Never use Mainnet for this project.
const SOLANA_NETWORK = 'devnet'
const SOLANA_RPC_URL = clusterApiUrl('devnet')
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

const solanaConnection = new Connection(
  SOLANA_RPC_URL,
  'confirmed'
)

// Decode Base58 without requiring another package.
function decodeBase58(value) {
  const alphabet =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

  let number = 0n

  for (const character of value) {
    const digit = alphabet.indexOf(character)

    if (digit === -1) {
      throw new Error('Invalid Base58 value.')
    }

    number = number * 58n + BigInt(digit)
  }

  const bytes = []

  while (number > 0n) {
    bytes.push(Number(number & 255n))
    number >>= 8n
  }

  bytes.reverse()

  const leadingZeros = value.match(/^1*/)?.[0].length || 0

  return Buffer.concat([
    Buffer.alloc(leadingZeros),
    Buffer.from(bytes)
  ])
}

// Build a consistent payload from database records.
function buildAuditPayload(record) {
  return {
    version: 1,
    audit: {
      audit_id: record.audit_id,
      batch_id: record.batch_id,
      previous_status: record.previous_status,
      new_status: record.new_status,
      decision: record.decision,
      verified_by: record.verified_by,
      verified_at:
        record.verified_at instanceof Date
          ? record.verified_at.toISOString()
          : String(record.verified_at),
      note: record.note || ''
    },
    product: {
      batch_id: record.batch_id,
      product_name: record.product_name,
      commodity: record.commodity,
      farmer_name: record.farmer_name,
      quantity: record.quantity,
      harvest_date:
        record.harvest_date == null
          ? null
          : String(record.harvest_date),
      location: record.location
    }
  }
}

function calculateAuditHash(record) {
  const payload = buildAuditPayload(record)

  return createHash('sha256')
    .update(JSON.stringify(payload), 'utf8')
    .digest('hex')
}

// Retrieve one audit record together with its product.
async function getAnchorRecord(batchId, auditId) {
  const result = await pool.query(
    `SELECT
       vh.id,
       vh.batch_id,
       vh.previous_status,
       vh.new_status,
       vh.decision,
       vh.verified_by,
       vh.verified_at,
       vh.note,
       vh.audit_id,
       vh.solana_hash,
       vh.solana_signature,
       vh.solana_wallet,
       vh.solana_network,
       vh.solana_anchored_at,
       vh.solana_slot,
       p.product_name,
       p.commodity,
       p.farmer_name,
       p.quantity,
       p.harvest_date::text AS harvest_date,
       p.location
     FROM verification_history vh
     INNER JOIN products p ON p.batch_id = vh.batch_id
     WHERE vh.batch_id = $1
       AND vh.audit_id = $2
     LIMIT 1`,
    [batchId, auditId]
  )

  return result.rows[0] || null
}

// Get all products and verification audit history.
router.get('/', async (req, res) => {
  try {
    const productsResult = await pool.query(`
      SELECT
        batch_id,
        product_name,
        commodity,
        farmer_name,
        quantity,
        harvest_date,
        location,
        status,
        created_at,
        updated_at
      FROM products
      ORDER BY created_at DESC
    `)

    const historyResult = await pool.query(`
      SELECT
        vh.id,
        vh.batch_id,
        p.product_name,
        vh.previous_status,
        vh.new_status,
        vh.decision,
        vh.verified_by,
        vh.verified_at,
        vh.note,
        vh.audit_id,
        vh.solana_hash,
        vh.solana_signature,
        vh.solana_wallet,
        vh.solana_network,
        vh.solana_anchored_at,
        vh.solana_slot
      FROM verification_history vh
      LEFT JOIN products p ON p.batch_id = vh.batch_id
      ORDER BY vh.verified_at DESC, vh.id DESC
    `)

    return res.json({
      success: true,
      products: productsResult.rows,
      history: historyResult.rows
    })
  } catch (error) {
    console.error('Get verification data error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification data.'
    })
  }
})

// Get one product and its audit history.
router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params

    const productResult = await pool.query(
      `SELECT * FROM products WHERE batch_id = $1`,
      [batchId]
    )

    if (productResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      })
    }

    const historyResult = await pool.query(
      `SELECT *
       FROM verification_history
       WHERE batch_id = $1
       ORDER BY verified_at DESC, id DESC`,
      [batchId]
    )

    return res.json({
      success: true,
      product: productResult.rows[0],
      history: historyResult.rows
    })
  } catch (error) {
    console.error('Get verification record error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification record.'
    })
  }
})

// Submit an approval or rejection.
// Only Pending products can receive a verification decision.
router.post('/:batchId', async (req, res) => {
  const { batchId } = req.params
  const { decision, verifier, note } = req.body

  if (!['Verified', 'Rejected'].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: 'Decision must be Verified or Rejected.'
    })
  }

  if (
    typeof verifier !== 'string' ||
    !verifier.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'Verifier name is required.'
    })
  }

  if (note != null && typeof note !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Verification note must be text.'
    })
  }

  let client

  try {
    client = await pool.connect()

    await client.query('BEGIN')

    // Lock the product row to prevent simultaneous decisions.
    const productResult = await client.query(
      `SELECT batch_id, product_name, status
       FROM products
       WHERE batch_id = $1
       FOR UPDATE`,
      [batchId]
    )

    if (productResult.rowCount === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      })
    }

    const product = productResult.rows[0]
    const previousStatus = product.status || 'Pending'

    // Reject any decision if the product is no longer Pending.
    if (String(previousStatus).trim().toLowerCase() !== 'pending') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        success: false,
        message: `This product has already been processed. Current status: ${previousStatus}. Verification decisions cannot be changed.`
      })
    }

    const verifiedAt = new Date()
    const auditId = `TF-AUD-${randomUUID()}`

    const updateResult = await client.query(
      `UPDATE products
       SET status = $1, updated_at = NOW()
       WHERE batch_id = $2
       RETURNING *`,
      [decision, batchId]
    )

    const historyResult = await client.query(
      `INSERT INTO verification_history (
        batch_id,
        previous_status,
        new_status,
        decision,
        verified_by,
        verified_at,
        note,
        audit_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        batchId,
        previousStatus,
        decision,
        decision,
        verifier.trim(),
        verifiedAt,
        note?.trim() || null,
        auditId
      ]
    )

    await client.query('COMMIT')

    return res.status(201).json({
      success: true,
      message: `Product ${decision === 'Verified' ? 'approved' : 'rejected'} successfully.`,
      product: updateResult.rows[0],
      record: {
        ...historyResult.rows[0],
        product_name: product.product_name
      }
    })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {})
    }

    console.error('Submit verification error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Unable to save verification decision.'
    })
  } finally {
    client?.release()
  }
})

// Prepare a verification audit for Solana Devnet.
router.post('/:batchId/anchor/prepare', async (req, res) => {
  try {
    const { batchId } = req.params
    const { auditId } = req.body

    if (!auditId || typeof auditId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Audit ID is required.'
      })
    }

    const record = await getAnchorRecord(batchId, auditId)

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Verification audit record not found.'
      })
    }

    if (
      record.new_status !== 'Verified' ||
      record.decision !== 'Verified'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Only approved verification records can be anchored.'
      })
    }

    if (record.solana_signature) {
      return res.status(409).json({
        success: false,
        message: 'This audit record is already anchored.',
        signature: record.solana_signature
      })
    }

    const hash = calculateAuditHash(record)

    const memo = `TRACEFARM:v1:${record.audit_id}:${hash}`

    return res.json({
      success: true,
      network: SOLANA_NETWORK,
      batchId,
      auditId: record.audit_id,
      hash,
      memo,
      memoProgramId: MEMO_PROGRAM_ID,
      message: 'Audit hash prepared for Solana Devnet.'
    })
  } catch (error) {
    console.error('Prepare Solana anchor error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Unable to prepare Solana verification.'
    })
  }
})

// Confirm and independently verify a Solana Devnet transaction.
router.post('/:batchId/anchor/confirm', async (req, res) => {
  try {
    const { batchId } = req.params
    const { auditId, signature, wallet } = req.body

    if (
      !auditId ||
      typeof auditId !== 'string' ||
      !signature ||
      typeof signature !== 'string' ||
      !wallet ||
      typeof wallet !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Audit ID, transaction signature and wallet are required.'
      })
    }

    // Validate wallet address.
    try {
      new PublicKey(wallet)
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid Solana wallet address.'
      })
    }

    // Validate transaction signature.
    let decodedSignature

    try {
      decodedSignature = decodeBase58(signature)
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction signature.'
      })
    }

    if (decodedSignature.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction signature length.'
      })
    }

    const record = await getAnchorRecord(batchId, auditId)

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Verification audit record not found.'
      })
    }

    if (
      record.new_status !== 'Verified' ||
      record.decision !== 'Verified'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Only approved verification records can be anchored.'
      })
    }

    // Idempotency: accept an already saved identical proof.
    if (record.solana_signature) {
      if (record.solana_signature === signature) {
        return res.json({
          success: true,
          message: 'This transaction has already been verified.',
          proof: {
            hash: record.solana_hash,
            signature: record.solana_signature,
            wallet: record.solana_wallet,
            network: record.solana_network,
            anchoredAt: record.solana_anchored_at,
            slot: record.solana_slot
          }
        })
      }

      return res.status(409).json({
        success: false,
        message: 'This audit record already has a different transaction.'
      })
    }

    // Recalculate the hash from trusted database data.
    const expectedHash = calculateAuditHash(record)
    const expectedMemo =
      `TRACEFARM:v1:${record.audit_id}:${expectedHash}`

    // Fetch the transaction directly from Solana Devnet.
    const transaction = await solanaConnection.getTransaction(
      signature,
      {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      }
    )

    if (!transaction) {
      return res.status(409).json({
        success: false,
        message: 'Transaction is not available on Devnet yet. Please retry shortly.'
      })
    }

    if (transaction.meta?.err) {
      return res.status(400).json({
        success: false,
        message: 'Solana transaction failed.'
      })
    }

    const message = transaction.transaction.message

    // Support both legacy and versioned transactions.
    const accountKeys =
      message.accountKeys || message.staticAccountKeys

    const instructions =
      message.instructions || message.compiledInstructions

    if (!accountKeys || !instructions || !message.header) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported Solana transaction format.'
      })
    }

    // Verify that the supplied wallet actually signed the transaction.
    const signerCount = message.header.numRequiredSignatures

    const signerAddresses = accountKeys
      .slice(0, signerCount)
      .map((key) => key.toBase58())

    if (!signerAddresses.includes(wallet)) {
      return res.status(400).json({
        success: false,
        message: 'The supplied wallet did not sign this transaction.'
      })
    }

    // Verify that the transaction contains the exact Memo Program message.
    const memoFound = instructions.some((instruction) => {
      const programId =
        accountKeys[instruction.programIdIndex]?.toBase58()

      if (programId !== MEMO_PROGRAM_ID) {
        return false
      }

      try {
        const memoText = decodeBase58(instruction.data).toString('utf8')
        return memoText === expectedMemo
      } catch {
        return false
      }
    })

    if (!memoFound) {
      return res.status(400).json({
        success: false,
        message: 'Transaction does not contain the expected TraceFarm audit hash.'
      })
    }

    // Ensure the requested signature belongs to this transaction.
    if (!transaction.transaction.signatures.includes(signature)) {
      return res.status(400).json({
        success: false,
        message: 'Transaction signature mismatch.'
      })
    }

    // Save proof only after all checks pass.
    const updateResult = await pool.query(
      `UPDATE verification_history
       SET
         solana_hash = $1,
         solana_signature = $2,
         solana_wallet = $3,
         solana_network = $4,
         solana_anchored_at = NOW(),
         solana_slot = $5
       WHERE batch_id = $6
         AND audit_id = $7
         AND solana_signature IS NULL
       RETURNING
         audit_id,
         solana_hash,
         solana_signature,
         solana_wallet,
         solana_network,
         solana_anchored_at,
         solana_slot`,
      [
        expectedHash,
        signature,
        wallet,
        SOLANA_NETWORK,
        transaction.slot,
        batchId,
        auditId
      ]
    )

    if (updateResult.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'The audit record was already anchored or changed. Reload the record.'
      })
    }

    return res.json({
      success: true,
      message: 'Solana Devnet proof successfully verified and saved.',
      proof: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Confirm Solana anchor error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Unable to verify Solana Devnet transaction.'
    })
  }
})

export default router
