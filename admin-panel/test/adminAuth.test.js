const test = require('node:test');
const assert = require('node:assert/strict');
const { issueAdminToken, issueStaffToken, verifyAdminToken, isLocalSetupRequest, requireAdminKey } = require('../lib/adminAuth');

test('admin session token is signed and bound to its account version', () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters';
  try {
    const token = issueAdminToken({ id: 1, session_version: 4 });
    const claims = verifyAdminToken(token);
    assert.equal(claims.id, 1);
    assert.equal(claims.version, 4);
    assert.equal(claims.type, 'admin');
    assert.equal(typeof claims.exp, 'number');
    const staffClaims = verifyAdminToken(issueStaffToken({ id: 9, session_version: 2 }));
    assert.equal(staffClaims.id, 9);
    assert.equal(staffClaims.version, 2);
    assert.equal(staffClaims.type, 'staff');
    const [, signature] = token.split('.');
    const alteredPayload = Buffer.from(JSON.stringify({ id: 1, version: 5, exp: claims.exp })).toString('base64url');
    assert.equal(verifyAdminToken(`${alteredPayload}.${signature}`), null);
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test('admin session tokens require a strong configured secret', () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    assert.throws(() => issueAdminToken({ id: 1, session_version: 1 }), /at least 32 characters/);
    assert.equal(verifyAdminToken('invalid.token'), null);
  } finally {
    if (previousSecret !== undefined) process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test('admin guard does not fail open when no session secret is configured', async () => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  const response = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  try {
    await requireAdminKey({ get: () => undefined }, response, () => { nextCalled = true; });
    assert.equal(response.statusCode, 401);
    assert.equal(nextCalled, false);
  } finally {
    if (previousSecret !== undefined) process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test('first admin setup is local-only and checks both host and peer address', () => {
  const makeRequest = (host, remoteAddress) => ({
    get: () => host,
    socket: { remoteAddress },
  });

  assert.equal(isLocalSetupRequest(makeRequest('localhost:3001', '::1')), true);
  assert.equal(isLocalSetupRequest(makeRequest('127.0.0.1:3001', '::ffff:127.0.0.1')), true);
  assert.equal(isLocalSetupRequest(makeRequest('localhost:3001', '203.0.113.7')), false);
  assert.equal(isLocalSetupRequest(makeRequest('admin.example.com', '127.0.0.1')), false);
});