const { Client } = require('pg');

const client = new Client({
  host: 'ep-frosty-resonance-a4u1ozvl-pooler.us-east-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_pzFO97fgbRXB',
  ssl: {
    rejectUnauthorized: false,
  },
  keepAlive: true,
  connectionTimeoutMillis: 10000,
});

console.log('Connecting...');
client.connect()
  .then(() => {
    console.log('✅ Connected successfully');
    return client.query('SELECT 1');
  })
  .then((res) => {
    console.log('✅ Query result:', res.rows);
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
