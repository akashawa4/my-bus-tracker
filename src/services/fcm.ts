/**
 * Firebase Cloud Messaging (FCM) for web push notifications.
 * Uses Firebase Modular SDK (v9+).
 *
 * Student app FCM checklist (so Cloud Functions can notify students):
 * 1. Register for FCM + getToken({ vapidKey }) → token
 * 2. Save to Realtime Database under students/{studentId}: fcmToken, routeId, stopId
 * 3. Foreground: onMessage() → show in-app toast (Sonner)
 * 4. Background/closed: firebase-messaging-sw.js onBackgroundMessage → system notification
 */

import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { ref, set, update } from "firebase/database";
import app, { rtdb } from "@/lib/firebase";

const VAPID_KEY =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_VAPID_KEY
    ? import.meta.env.VITE_VAPID_KEY
    : "BGinVDFTAtjjdew-FgbaItj_umBrX7jVLhurnQjBQojPE_mRb5jCGlqh8zlmKNs4vUTnke9bVvvM-RzfvWDXIlA";

const isSupported = (): boolean => {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
};

let messagingInstance: ReturnType<typeof getMessaging> | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

function getMessagingSafe() {
  if (!isSupported()) return null;
  if (messagingInstance) return messagingInstance;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error("[FCM] Failed to get messaging instance:", err);
    return null;
  }
}

/**
 * Register the Firebase Cloud Messaging service worker.
 * This MUST be done before getting the FCM token.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isSupported()) {
    console.warn("[FCM] Service workers not supported");
    return null;
  }

  if (serviceWorkerRegistration) {
    console.log("[FCM] Service worker already registered:", serviceWorkerRegistration);
    return serviceWorkerRegistration;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });

    console.log("[FCM] Service worker registered:", registration);
    console.log("[FCM] Service worker scope:", registration.scope);
    console.log("[FCM] Service worker state:", registration.active?.state || registration.installing?.state || registration.waiting?.state);

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    console.log("[FCM] Service worker is ready");

    serviceWorkerRegistration = registration;
    return registration;
  } catch (err) {
    console.error("[FCM] Service worker registration failed:", err);
    return null;
  }
}

/**
 * Request browser notification permission.
 * Returns "granted" | "denied" | "default" (user dismissed).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isSupported()) {
    console.warn("[FCM] Notifications not supported");
    return "denied";
  }

  console.log("[FCM] Current notification permission:", Notification.permission);

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  const permission = await Notification.requestPermission();
  console.log("[FCM] New notification permission:", permission);
  return permission;
}

const DEFAULT_ICON = "/placeholder.svg";

/**
 * Show a system notification (OS notification tray – like on phone/laptop).
 * Use this for FCM so notifications appear in the system tray even when app is in foreground.
 */
export function showSystemNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string; data?: Record<string, unknown> }
): void {
  if (!isSupported() || typeof window === "undefined") return;
  if (Notification.permission !== "granted") {
    console.warn("[FCM] Cannot show notification - permission not granted");
    return;
  }
  try {
    const n = new Notification(title, {
      body: options?.body ?? "",
      icon: options?.icon ?? DEFAULT_ICON,
      badge: options?.icon ?? DEFAULT_ICON,
      tag: options?.tag ?? "bus-tracker",
      requireInteraction: false,
      data: options?.data,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    console.log("[FCM] System notification shown:", title);
  } catch (err) {
    console.warn("[FCM] showSystemNotification failed:", err);
  }
}

/**
 * Get FCM device token (registers SW if needed).
 * Call after permission is granted.
 * Retries once after delay if SW is not ready yet.
 */
export async function getFCMToken(retryAfterMs = 2000): Promise<string | null> {
  // Log current state for debugging
  console.log("[FCM] getFCMToken called");
  console.log("[FCM] Notification permission:", Notification.permission);

  if (Notification.permission !== "granted") {
    console.warn("[FCM] Cannot get token - notification permission not granted");
    return null;
  }

  // Ensure service worker is registered before getting token
  const swRegistration = await registerServiceWorker();
  if (!swRegistration) {
    console.error("[FCM] Cannot get token - service worker registration failed");
    return null;
  }

  const messaging = getMessagingSafe();
  if (!messaging) {
    console.error("[FCM] Cannot get token - messaging instance not available");
    return null;
  }

  try {
    console.log("[FCM] Getting token with VAPID key...");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (token) {
      console.log("[FCM] Token obtained successfully:", token.substring(0, 20) + "...");
    } else {
      console.warn("[FCM] getToken returned null/empty");
    }

    return token;
  } catch (err) {
    console.warn("[FCM] getToken error (will retry once):", err);
    if (retryAfterMs > 0) {
      await new Promise((r) => setTimeout(r, retryAfterMs));
      try {
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration
        });
        if (token) {
          console.log("[FCM] Token obtained on retry:", token.substring(0, 20) + "...");
        }
        return token;
      } catch (err2) {
        console.error("[FCM] getToken retry error:", err2);
        return null;
      }
    }
    return null;
  }
}

