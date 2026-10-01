# MyApp Admin Panel (Node.js)

Node.js and Express admin backend connected to MySQL, with a web UI for managing registered users.

## Quick start

1. Make sure MySQL is running, then copy `.env.example` to `.env` and set the MySQL and ZapUPI merchant values. Keep `.env` on the backend only; never add it to the mobile app or commit it.

```env
PORT=3001
HOST=0.0.0.0
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your-local-mysql-password
DATABASE_NAME=myapp_db
# Alternatively, set DATABASE_URL=mysql://user:password@host:3306/database
ZAPUPI_USER_TOKEN=your-merchant-user-token
ZAPUPI_SECRET_KEY=your-webhook-hmac-secret
ZAPUPI_REDIRECT_URL=https://your-public-site.example/wallet
ADMIN_SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=BattleNext Admin <admin@example.com>
```

The admin panel creates its single admin account the first time it starts. Initial account setup uses the owner address hardcoded as `OWNER_EMAIL` in `lib/adminAuth.js` (initially `ratondutta444@gmail.com`) and does not send an email verification code. Change that source constant to the client's email before delivery; it is intentionally not editable in the panel. Create the first login from `http://localhost:3001` on the computer running the admin server; remote first-time setup is blocked. Configure SMTP and a random `ADMIN_SESSION_SECRET` of at least 32 characters for login and recovery. Signed-in credential changes require the current password. Owner-email codes are used to reset a forgotten password or remove the login. Admin passwords are stored as scrypt hashes, and protected panel requests use signed expiring sessions.

The backend creates ZapUPI orders and returns its hosted checkout URL. The mobile app renders that URL as a QR locally and opens the same checkout for UPI app selection. Wallet balances are credited only after the backend confirms the order through ZapUPI's Check Order Status API.

2. Set `ZAPUPI_REDIRECT_URL` to your deployed wallet/return page. ZapUPI's public documentation requires this URL to be HTTPS. A provider dashboard or merchant account is required for the real `user_token` and webhook secret; do not use real credentials in a frontend `.env` file.

3. In the ZapUPI Merchant Dashboard, register this webhook URL:

```text
https://YOUR_PUBLIC_API_HOST/api/wallet/zapupi-webhook
```

The webhook handler expects an `X-ZapUPI-Signature` or `X-ZapRupee-Signature` header containing the lowercase or uppercase hex HMAC-SHA256 of the exact raw request body, keyed with `ZAPUPI_SECRET_KEY`. ZapUPI's public API docs do not specify the webhook payload, signature header, or signing algorithm. Confirm that contract with ZapUPI support before enabling the webhook in production; the endpoint fails closed when the signature is absent/invalid and independently checks order status with ZapUPI before crediting. Three-second app polling uses the same server-side status reconciliation if the provider does not deliver a webhook.

4. Create the application database and users table:

```bash
mysql -u root -p < schema.sql
```

5. Install dependencies and start the panel:

```bash
cd admin-panel
npm install
npm start
```

6. For automatic restart during development:

```bash
npm run dev
```

The admin panel runs on http://localhost:3001.

Run the payment helper tests with `npm test` from `admin-panel`.

## Railway deployment

Deploy `admin-panel` as the Railway service root so Railway installs this folder's dependencies and uses `railway.json` (`npm start`, `/api/health`). Add a Railway MySQL service and set `DATABASE_URL` to its connection URL. Keep the database and Node service in the same Railway project/region when possible.

Set these service variables before deploying:

- `ADMIN_SESSION_SECRET`: a unique random value with at least 32 characters.
- `STAFF_PANEL_HOST`: the exact staff hostname, without a scheme, such as `staff.example.com`.
- `CORS_ALLOWED_ORIGINS`: comma-separated browser origins that need cross-origin API access. For a frontend served by this same service, leave it empty; add the exact origins if serving a frontend elsewhere.
- `UPLOADS_DIR=/app/public/uploads` and attach a Railway volume mounted at `/app/public/uploads`; this keeps banners, game art, avatars, and notification images on the same persistent path.
- SMTP, Firebase, ZapUPI, and `PUBLIC_BASE_URL` values required by the enabled application features. `PUBLIC_BASE_URL` should be the HTTPS origin used to serve uploaded images and payment return links.

Attach the main application domain and a second domain for staff to the same Railway service. Set `STAFF_PANEL_HOST` to the second domain. Its root redirects to staff login; that hostname serves only the staff pages, shared match APIs/assets, and uploads, and rejects admin authentication/account endpoints. The main domain continues to serve the regular admin panel. Staff credentials are created and revoked inside **Admin account → Staff sign up**; staff tokens can use match operations only.

