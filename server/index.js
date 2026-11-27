
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db.js'

import productsRouter from './routes/products.js'
import trackingRouter from './routes/tracking.js'
import verificationRouter from './routes/verification.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// API home
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TraceFarm API is running!'
  })
})

// Database health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `)

    res.json({
      success: true,
      message: 'TraceFarm API connected to PostgreSQL!',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Database health check failed:', error.message)

    res.status(500).json({
      success: false,
      message: 'Database connection failed'
    })
  }
})

// API routes
app.use('/api/products', productsRouter)
app.use('/api/tracking', trackingRouter)
app.use('/api/verification', verificationRouter)

// Start server
app.listen(PORT, () => {
  console.log(`TraceFarm API running at http://localhost:${PORT}`)
})
