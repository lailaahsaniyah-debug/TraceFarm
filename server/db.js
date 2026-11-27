
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool, types } = pg

// PostgreSQL DATE (OID 1082) dikembalikan sebagai string,
// bukan JavaScript Date yang bisa bergeser karena zona waktu.
types.setTypeParser(1082, (value) => value)

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'tracefarm_db',
})

pool.on('error', (error) => {
  console.error('Unexpected database error:', error)
})

export default pool

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool, types } = pg

// PostgreSQL DATE (OID 1082) dikembalikan sebagai string,
// bukan JavaScript Date yang bisa bergeser karena zona waktu.
types.setTypeParser(1082, (value) => value)

// Jika DATABASE_URL tersedia, gunakan database Neon.
// Jika tidak, gunakan konfigurasi PostgreSQL lokal.
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
