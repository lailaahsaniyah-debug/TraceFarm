import { useEffect, useMemo, useState } from 'react'
import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js-legacy'

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

const API_URL = `${
  (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
}/verification`
const SOLANA_NETWORK = 'devnet'
const EXPLORER_URL = 'https://explorer.solana.com/tx/'

const styles = {
  page: { padding: '28px', color: '#1f2937' },
  heading: { marginBottom: '24px' },
  eyebrow: {
    color: '#16a34a',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    marginBottom: '8px',
  },
  title: { fontSize: '28px', fontWeight: '700', margin: '0 0 8px' },
  subtitle: { color: '#6b7280', margin: 0, fontSize: '14px' },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  stat: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px',
  },
  statLabel: { color: '#6b7280', fontSize: '13px', marginBottom: '8px' },
  statValue: { fontSize: '26px', fontWeight: '700' },
  panel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'space-between',
    padding: '18px',
    borderBottom: '1px solid #e5e7eb',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    minWidth: '180px',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
  th: {
    textAlign: 'left',
    padding: '14px 16px',
    background: '#f9fafb',
    color: '#6b7280',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
  },
  td: {
    padding: '15px 16px',
    borderTop: '1px solid #f3f4f6',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  button: {
    border: 'none',
    borderRadius: '7px',
    padding: '8px 11px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, .55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    padding: '24px',
    width: '100%',
    maxWidth: '460px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 50px rgba(0,0,0,.2)',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    margin: '16px 0 7px',
  },
  fullInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
  },
}

function mapProduct(item) {
  return {
    id: item.batch_id,
    productName: item.product_name,
    commodity: item.commodity,
    farmerName: item.farmer_name,
    quantity: item.quantity,
    harvestDate: item.harvest_date,
    location: item.location,
    status: item.status || 'Pending',
  }
}

function mapHistory(item) {
  return {
    auditId: item.audit_id,
    id: item.batch_id,
    productName: item.product_name || 'Product',
    previousStatus: item.previous_status,
    decision: item.decision,
    newStatus: item.new_status,
    verifiedBy: item.verified_by,
    verifiedAt: item.verified_at,
    note: item.note,
    solanaHash: item.solana_hash,
    solanaSignature: item.solana_signature,
    solanaWallet: item.solana_wallet,
    solanaNetwork: item.solana_network,
    solanaAnchoredAt: item.solana_anchored_at,
    solanaSlot: item.solana_slot,
    action: item.decision === 'Verified'
      ? 'Product approved'
      : 'Product rejected',
  }
}

function getStatusStyle(status) {
  const colors = {
    Verified: { color: '#15803d', background: '#dcfce7' },
    Pending: { color: '#b45309', background: '#fef3c7' },
    Rejected: { color: '#b91c1c', background: '#fee2e2' },
  }

  return colors[status] || colors.Pending
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }

  return data
}

function getPhantomProvider() {
  if (typeof window === 'undefined') return null

  const provider = window.phantom?.solana || window.solana

  if (!provider?.isPhantom) return null

  return provider
}

function getLatestAudit(records) {
  return [...records].sort(
    (a, b) => new Date(b.verifiedAt || 0) - new Date(a.verifiedAt || 0)
  )[0]
}

