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
```

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
