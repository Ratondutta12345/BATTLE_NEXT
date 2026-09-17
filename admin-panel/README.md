# MyApp Admin Panel (Node.js)

Node.js and Express admin backend connected to MySQL, with a web UI for managing registered users.

## Quick start

1. Make sure MySQL is running, then copy `.env.local.example` to `.env.local` and set the MySQL connection values:

```env
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your-password
DATABASE_NAME=myapp_db
PAYMENT_UPI_ID=your-upi-id@bank
PAYMENT_PAYEE_NAME=BATTLE-NEXT
```

The payment values let the mobile app generate a real UPI QR code. Users submit a payment request after scanning it; open the admin panel's **Money** page and accept a pending request to credit the user's wallet.

2. Create the application database and users table:

```bash
mysql -u root -p < schema.sql
```

3. Install dependencies and start the panel:

```bash
cd admin-panel
npm install
npm start
```

4. For automatic restart during development:

```bash
npm run dev
```

The admin panel runs on http://localhost:3001.

## Features

- **Users section** — lists all registered users from MySQL with:
  - Full Name
  - Mobile No.
  - Email
  - Username
  - Registration date
- Search/filter users in the admin UI
- `POST /api/users` — mobile app sign-up saves users to the database
- `GET /api/users` — returns all users for the admin panel
- `GET /api/health` — checks MySQL connectivity
