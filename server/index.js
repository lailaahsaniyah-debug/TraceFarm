
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

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
  : null

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error('Origin not allowed by CORS'))
  },
}))

app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TraceFarm API is running!',
  })
})

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
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Database health check failed:', error.message)

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    })
  }
})

app.use('/api/products', productsRouter)
app.use('/api/tracking', trackingRouter)
app.use('/api/verification', verificationRouter)

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
  })
})

app.use((error, req, res, next) => {
  console.error('Server error:', error.message)

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
})

// Jalankan server lokal saja.
// Di Vercel, Express akan dipanggil sebagai Function.
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TraceFarm API running on port ${PORT}`)
  })
}

export default app
