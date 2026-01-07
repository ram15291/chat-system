const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'chatdb',
  user: 'chatuser',
  password: 'chatpass',
});

console.log('Attempting to connect WITH password...');

(async () => {
  try {
    await client.connect();
    console.log('✅ Connected successfully');

    const res = await client.query(
      'SELECT current_database(), current_user'
    );

    console.log('Database:', res.rows[0].current_database);
    console.log('User:', res.rows[0].current_user);

    await client.end();
    console.log('✅ Connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
})();
