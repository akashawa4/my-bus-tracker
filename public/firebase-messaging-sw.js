/**
 * Firebase Cloud Messaging service worker for background/closed-tab notifications.
 * Uses Firebase compat SDK (required in service worker context).
 * Do not use ES modules here; use importScripts.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBe12v3ULPNlAxapSZ1zu5eFoxxHzpY-rU',
  authDomain: 'college-bus-tracking-903e7.firebaseapp.com',
  databaseURL: 'https://college-bus-tracking-903e7-default-rtdb.firebaseio.com',
  projectId: 'college-bus-tracking-903e7',
  storageBucket: 'college-bus-tracking-903e7.firebasestorage.app',
  messagingSenderId: '898454276553',
  appId: '1:898454276553:web:f09ddeada5625dd04d4018',
  measurementId: 'G-ST576M02S7'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Bus Tracker';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: payload.data?.tag || 'bus-tracker',
    requireInteraction: false,
    renotify: true,
    data: payload.data || {},
    silent: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf(self.registration.scope) >= 0 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Log when SW is installed and activated
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activated');
  event.waitUntil(clients.claim());
});
