require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM migrations WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`Skipped: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      console.log(`Applied: ${file}`);
    }
    console.log('Migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
