const Database = require('better-sqlite3');
const db = new Database(':memory:');
console.log('Database opened successfully!');
db.close();
