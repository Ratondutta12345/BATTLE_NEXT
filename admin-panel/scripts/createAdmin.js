const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const pool = require('../lib/db');
const { hashPassword } = require('../lib/passwords');
const { OWNER_EMAIL } = require('../lib/adminAuth');

async function createAdmin() {
  const username = String(process.env.ADMIN_SETUP_USERNAME || '').trim();
  const password = process.env.ADMIN_SETUP_PASSWORD || '';
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
    throw new Error('Set ADMIN_SETUP_USERNAME to 3-40 letters, numbers, dots, underscores, or hyphens.');
  }
  if (password.length < 10 || password.length > 200) {
    throw new Error('Set ADMIN_SETUP_PASSWORD to a value between 10 and 200 characters.');
  }
  if ((process.env.ADMIN_SESSION_SECRET || '').length < 32) {
    throw new Error('Set ADMIN_SESSION_SECRET to at least 32 characters before creating the admin account.');
  }

  const [existing] = await pool.query('SELECT id FROM admin_accounts WHERE id = 1');
  if (existing[0]) throw new Error('An admin account already exists; no changes were made.');
  await pool.query(
    'INSERT INTO admin_accounts (id, username, password_hash) VALUES (1, ?, ?)',
    [username, hashPassword(password)],
  );
  console.log(`Created the admin account for the code-defined owner email (${OWNER_EMAIL}).`);
}

createAdmin()
  .catch((error) => {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
