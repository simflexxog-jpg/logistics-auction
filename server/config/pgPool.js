const { Pool } = require('pg');
require('dotenv').config();
const logger = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Postgres pool error');
});

module.exports = pool;
