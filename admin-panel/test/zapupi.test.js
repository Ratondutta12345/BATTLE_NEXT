const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  amountToPaise,
  createOrderId,
  isVerifiedCompletedOrder,
  normalizeProviderStatus,
  verifyWebhookSignature,
} = require('../lib/zapupi');

test('amountToPaise accepts valid INR amounts from the wallet minimum', () => {
  assert.equal(amountToPaise('10'), 1000);
  assert.equal(amountToPaise('10.05'), 1005);
  assert.equal(amountToPaise('9999999999.99'), 999999999999);
});

test('amountToPaise rejects invalid, under-minimum, and over-limit amounts', () => {
  for (const value of ['9.99', '10.001', '1e2', '-10', '10000000000.00', '']) {
    assert.equal(amountToPaise(value), null, `expected ${value} to be rejected`);
  }
});

test('order IDs are unique-format and within ZapUPI length limit', () => {
  const orderId = createOrderId();
  assert.match(orderId, /^BN\d{13}[A-F0-9]{12}$/);
  assert.ok(orderId.length <= 50);
});

test('webhook HMAC validation uses timing-safe comparison and the exact body', () => {
  const rawBody = Buffer.from([0x7b, 0x22, 0x7d]);
  const signature = crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
  assert.equal(verifyWebhookSignature(rawBody, `sha256=${signature}`, 'test-secret'), true);
  assert.equal(verifyWebhookSignature(rawBody, signature, 'wrong-secret'), false);
  assert.equal(verifyWebhookSignature(rawBody, signature.slice(2), 'test-secret'), false);
});

test('a payment is accepted only when provider order and amount match', () => {
  const order = { provider_order_id: 'provider-1', amount_paise: 1000 };
  const complete = { status: 'COMPLETED', result: { orderId: 'provider-1', amount: '10.00', txnStatus: 'COMPLETED' } };
  assert.equal(isVerifiedCompletedOrder(order, complete), true);
  assert.equal(isVerifiedCompletedOrder({ ...order, order_id: 'merchant-1' }, { ...complete, result: { ...complete.result, orderId: 'merchant-1' } }), true);
  assert.equal(isVerifiedCompletedOrder(order, { ...complete, result: { ...complete.result, amount: '11.00' } }), false);
  assert.equal(isVerifiedCompletedOrder(order, { ...complete, result: { ...complete.result, orderId: 'other' } }), false);
  assert.equal(isVerifiedCompletedOrder(order, { ...complete, status: 'PENDING' }), false);
});

test('provider statuses normalize to the finite local state set', () => {
  assert.equal(normalizeProviderStatus({ status: 'COMPLETED' }), 'COMPLETED');
  assert.equal(normalizeProviderStatus({ result: { status: 'SUCCESS' } }), 'COMPLETED');
  assert.equal(normalizeProviderStatus({ status: 'FAILED' }), 'FAILED');
  assert.equal(normalizeProviderStatus({ status: 'ERROR' }), 'PENDING');
});
