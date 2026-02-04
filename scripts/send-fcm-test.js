/**
 * Send a test FCM notification to a device token.
 *
 * Prerequisites:
 *   1. Firebase project service account key (JSON).
 *      Firebase Console → Project Settings → Service accounts → Generate new private key.
 *   2. Install firebase-admin:  npm install firebase-admin
 *   3. FCM token from Realtime Database:  students/{studentId}/fcmToken
 *
 * Usage:
 *   node scripts/send-fcm-test.js <path-to-service-account.json> <fcm-token>
 *
 * Example:
 *   node scripts/send-fcm-test.js ./service-account.json "dGhpcyBpcyBhIHRva2Vu..."
 */

const path = require('path');

const serviceAccountPath = process.argv[2];
const fcmToken = process.argv[3];

if (!serviceAccountPath || !fcmToken) {
  console.error('Usage: node scripts/send-fcm-test.js <path-to-service-account.json> <fcm-token>');
  process.exit(1);
}

async function main() {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    console.error('Run: npm install firebase-admin');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
  let serviceAccount;
  try {
    serviceAccount = require(resolvedPath);
  } catch (e) {
    console.error('Failed to load service account file:', resolvedPath, e.message);
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const message = {
    notification: {
      title: 'Bus Tracker – Test',
      body: 'If you see this, FCM is working.',
    },
    data: {
      title: 'Bus Tracker – Test',
      body: 'If you see this, FCM is working.',
    },
    token: fcmToken,
    webpush: {
      fcmOptions: {
        link: '/',
      },
    },
  };

  try {
    const id = await admin.messaging().send(message);
    console.log('Sent successfully. Message ID:', id);
  } catch (err) {
    console.error('Send failed:', err.code || err.message, err);
    process.exit(1);
  }
}

main();