/**
 * Save FCM token to Realtime Database: students/{studentId}
 * Writes fcmToken (required) and routeId/stopId so Cloud Functions can find and notify students.
 * Uses update() so existing keys (e.g. routeId, stopId) are not wiped.
 */
export async function saveFCMTokenToRTDB(
  studentId: string,
  token: string,
  options?: { routeId?: string; stopId?: string }
): Promise<void> {
  const updates: Record<string, string> = { fcmToken: token };
  if (options?.routeId != null) updates.routeId = options.routeId;
  if (options?.stopId != null) updates.stopId = options.stopId;
  const studentPath = `students/${studentId}`;
  const updatePayload: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    updatePayload[`${studentPath}/${k}`] = v;
  }
  await update(ref(rtdb), updatePayload);
  console.log("[FCM] Token saved to RTDB:", studentPath);
}

/**
 * Update student route/stop in RTDB so Cloud Functions can target by route/stop.
 * Call when student completes setup or changes route/stop.
 */
export async function updateStudentRouteStopInRTDB(
  studentId: string,
  routeId: string | undefined,
  stopId: string | undefined
): Promise<void> {
  if (!studentId) return;
  if (routeId != null) {
    await set(ref(rtdb, `students/${studentId}/routeId`), routeId);
  }
  if (stopId != null) {
    await set(ref(rtdb, `students/${studentId}/stopId`), stopId);
  }
}

/**
 * Request permission (if needed), get token, and save to RTDB: students/{studentId} with fcmToken, routeId, stopId.
 * studentId must match RTDB path (e.g. Firestore doc id "1" → students/1).
 */
export async function initFCMForStudent(
  studentId: string,
  options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
  console.log("[FCM] initFCMForStudent called for:", studentId);

  if (!isSupported()) {
    console.warn("[FCM] Not supported (no window/Notification/serviceWorker)");
    return false;
  }
  if (!studentId) {
    console.warn("[FCM] No studentId – cannot save token");
    return false;
  }

  // Log current permission state
  console.log("[FCM] Notification permission:", Notification.permission);

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    console.log("[FCM] Requesting notification permission...");
    permission = await requestNotificationPermission();
  }

  if (permission !== "granted") {
    console.warn("[FCM] Notification permission not granted – enable in browser to get bus alerts");
    return false;
  }

  const token = await getFCMToken();
  if (!token) {
    console.warn("[FCM] getToken() failed – check service worker and VAPID key");
    return false;
  }

  try {
    await saveFCMTokenToRTDB(studentId, token, options);
    console.info("[FCM] ✅ FCM fully initialized for student:", studentId);
    return true;
  } catch (err) {
    console.error("[FCM] saveFCMTokenToRTDB failed:", err);
    return false;
  }
}

/**
 * Get token and save to RTDB when permission is already granted (e.g. on tab focus for token refresh).
 */
export async function refreshAndSaveFCMToken(
  studentId: string,
  options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
  if (!isSupported() || !studentId || Notification.permission !== "granted") return false;
  const token = await getFCMToken(0);
  if (!token) return false;
  await saveFCMTokenToRTDB(studentId, token, options);
  return true;
}

export type ForegroundMessageHandler = (payload: MessagePayload) => void;

/**
 * Handle foreground messages (app in focus).
 * Pass a callback to show in-app notification (e.g. toast).
 */
export function setupForegroundMessageHandler(handler: ForegroundMessageHandler): (() => void) | null {
  const messaging = getMessagingSafe();
  if (!messaging) return null;

  console.log("[FCM] Setting up foreground message handler");
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log("[FCM] Foreground message received:", payload);
    handler(payload);
  });
  return unsubscribe;
}

/**
 * Debug function to check FCM status - call this in browser console: checkFCMStatus()
 */
export async function checkFCMStatus(): Promise<void> {
  console.log("=== FCM Status Check ===");
  console.log("1. isSupported:", isSupported());
  console.log("2. Notification permission:", typeof window !== "undefined" && "Notification" in window ? Notification.permission : "N/A");
  console.log("3. Service Worker support:", "serviceWorker" in navigator);

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log("4. Service Worker registrations:", registrations.length);
    registrations.forEach((reg, i) => {
      console.log(`   SW ${i + 1}:`, {
        scope: reg.scope,
        active: reg.active?.state,
        installing: reg.installing?.state,
        waiting: reg.waiting?.state
      });
    });
  }

  console.log("5. VAPID Key (first 20 chars):", VAPID_KEY.substring(0, 20) + "...");
  console.log("========================");
}

// Expose checkFCMStatus to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as { checkFCMStatus: typeof checkFCMStatus }).checkFCMStatus = checkFCMStatus;
}

export { isSupported };
