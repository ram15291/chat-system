const { Client } = require('pg');

const connectionString = 'postgresql://chatuser:chatpass@127.0.0.1:5432/chatdb';

console.log('Testing connection to:', connectionString.replace('chatpass', '****'));

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 5000,
});

client.connect()
  .then(() => {
    console.log('✅ Connected successfully!');
    return client.query('SELECT current_database() as db, current_user as user, version()');
  })
  .then(res => {
    console.log('Database:', res.rows[0].db);
    console.log('User:', res.rows[0].user);
    console.log('Version:', res.rows[0].version.substring(0, 50) + '...');
    return client.end();
  })
  .then(() => {
    console.log('✅ Connection closed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
    process.exit(1);
  });
