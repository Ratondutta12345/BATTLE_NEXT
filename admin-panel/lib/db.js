const mysql = require('mysql2/promise');

const { DATABASE_URL } = process.env;
const {

  DATABASE_HOST = '127.0.0.1',

  DATABASE_PORT = 3306,

  DATABASE_USER = 'root',

  DATABASE_PASSWORD = '',

  DATABASE_NAME = 'myapp_db',

} = process.env;

const databaseConfig = DATABASE_URL
  ? (() => {
    const url = new URL(DATABASE_URL);
    if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must use the mysql:// protocol');
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  })()
  : {
    host: DATABASE_HOST,
    port: Number(DATABASE_PORT),
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    database: DATABASE_NAME,
  };

const pool = mysql.createPool({
  ...databaseConfig,
  waitForConnections: true,

  connectionLimit: 10,

  queueLimit: 0,

});

module.exports = pool;