const crypto = require('crypto');

const ZAPUPI_API_BASE_URL = 'https://zaprupee.com/api';

function amountToPaise(value) {
  const normalized = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [rupees, fraction = ''] = normalized.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise < 1000 || paise > 999999999999) return null;
  return paise;
}

function formatAmount(paise) {
  return (paise / 100).toFixed(2);
}

function createOrderId() {
  return `BN${Date.now()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function verifyWebhookSignature(rawBody, providedSignature, secret) {
  if (!Buffer.isBuffer(rawBody) || !providedSignature || !secret) return false;

  const signature = String(providedSignature).replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function normalizeProviderStatus(payload) {
  const statuses = [payload?.status, payload?.result?.status, payload?.result?.txnStatus]
    .map((value) => String(value || '').toUpperCase())
    .filter((value) => ['COMPLETED', 'SUCCESS', 'FAILED', 'PENDING', 'ERROR'].includes(value));
  const normalized = statuses.map((status) => ['COMPLETED', 'SUCCESS'].includes(status) ? 'COMPLETED' : status);
  if (normalized.includes('PENDING') || normalized.includes('ERROR')) return 'PENDING';
  if (normalized.includes('COMPLETED') && normalized.every((status) => status === 'COMPLETED')) return 'COMPLETED';
  if (normalized.includes('FAILED') && normalized.every((status) => status === 'FAILED')) return 'FAILED';
  return 'PENDING';
}

function isVerifiedCompletedOrder(order, payload) {
  if (normalizeProviderStatus(payload) !== 'COMPLETED') return false;

  const providerOrderId = String(payload?.result?.orderId || '');
  const providerAmountPaise = amountToPaise(payload?.result?.amount);
  const expectedOrderIds = [String(order.order_id || ''), String(order.provider_order_id || '')];
  return expectedOrderIds.includes(providerOrderId) && providerAmountPaise === Number(order.amount_paise);
}

async function postForm(endpoint, values) {
  const body = new URLSearchParams(values);
  const response = await fetch(`${ZAPUPI_API_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`ZapUPI ${endpoint} request failed with HTTP ${response.status}`);
  }
  return payload;
}

module.exports = {
  amountToPaise,
  createOrderId,
  formatAmount,
  isVerifiedCompletedOrder,
  normalizeProviderStatus,
  postForm,
  verifyWebhookSignature,
};
