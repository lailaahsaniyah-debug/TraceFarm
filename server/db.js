
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool, types } = pg

// PostgreSQL DATE tetap berupa string.
types.setTypeParser(1082, (value) => value)

// Gunakan Neon jika DATABASE_URL tersedia.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'tracefarm_db',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }

const pool = new Pool(poolConfig)

pool.on('error', (error) => {
  console.error('Unexpected database error:', error)
})

export default pool
