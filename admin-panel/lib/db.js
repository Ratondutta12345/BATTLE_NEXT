const mysql = require('mysql2/promise');

const {
  MYSQLHOST,
  MYSQLPORT,
  MYSQLUSER,
  MYSQLPASSWORD,
  MYSQLDATABASE,
  DATABASE_HOST = '127.0.0.1',
  DATABASE_PORT = 3306,
  DATABASE_USER = 'root',
  DATABASE_PASSWORD = '',
  DATABASE_NAME = 'myapp_db',
} = process.env;

const pool = mysql.createPool({
  host: MYSQLHOST || DATABASE_HOST,
  port: Number(MYSQLPORT || DATABASE_PORT),
  user: MYSQLUSER || DATABASE_USER,
  password: MYSQLPASSWORD || DATABASE_PASSWORD,
  database: MYSQLDATABASE || DATABASE_NAME,

  ssl: {
    rejectUnauthorized: false,
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;