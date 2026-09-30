const fs = require('fs');
const path = require('path');
const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const adminRoot = path.resolve(__dirname, '..');
const serviceAccountDirectory = path.join(adminRoot, 'firebase');
const defaultServiceAccountFile = 'firebase-key.json';

function readServiceAccount() {
  const hasEnvironmentCredentials = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_PRIVATE_KEY;
  if (hasEnvironmentCredentials) {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = process.env;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY together.');
    }
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let serviceAccountPath = configuredPath
    ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(adminRoot, configuredPath))
    : path.join(serviceAccountDirectory, defaultServiceAccountFile);

  if (!configuredPath && !fs.existsSync(serviceAccountPath)) {
    const candidates = fs.existsSync(serviceAccountDirectory)
      ? fs.readdirSync(serviceAccountDirectory).filter((file) => file.toLowerCase().endsWith('.json'))
      : [];
    if (candidates.length === 1) serviceAccountPath = path.join(serviceAccountDirectory, candidates[0]);
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or the FIREBASE_* environment variables.');
  }
  return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}

function getFirebaseApp() {
  if (getApps().length) return getApp();
  const serviceAccount = readServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.projectId || serviceAccount.project_id;
  initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || serviceAccount.clientEmail || serviceAccount.client_email,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || serviceAccount.privateKey || serviceAccount.private_key,
    }),
    projectId,
  });
  return getApp();
}

function getFirebaseMessaging() {
  return getMessaging(getFirebaseApp());
}

module.exports = { getFirebaseMessaging };