For a new Railway database, import the existing application data/schema if this deployment should include existing users and matches. To create the first admin on an empty database, use Railway's service shell/CLI, temporarily provide `ADMIN_SETUP_USERNAME` and `ADMIN_SETUP_PASSWORD`, run `npm run admin:create` from the service root, then remove both temporary variables. The command refuses to overwrite an existing admin and stores only a scrypt password hash. Set `OWNER_EMAIL` in source to the final recovery address before delivery. If the database already has the admin account imported, do not run the bootstrap command.

After deployment, check `/api/health`, sign in to the admin domain, create a staff login, and verify the staff domain opens to the username/password form. Test match creation/status/results, room updates and push delivery, and uploaded images after a redeploy to confirm the Railway volume is mounted correctly.

## ZapUPI wallet flow

- `POST /api/wallet/create-zapupi-order` accepts `{ "userId": 123, "amount": 100 }`, creates a pending MySQL order, and requests a ZapUPI hosted checkout URL.
- `GET /api/wallet/check-status?orderId=...&userId=...` checks the order with ZapUPI. A matching completed order is credited once inside a MySQL transaction and recorded in `wallet_transactions`.
- `POST /api/wallet/zapupi-webhook` verifies the raw-body HMAC and then asks ZapUPI for the authoritative order status. Repeated webhook calls cannot double-credit an order.
- `GET /api/wallet/zapupi-orders` is admin-key protected and supplies all ZapUPI orders to the admin panel's Transactions page.
- ZapUPI's documented orders time out after 30 minutes. The app displays a five-minute checkout timer but continues server status polling while the modal is open; webhook reconciliation still works after the modal closes.

For sandbox testing, use the test merchant credentials and endpoint/account mode provided by ZapUPI. Their public docs show `https://zaprupee.com/api/create-order` and `https://zaprupee.com/api/check-order-status`, form-encoded requests, and test amounts, but do not publish sandbox credentials or a separate sandbox base URL. Test a successful payment, a cancelled/failed payment, duplicate webhook delivery, and payment completion after closing the app before producing the APK.

The current app stores a user profile locally and does not issue a server-authenticated session token. These wallet endpoints validate order ownership and never trust the client for payment status, but production deployments should add authenticated user sessions before accepting user IDs from public clients.

## Push notifications

The admin panel's **Send Notification** page broadcasts to registered device tokens and also saves the message in the mobile app's Notifications screen. Android FCM tokens are sent through `firebase-admin`; iOS uses Expo Push tokens because the current app obtains APNs-backed tokens on iOS. Match room updates send the room ID and password directly to devices registered by joined match participants; those credentials are not stored in the global notification feed.

The uploaded service-account key belongs in `admin-panel/firebase/`. The backend ignores JSON files in that folder and discovers a single JSON key automatically; alternatively set `FIREBASE_SERVICE_ACCOUNT_PATH` or all three Firebase credential variables in the backend `.env`. Never add this Admin SDK key to the mobile app, `google-services.json`, or source control.

Android builds also require the separate Firebase Android app config file `google-services.json` at the app root, matching `com.ratondutta.battlenext`; the path is configured in `app.json`. This is not the downloaded service-account key. Configure FCM v1 in the Firebase project and rebuild the app after adding the client config. Remote notifications require a development or production build, not Expo Go on Android. iOS delivery requires Expo/APNs push credentials for the EAS project.

The backend defaults to the `high_importance_channel` channel, and Android creates it after notification permission is granted. Set `PUBLIC_BASE_URL` to the public HTTPS API origin behind a reverse proxy so uploaded images can be fetched by notification services. `EXPO_ACCESS_TOKEN` is optional for iOS Expo Push if access-token security is enabled. The admin image upload accepts JPG, PNG, or WebP up to 5 MB; it is attached as rich notification content. Android's small monochrome tray icon is app-level, not per-message.

Device registration currently follows the app's existing user-ID-based API convention. Add authenticated user sessions before relying on push token ownership as a security boundary in production.

## Staff panel

After signing in to the admin panel, open **Admin account** and use **Staff sign up** to create a username and password. Staff can sign in at `http://localhost:3001/stuff-admin-panel` locally or at the separately configured Railway staff domain, and manage matches through the same database-backed match operations as the admin panel. Staff sessions cannot access the rest of the admin APIs.

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
