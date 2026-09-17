const mysql = require('mysql2/promise');

const {
  DATABASE_HOST = '127.0.0.1',
  DATABASE_PORT = 3306,
  DATABASE_USER = 'root',
  DATABASE_PASSWORD = '',
  DATABASE_NAME = 'myapp_db',
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