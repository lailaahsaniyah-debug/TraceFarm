
import express from 'express'
import pool from '../db.js'

const router = express.Router()

// Get tracking history for a product
router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params

    const result = await pool.query(
      `SELECT
        id,
        batch_id,
        stage,
        status,
        location,
        event_date,
        description,
        created_at
       FROM tracking_events
       WHERE batch_id = $1
       ORDER BY event_date ASC, created_at ASC, id ASC`,
      [batchId]
    )

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    })
  } catch (error) {
    console.error('Get tracking error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracking history'
    })
  }
})

// Add a tracking event
router.post('/:batchId', async (req, res) => {
  const { batchId } = req.params
  const { stage, status, location, date, description } = req.body

  if (!stage || !date || !location?.trim() || !description?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please complete all tracking event fields.'
    })
  }

  try {
    const result = await pool.query(
      `INSERT INTO tracking_events
        (batch_id, stage, status, location, event_date, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        batchId,
        stage,
        status || 'Completed',
        location.trim(),
        date,
        description.trim()
      ]
    )

    res.status(201).json({
      success: true,
      message: 'Tracking event saved successfully.',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Add tracking event error:', error.message)

    if (error.code === '23503') {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      })
    }

    res.status(500).json({
      success: false,
      message: 'Unable to save tracking event.'
    })
  }
})

export default router
