const { Pool } = require('pg');

// Enable SSL for any non-localhost DB (Supabase, Railway, Render, etc all require it).
const isLocal = process.env.DATABASE_URL
  ? /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL)
  : true;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'homeshare',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = { pool };
