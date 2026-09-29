const { getFirebaseMessaging } = require('../config/firebase');

const FCM_BATCH_SIZE = 500;
const EXPO_BATCH_SIZE = 100;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ANDROID_CHANNEL_ID = 'high_importance_channel';

function toDataStrings(data = {}) {
  return Object.fromEntries(Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
}

function buildFirebaseMessage({ title, message, link, icon, customData = {} }) {
  const data = toDataStrings({ ...customData, ...(link ? { link, url: link } : {}) });
  return {
    notification: { title, body: message, ...(icon ? { imageUrl: icon } : {}) },
    data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: ANDROID_CHANNEL_ID,
        ...(icon ? { imageUrl: icon } : {}),
      },
    },
    apns: {
      payload: { aps: { sound: 'default' } },
      ...(icon ? { fcmOptions: { imageUrl: icon } } : {}),
    },
  };
}

async function sendExpoMessages(tokens, payload) {
  let sent = 0;
  let failed = 0;
  for (let offset = 0; offset < tokens.length; offset += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(offset, offset + EXPO_BATCH_SIZE);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch.map((token) => ({
        to: token,
        title: payload.notification.title,
        body: payload.notification.body,
        sound: 'default',
        priority: 'high',
        channelId: ANDROID_CHANNEL_ID,
        data: payload.data,
        ...(payload.notification.imageUrl ? { richContent: { image: payload.notification.imageUrl } } : {}),
      }))),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message || `Expo Push returned HTTP ${response.status}`);
    for (const ticket of result.data || []) {
      if (ticket.status === 'ok') sent += 1;
      else failed += 1;
    }
  }
  return { sent, failed };
}

async function sendPushNotification({ title, message, link, icon, targetTopic, targetTokens = [], customData = {} }) {
  const payload = buildFirebaseMessage({ title, message, link, icon, customData });
  const uniqueTokens = [...new Set(targetTokens.filter((token) => typeof token === 'string' && token.trim()))];
  if (targetTopic) {
    const messageId = await getFirebaseMessaging().send({ ...payload, topic: targetTopic });
    return { sent: 1, failed: 0, messageId, invalidTokens: [] };
  }

  const expoTokens = uniqueTokens.filter((token) => /^(Expo|Exponent)PushToken\[/.test(token));
  const fcmTokens = uniqueTokens.filter((token) => !expoTokens.includes(token));
  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (let offset = 0; offset < fcmTokens.length; offset += FCM_BATCH_SIZE) {
    const batch = fcmTokens.slice(offset, offset + FCM_BATCH_SIZE);
    const response = await getFirebaseMessaging().sendEachForMulticast({ ...payload, tokens: batch });
    sent += response.successCount;
    failed += response.failureCount;
    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(batch[index]);
      }
    });
  }

  if (expoTokens.length) {
    const expoResult = await sendExpoMessages(expoTokens, payload);
    sent += expoResult.sent;
    failed += expoResult.failed;
  }

  return { sent, failed, invalidTokens };
}

module.exports = { ANDROID_CHANNEL_ID, buildFirebaseMessage, sendPushNotification };
