
import express from 'express'
import pool from '../db.js'

const router = express.Router()

// GET /api/products - Ambil semua produk
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products ORDER BY created_at DESC'
    )

    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    })
  } catch (error) {
    console.error('Get products error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
    })
  }
})

// GET /api/products/:batchId - Ambil satu produk
router.get('/:batchId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE batch_id = $1',
      [req.params.batchId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    return res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Get product error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
    })
  }
})

// POST /api/products - Tambah produk
router.post('/', async (req, res) => {
  const {
    batch_id,
    batchId,
    product_name,
    productName,
    commodity,
    farmer_name,
    farmerName,
    quantity,
    harvest_date,
    harvestDate,
    location,
  } = req.body

  const id = batch_id || batchId
  const name = product_name || productName
  const farmer = farmer_name || farmerName
  const date = harvest_date || harvestDate || null

  if (!id || !name) {
    return res.status(400).json({
      success: false,
      message: 'batch_id and product_name are required',
    })
  }

  try {
    const result = await pool.query(
      `INSERT INTO products
        (batch_id, product_name, commodity, farmer_name,
         quantity, harvest_date, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        name,
        commodity || null,
        farmer || null,
        quantity == null ? null : String(quantity),
        date,
        location || null,
        'Pending',
      ]
    )

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Create product error:', error.message)

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Batch ID already exists',
      })
    }

    if (error.code === '22007' || error.code === '22008') {
      return res.status(400).json({
        success: false,
        message: 'Invalid harvest date',
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
    })
  }
})

// PUT /api/products/:batchId - Edit produk
// Produk Verified tidak boleh diedit.
router.put('/:batchId', async (req, res) => {
  const {
    product_name,
    productName,
    commodity,
    farmer_name,
    farmerName,
    quantity,
    harvest_date,
    harvestDate,
    location,
  } = req.body

  const name = product_name ?? productName ?? null
  const farmer = farmer_name ?? farmerName ?? null

  const hasHarvestDate =
    Object.prototype.hasOwnProperty.call(req.body, 'harvest_date') ||
    Object.prototype.hasOwnProperty.call(req.body, 'harvestDate')

  const rawDate = Object.prototype.hasOwnProperty.call(req.body, 'harvest_date')
    ? harvest_date
    : harvestDate

  const date =
    rawDate === '' || rawDate === undefined ? null : rawDate

  if (
    date !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(String(date))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Harvest date must use YYYY-MM-DD format.',
    })
  }

  try {
    const result = await pool.query(
      `UPDATE products SET
        product_name = COALESCE($2, product_name),
        commodity = COALESCE($3, commodity),
        farmer_name = COALESCE($4, farmer_name),
        quantity = COALESCE($5, quantity),
        harvest_date = CASE
          WHEN $6::boolean THEN $7::date
          ELSE harvest_date
        END,
        location = COALESCE($8, location),
        updated_at = NOW()
       WHERE batch_id = $1
         AND LOWER(COALESCE(status, '')) <> 'verified'
       RETURNING *`,
      [
        req.params.batchId,
        name,
        commodity ?? null,
        farmer,
        quantity == null ? null : String(quantity),
        hasHarvestDate,
        date,
        location ?? null,
      ]
    )

    if (result.rowCount === 0) {
      const existing = await pool.query(
        'SELECT status FROM products WHERE batch_id = $1',
        [req.params.batchId]
      )

      if (existing.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        })
      }

      if (String(existing.rows[0].status).toLowerCase() === 'verified') {
        return res.status(409).json({
          success: false,
          message: 'Verified products cannot be edited.',
        })
      }

      return res.status(409).json({
        success: false,
        message: 'Product could not be updated.',
      })
    }

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Update product error:', error.message)

    if (error.code === '22007' || error.code === '22008') {
      return res.status(400).json({
        success: false,
        message: 'Invalid harvest date.',
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update product.',
    })
  }
})

// DELETE /api/products/:batchId - Hapus produk
// Produk Verified atau produk yang memiliki riwayat tidak boleh dihapus.
router.delete('/:batchId', async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Kunci produk agar tidak berubah selama pemeriksaan dan penghapusan.
    const productResult = await client.query(
      `SELECT status
       FROM products
       WHERE batch_id = $1
       FOR UPDATE`,
      [req.params.batchId]
    )

    if (productResult.rowCount === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        success: false,
        message: 'Product not found',
      })
    }

    const productStatus = String(
      productResult.rows[0].status || ''
    ).toLowerCase()

    if (productStatus === 'verified') {
      await client.query('ROLLBACK')

      return res.status(409).json({
        success: false,
        message: 'Verified products cannot be deleted.',
      })
    }

    const historyResult = await client.query(
      `SELECT
        EXISTS (
          SELECT 1 FROM tracking_events WHERE batch_id = $1
        ) AS has_tracking,
        EXISTS (
          SELECT 1 FROM verification_history WHERE batch_id = $1
        ) AS has_verification`,
      [req.params.batchId]
    )

    const hasTracking = historyResult.rows[0].has_tracking
    const hasVerification = historyResult.rows[0].has_verification

    if (hasTracking || hasVerification) {
      await client.query('ROLLBACK')

      return res.status(409).json({
        success: false,
        message: 'Products with tracking events or verification history cannot be deleted. Their traceability records must be preserved.',
      })
    }

    const deleteResult = await client.query(
      `DELETE FROM products
       WHERE batch_id = $1
       RETURNING *`,
      [req.params.batchId]
    )

    await client.query('COMMIT')

    return res.json({
      success: true,
      message: 'Product deleted successfully',
      data: deleteResult.rows[0],
    })
  } catch (error) {
    await client.query('ROLLBACK')

    console.error('Delete product error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
    })
  } finally {
    client.release()
  }
})

// Export router
export default router
