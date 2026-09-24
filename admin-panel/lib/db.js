const mysql = require('mysql2/promise');

const {
  DATABASE_HOST = process.env.MYSQLHOST || '127.0.0.1',
  DATABASE_PORT = process.env.MYSQLPORT || 3306,
  DATABASE_USER = process.env.MYSQLUSER || 'root',
  DATABASE_PASSWORD = process.env.MYSQLPASSWORD || '',
  DATABASE_NAME = process.env.MYSQLDATABASE || 'myapp_db',
} = process.env;

const pool = mysql.createPool({
  host: DATABASE_HOST,
  port: Number(DATABASE_PORT),
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,

  ssl: {
    minVersion: 'TLSv1.2',
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