function Verification() {
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState('')
  const [verifier, setVerifier] = useState('TraceFarm Admin')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [walletAddress, setWalletAddress] = useState('')
  const [walletBusy, setWalletBusy] = useState(false)
  const [anchoringId, setAnchoringId] = useState('')
  const [anchorMessage, setAnchorMessage] = useState('')
  const [anchorError, setAnchorError] = useState('')
  const [pendingAnchor, setPendingAnchor] = useState(null)

  const connection = useMemo(
    () => new Connection(clusterApiUrl(SOLANA_NETWORK), 'confirmed'),
    []
  )

  async function loadVerificationData() {
    setLoading(true)
    setPageError('')

    try {
      const response = await fetch(API_URL)
      const data = await readResponse(response)

      setProducts((data.products || []).map(mapProduct))
      setHistory((data.history || []).map(mapHistory))
    } catch (error) {
      setPageError(
        `${error.message}. Make sure the TraceFarm backend is running.`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVerificationData()
  }, [])

  const counts = useMemo(() => ({
    total: products.length,
    pending: products.filter(
      (p) => (p.status || 'Pending') === 'Pending'
    ).length,
    verified: products.filter((p) => p.status === 'Verified').length,
    rejected: products.filter((p) => p.status === 'Rejected').length,
  }), [products])

  const filteredProducts = products.filter((product) => {
    const name = product.productName || ''
    const farmer = product.farmerName || ''
    const id = product.id || ''

    const matchesSearch = `${name} ${farmer} ${id}`
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesFilter =
      filter === 'All' || (product.status || 'Pending') === filter

    return matchesSearch && matchesFilter
  })

  async function connectWallet() {
    setWalletBusy(true)
    setAnchorError('')
    setAnchorMessage('')

    try {
      const provider = getPhantomProvider()

      if (!provider) {
        throw new Error(
          'Phantom tidak ditemukan. Install atau aktifkan ekstensi Phantom di browser.'
        )
      }

      const response = await provider.connect()
      const address = response.publicKey?.toString()

      if (!address) {
        throw new Error('Phantom tidak mengembalikan alamat wallet.')
      }

      setWalletAddress(address)
      setAnchorMessage('Phantom wallet berhasil terhubung.')
    } catch (error) {
      if (error.code === 4001) {
        setAnchorError('Koneksi wallet dibatalkan.')
      } else {
        setAnchorError(error.message || 'Gagal menghubungkan Phantom.')
      }
    } finally {
      setWalletBusy(false)
    }
  }

  async function disconnectWallet() {
    try {
      const provider = getPhantomProvider()
      if (provider) await provider.disconnect()
    } catch (error) {
      console.error('Wallet disconnect error:', error)
    }

    setWalletAddress('')
    setAnchorMessage('Wallet disconnected.')
  }

  async function confirmAnchorWithBackend(anchor) {
    const response = await fetch(
      `${API_URL}/${encodeURIComponent(anchor.batchId)}/anchor/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: anchor.auditId,
          signature: anchor.signature,
          wallet: anchor.wallet,
        }),
      }
    )

    const result = await readResponse(response)

    setPendingAnchor(null)
    setAnchorMessage(
      `Blockchain proof berhasil diverifikasi dan disimpan. Signature: ${anchor.signature}`
    )
    setAnchorError('')

    await loadVerificationData()

    return result
  }

  async function retryBackendConfirmation() {
    if (!pendingAnchor) return

    setAnchoringId(pendingAnchor.batchId)
    setAnchorError('')
    setAnchorMessage('Mencoba memverifikasi ulang transaksi...')

    try {
      await confirmAnchorWithBackend(pendingAnchor)
    } catch (error) {
      setAnchorError(
        `Backend belum berhasil menyimpan proof: ${error.message}`
      )
    } finally {
      setAnchoringId('')
    }
  }

  async function anchorProduct(product, audit) {
    if (!walletAddress) {
      setAnchorError('Hubungkan Phantom wallet terlebih dahulu.')
      return
    }

    if (!audit?.auditId) {
      setAnchorError('Audit ID tidak ditemukan untuk produk ini.')
      return
    }

    if (audit.solanaSignature) {
      setAnchorMessage('Audit ini sudah memiliki signature Solana.')
      return
    }

    const provider = getPhantomProvider()

    if (!provider) {
      setAnchorError('Phantom tidak ditemukan di browser.')
      return
    }

    let submittedAnchor = null

    setAnchoringId(product.id)
    setAnchorError('')
    setAnchorMessage('Menyiapkan transaksi audit...')

    try {
      const prepareResponse = await fetch(
        `${API_URL}/${encodeURIComponent(product.id)}/anchor/prepare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auditId: audit.auditId }),
        }
      )

      const prepared = await readResponse(prepareResponse)

      if (
        !prepared.hash ||
        !prepared.memo ||
        !prepared.memoProgramId ||
        prepared.network !== SOLANA_NETWORK
      ) {
        throw new Error('Respons persiapan transaksi tidak valid.')
      }

      const currentWallet = await provider.connect()
      const publicKey = currentWallet.publicKey

      if (!publicKey) {
        throw new Error('Public key Phantom tidak tersedia.')
      }

      const connectedAddress = publicKey.toBase58()
      setWalletAddress(connectedAddress)

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed')

      console.log('[ANCHOR DEBUG] Blockhash:', blockhash)
      console.log('[ANCHOR DEBUG] Last valid block height:', lastValidBlockHeight)
      console.log('[ANCHOR DEBUG] Current block height:', await connection.getBlockHeight('confirmed'))

      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey(prepared.memoProgramId),
        data: Buffer.from(prepared.memo, 'utf8'),
      })

      const transaction = new Transaction({
        feePayer: publicKey,
        recentBlockhash: blockhash,
      }).add(memoInstruction)

      // Minta Phantom menandatangani transaksi.
      setAnchorMessage('Menunggu tanda tangan transaksi dari Phantom...')

      const signedTransaction = await provider.signTransaction(transaction)

      console.log('[ANCHOR DEBUG] Signed blockhash:', signedTransaction.recentBlockhash)
      console.log('[ANCHOR DEBUG] Wallet:', provider.publicKey?.toBase58())

      // Kirim transaksi yang sudah ditandatangani ke Devnet.
      setAnchorMessage('Mengirim transaksi ke Solana Devnet...')

      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      )

      if (!signature) {
        throw new Error('Solana tidak mengembalikan transaction signature.')
      }

      submittedAnchor = {
        batchId: product.id,
        auditId: audit.auditId,
        signature,
        wallet: connectedAddress,
      }

      // Simpan signature secepatnya untuk pemulihan jika proses berikutnya gagal.
      setPendingAnchor(submittedAnchor)

      setAnchorMessage(
        `Transaksi terkirim. Signature: ${signature}. Menunggu konfirmasi jaringan...`
      )

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      )

      if (confirmation.value.err) {
        throw new Error(
          `Transaksi gagal di jaringan: ${JSON.stringify(confirmation.value.err)}`
        )
      }

      setAnchorMessage(
        'Transaksi terkonfirmasi. Backend sedang memeriksa bukti blockchain...'
      )

      await confirmAnchorWithBackend(submittedAnchor)
    } catch (error) {
      console.error('Solana anchoring error:', error)

      if (error.code === 4001) {
        setAnchorError('Transaksi dibatalkan melalui Phantom.')
      } else if (submittedAnchor) {
        setPendingAnchor(submittedAnchor)
        setAnchorError(
          `Signature sudah diperoleh, tetapi proses verifikasi belum selesai: ${error.message}. Gunakan Retry Backend Verification.`
        )
      } else {
        setAnchorError(error.message || 'Gagal melakukan anchoring.')
      }
    } finally {
      setAnchoringId('')
    }
  }

  function openDecision(product, selectedDecision) {
    setSelected(product)
    setDecision(selectedDecision)
    setNote('')
    setMessage('')
  }

  async function submitDecision(event) {
    event.preventDefault()

    if (!selected || !verifier.trim()) {
      setMessage('Please enter the verifier name.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(selected.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            verifier: verifier.trim(),
            note: note.trim(),
          }),
        }
      )

      await readResponse(response)

      setSelected(null)
      setMessage('')
      await loadVerificationData()
    } catch (error) {
      setMessage(error.message || 'Unable to save verification.')
    } finally {
      setSaving(false)
    }
  }

  function viewRecord(product) {
    const records = history.filter((item) => item.id === product.id)

    if (records.length === 0) {
      window.alert(
        `Status: ${product.status || 'Pending'}\nNo audit record found.`
      )
      return
    }

    const latest = getLatestAudit(records)

    window.alert(
      `PRODUCT: ${latest.productName}\n` +
      `BATCH ID: ${latest.id}\n\n` +
      `PREVIOUS STATUS: ${latest.previousStatus || 'Not recorded'}\n` +
      `NEW STATUS: ${latest.newStatus || latest.decision}\n` +
      `VERIFIER: ${latest.verifiedBy}\n` +
      `DATE: ${new Date(latest.verifiedAt).toLocaleString()}\n` +
      `AUDIT ID: ${latest.auditId || '-'}\n` +
      `NOTE: ${latest.note || '-'}\n` +
      `SOLANA NETWORK: ${latest.solanaNetwork || 'Not anchored'}\n` +
      `SOLANA SIGNATURE: ${latest.solanaSignature || '-'}\n\n` +
      `TOTAL AUDIT RECORDS: ${records.length}`
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.heading}>
        <div style={styles.eyebrow}>TRACEFARM MANAGEMENT</div>
        <h1 style={styles.title}>Product Verification</h1>
        <p style={styles.subtitle}>
          Review registered products and manage their verification status.
        </p>
      </div>

      <div style={{
        ...styles.panel,
        padding: '18px',
        marginBottom: '24px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <strong style={{ fontSize: '15px' }}>Solana Devnet Wallet</strong>
            <p style={{
              color: '#6b7280',
              fontSize: '12px',
              margin: '5px 0 0',
            }}>
              Connect Phantom to anchor verification audit hashes.
            </p>
          </div>

          {walletAddress ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '9px',
            }}>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '7px',
                padding: '8px 10px',
                fontSize: '12px',
                fontWeight: '700',
              }}>
                Connected: {walletAddress.slice(0, 5)}...{walletAddress.slice(-5)}
              </span>
              <button
                style={{
                  ...styles.button,
                  background: '#f3f4f6',
                  color: '#374151',
                  padding: '10px 13px',
                }}
                onClick={disconnectWallet}
                disabled={walletBusy || !!anchoringId}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              style={{
                ...styles.button,
                background: '#6d45d8',
                color: '#fff',
                padding: '11px 16px',
                opacity: walletBusy ? 0.7 : 1,
              }}
              onClick={connectWallet}
              disabled={walletBusy}
            >
              {walletBusy ? 'Connecting...' : 'Connect Phantom'}
            </button>
          )}
        </div>

        <div style={{
          marginTop: '12px',
          color: '#9ca3af',
          fontSize: '11px',
        }}>
          Network: Solana Devnet · No private key is sent to TraceFarm.
        </div>

        {anchorMessage && (
          <p style={{
            color: '#15803d',
            fontSize: '13px',
            margin: '12px 0 0',
            overflowWrap: 'anywhere',
          }}>
            {anchorMessage}
          </p>
        )}

        {anchorError && (
          <p style={{
            color: '#b91c1c',
            fontSize: '13px',
            margin: '12px 0 0',
            overflowWrap: 'anywhere',
          }}>
            {anchorError}
          </p>
        )}

        {pendingAnchor && (
          <div style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '8px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
          }}>
            <div style={{ fontSize: '12px', color: '#92400e' }}>
              Signature tersedia. Backend verification dapat dicoba kembali.
            </div>
            <div style={{
              fontSize: '11px',
              overflowWrap: 'anywhere',
              marginTop: '7px',
            }}>
              {pendingAnchor.signature}
            </div>
            <button
              style={{
                ...styles.button,
                marginTop: '10px',
                background: '#d97706',
                color: '#fff',
                padding: '9px 12px',
              }}
              onClick={retryBackendConfirmation}
              disabled={!!anchoringId}
            >
              {anchoringId ? 'Checking...' : 'Retry Backend Verification'}
            </button>
          </div>
        )}
      </div>

      <div style={styles.stats}>
        {[
          ['Total Products', counts.total, '#1f2937'],
          ['Pending Review', counts.pending, '#d97706'],
          ['Verified', counts.verified, '#16a34a'],
          ['Rejected', counts.rejected, '#dc2626'],
        ].map(([label, value, color]) => (
          <div key={label} style={styles.stat}>
            <div style={styles.statLabel}>{label}</div>
            <div style={{ ...styles.statValue, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Search product, farmer, or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            style={styles.input}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {pageError && (
          <div style={{ padding: '16px', color: '#b91c1c', fontSize: '13px' }}>
            {pageError}
            <button
              style={{ ...styles.button, marginLeft: '10px' }}
              onClick={loadVerificationData}
            >
              Retry
            </button>
          </div>
        )}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  'Batch ID',
                  'Product',
                  'Farmer',
                  'Commodity',
                  'Status',
                  'Actions',
                ].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ ...styles.td, textAlign: 'center' }}>
                    Loading products from PostgreSQL...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{ ...styles.td, textAlign: 'center', padding: '35px' }}
                  >
                    {pageError ? 'Unable to load products.' : 'No products found.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const status = product.status || 'Pending'
                  const statusStyle = getStatusStyle(status)
                  const records = history.filter(
                    (item) => item.id === product.id
                  )
                  const latestAudit = records.length
                    ? getLatestAudit(records)
                    : null
                  const alreadyAnchored = !!latestAudit?.solanaSignature
                  const canAnchor =
                    status === 'Verified' &&
                    latestAudit?.decision === 'Verified' &&
                    !!latestAudit?.auditId

                  return (
                    <tr key={product.id}>
                      <td style={styles.td}>
                        <strong>{product.id}</strong>
                      </td>
                      <td style={styles.td}>
                        <strong>{product.productName || '-'}</strong>
                      </td>
                      <td style={styles.td}>{product.farmerName || '-'}</td>
                      <td style={styles.td}>{product.commodity || '-'}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...statusStyle,
                            padding: '5px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                          }}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '7px' }}>
                            <button
                              style={{
                                ...styles.button,
                                color: '#fff',
                                background: '#16a34a',
                              }}
                              onClick={() => openDecision(product, 'Verified')}
                            >
                              Approve
                            </button>
                            <button
                              style={{
                                ...styles.button,
                                color: '#fff',
                                background: '#dc2626',
                              }}
                              onClick={() => openDecision(product, 'Rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '7px',
                          }}>
                            <button
                              style={{
                                ...styles.button,
                                background: '#f3f4f6',
                                color: '#374151',
                              }}
                              onClick={() => viewRecord(product)}
                            >
                              View Record
                            </button>

                            {canAnchor && (
                              alreadyAnchored ? (
                                <a
                                  href={`${EXPLORER_URL}${latestAudit.solanaSignature}?cluster=devnet`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    ...styles.button,
                                    display: 'inline-block',
                                    textDecoration: 'none',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                  }}
                                >
                                  View Solana Proof
                                </a>
                              ) : (
                                <button
                                  style={{
                                    ...styles.button,
                                    background: '#6d45d8',
                                    color: '#fff',
                                    opacity: anchoringId === product.id ? 0.65 : 1,
                                  }}
                                  onClick={() => anchorProduct(product, latestAudit)}
                                  disabled={
                                    !walletAddress ||
                                    !!anchoringId ||
                                    !!pendingAnchor
                                  }
                                  title={
                                    !walletAddress
                                      ? 'Connect Phantom first'
                                      : 'Anchor audit hash to Solana Devnet'
                                  }
                                >
                                  {anchoringId === product.id
                                    ? 'Anchoring...'
                                    : 'Anchor to Solana'}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...styles.panel, marginTop: '24px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 5px', fontSize: '17px' }}>
          Verification Audit Trail
        </h3>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px' }}>
          A chronological record of product verification decisions.
        </p>

        {loading ? (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>
            Loading audit history...
          </p>
        ) : history.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>
            No verification activity recorded yet.
          </p>
        ) : (
          history.map((record, index) => (
            <div
              key={record.auditId || `${record.id}-${record.verifiedAt}-${index}`}
              style={{
                padding: '14px 0',
                borderTop: '1px solid #f3f4f6',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div>
                <strong>{record.productName}</strong> ({record.id})
                <div style={{ color: '#6b7280', marginTop: '5px' }}>
                  By {record.verifiedBy || 'Unknown verifier'}
                </div>
                <div style={{ color: '#6b7280', marginTop: '4px' }}>
                  {record.note || 'No verification note provided.'}
                </div>
                <div style={{
                  color: '#9ca3af',
                  marginTop: '4px',
                  fontSize: '11px',
                }}>
                  Audit ID: {record.auditId || '-'}
                </div>

                {record.solanaSignature && (
                  <div style={{ marginTop: '9px' }}>
                    <div style={{
                      color: '#15803d',
                      fontWeight: '700',
                      fontSize: '12px',
                    }}>
                      Anchored on Solana {record.solanaNetwork || SOLANA_NETWORK}
                    </div>
                    <a
                      href={`${EXPLORER_URL}${record.solanaSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#6d45d8',
                        fontSize: '11px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      View transaction: {record.solanaSignature}
                    </a>
                    <div style={{
                      color: '#6b7280',
                      fontSize: '11px',
                      marginTop: '4px',
                    }}>
                      Hash: {record.solanaHash || '-'}
                    </div>
                    <div style={{
                      color: '#6b7280',
                      fontSize: '11px',
                      marginTop: '3px',
                    }}>
                      Wallet: {record.solanaWallet || '-'}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong
                  style={{
                    color: record.decision === 'Verified' ? '#15803d' : '#b91c1c',
                  }}
                >
                  {record.previousStatus || 'Previous status'} →{' '}
                  {record.newStatus || record.decision}
                </strong>
                <div style={{ color: '#6b7280', marginTop: '5px' }}>
                  {record.verifiedAt
                    ? new Date(record.verifiedAt).toLocaleString()
                    : 'Date unavailable'}
                </div>
                <div style={{
                  color: '#9ca3af',
                  marginTop: '4px',
                  fontSize: '11px',
                }}>
                  {record.action || 'Verification decision'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ margin: '0 0 8px', fontSize: '21px' }}>
              {decision === 'Verified' ? 'Approve Product' : 'Reject Product'}
            </h2>

            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>
              {selected.productName} — {selected.id}
            </p>

            <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
              Status change:{' '}
              <strong>{selected.status || 'Pending'} → {decision}</strong>
            </p>

            <form onSubmit={submitDecision}>
              <label style={styles.fieldLabel}>Verifier Name</label>
              <input
                style={styles.fullInput}
                value={verifier}
                onChange={(event) => setVerifier(event.target.value)}
                required
              />

              <label style={styles.fieldLabel}>Verification Note</label>
              <textarea
                style={{
                  ...styles.fullInput,
                  minHeight: '95px',
                  resize: 'vertical',
                }}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Enter inspection notes or reason for this decision..."
              />

              {message && (
                <p style={{ color: '#dc2626', fontSize: '13px' }}>
                  {message}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button
                  type="button"
                  style={{
                    ...styles.button,
                    background: '#f3f4f6',
                    color: '#374151',
                    padding: '11px 16px',
                  }}
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...styles.button,
                    flex: 1,
                    color: '#fff',
                    background: decision === 'Verified' ? '#16a34a' : '#dc2626',
                    padding: '11px 16px',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? 'Saving...'
                    : `Confirm ${decision === 'Verified' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Verification