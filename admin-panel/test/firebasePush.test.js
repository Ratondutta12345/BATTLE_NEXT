const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFirebaseMessage } = require('../lib/firebasePush');

test('FCM payload uses high-priority Android channel and string deep-link data', () => {
  const payload = buildFirebaseMessage({
    title: 'Match Room Details Updated!',
    message: 'Match ID: 12 | Room ID: ROOM | Pass: CODE',
    link: '/match/8',
    customData: { matchId: 12, roomId: 'ROOM', roomPassword: 'CODE', type: 'MATCH_ROOM_DETAILS' },
  });

  assert.equal(payload.notification.title, 'Match Room Details Updated!');
  assert.equal(payload.notification.body, 'Match ID: 12 | Room ID: ROOM | Pass: CODE');
  assert.deepEqual(payload.android, {
    priority: 'high',
    notification: { sound: 'default', channelId: 'high_importance_channel' },
  });
  assert.deepEqual(payload.data, {
    matchId: '12',
    roomId: 'ROOM',
    roomPassword: 'CODE',
    type: 'MATCH_ROOM_DETAILS',
    link: '/match/8',
    url: '/match/8',
  });
});

test('FCM payload includes optional notification image URLs', () => {
  const payload = buildFirebaseMessage({ title: 'Title', message: 'Body', icon: 'https://example.com/icon.png' });
  assert.equal(payload.notification.imageUrl, 'https://example.com/icon.png');
  assert.equal(payload.android.notification.imageUrl, 'https://example.com/icon.png');
  assert.equal(payload.apns.fcmOptions.imageUrl, 'https://example.com/icon.png');
});