/**
 * Push Notifications – cross-platform (Web + Native via Capacitor).
 *
 * Web:    Firebase Cloud Messaging with service worker
 * Native: Capacitor PushNotifications plugin (uses FCM on Android, APNs on iOS)
 *
 * All existing imports (`from '@/services/fcm'`) continue to work unchanged.
 */

import { Capacitor } from "@capacitor/core";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { ref, set, update } from "firebase/database";
import app, { rtdb } from "@/lib/firebase";

const isNative = Capacitor.isNativePlatform();

const VAPID_KEY =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_VAPID_KEY
    ? import.meta.env.VITE_VAPID_KEY
    : "BGinVDFTAtjjdew-FgbaItj_umBrX7jVLhurnQjBQojPE_mRb5jCGlqh8zlmKNs4vUTnke9bVvvM-RzfvWDXIlA";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Web-only: checks that browser Notification + SW APIs are available */
const isWebSupported = (): boolean =>
  !isNative &&
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator;

/** Public alias kept for backward compat */
export const isSupported = (): boolean => isNative || isWebSupported();

let messagingInstance: ReturnType<typeof getMessaging> | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

function getMessagingSafe() {
  if (!isWebSupported()) return null;
  if (messagingInstance) return messagingInstance;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error("[FCM] Failed to get messaging instance:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Service Worker (web only)                                         */
/* ------------------------------------------------------------------ */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNative) {
    console.log("[FCM] Native platform – service worker not needed");
    return null;
  }
  if (!isWebSupported()) {
    console.warn("[FCM] Service workers not supported");
    return null;
  }
  if (serviceWorkerRegistration) {
    console.log("[FCM] Service worker already registered:", serviceWorkerRegistration);
    return serviceWorkerRegistration;
  }
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    console.log("[FCM] Service worker registered:", registration);
    console.log("[FCM] Service worker scope:", registration.scope);
    console.log("[FCM] Service worker state:", registration.active?.state || registration.installing?.state || registration.waiting?.state);
    await navigator.serviceWorker.ready;
    console.log("[FCM] Service worker is ready");
    serviceWorkerRegistration = registration;
    return registration;
  } catch (err) {
    console.error("[FCM] Service worker registration failed:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Permission                                                         */
/* ------------------------------------------------------------------ */

// Guard against concurrent permission requests (Android only allows one at a time)
let _permissionPromise: Promise<NotificationPermission> | null = null;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (isNative) {
    // If there's already a permission request in flight, wait for it
    if (_permissionPromise) {
      console.log("[FCM] Permission request already in flight, waiting...");
      return _permissionPromise;
    }

    _permissionPromise = (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Check first – if already granted, don't show the dialog again
        const check = await PushNotifications.checkPermissions();
        console.log("[FCM] Native permission check:", JSON.stringify(check));
        if (check.receive === "granted") return "granted" as NotificationPermission;

        // Only request if not yet decided
        const result = await PushNotifications.requestPermissions();
        const mapped: NotificationPermission = result.receive === "granted" ? "granted" : "denied";
        console.log("[FCM] Native permission result:", mapped);
        return mapped;
      } catch (err) {
        console.error("[FCM] Native permission request error:", err);
        return "denied" as NotificationPermission;
      } finally {
        _permissionPromise = null;
      }
    })();

    return _permissionPromise;
  }

  // Web
  if (!isWebSupported()) return "denied";
  console.log("[FCM] Current notification permission:", Notification.permission);
  if (Notification.permission !== "default") return Notification.permission;
  const permission = await Notification.requestPermission();
  console.log("[FCM] New notification permission:", permission);
  return permission;
}

/* ------------------------------------------------------------------ */
/*  System notification                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_ICON = "/placeholder.svg";

export async function showSystemNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string; data?: Record<string, unknown> }
): Promise<void> {
  if (isNative) {
    // On native, foreground pushes are NOT auto-shown by the OS.
    // We must use Local Notifications to display them.
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // Check/request permission
      const permCheck = await LocalNotifications.checkPermissions();
      if (permCheck.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") {
          console.warn("[FCM] Local notification permission denied");
          return;
        }
      }

      // Generate a UNIQUE ID per notification so they don't replace each other.
      // Using timestamp + random ensures each notification gets its own slot.
      const notifId = (Date.now() % 90000) + Math.floor(Math.random() * 10000);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body: options?.body ?? "",
            smallIcon: "ic_notification",
            largeIcon: "ic_notification",
            channelId: "bus_tracking",
            sound: "default",
            extra: options?.data ?? {},
          },
        ],
      });
      console.log("[FCM] Native local notification shown:", title);
    } catch (err) {
      console.warn("[FCM] Native local notification failed:", err);
    }
    return;
  }
  if (!isWebSupported()) return;
  if (Notification.permission !== "granted") {
    console.warn("[FCM] Cannot show notification – permission not granted");
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
    n.onclick = () => { window.focus(); n.close(); };
    console.log("[FCM] System notification shown:", title);
  } catch (err) {
    console.warn("[FCM] showSystemNotification failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Token                                                              */
/* ------------------------------------------------------------------ */

export async function getFCMToken(retryAfterMs = 2000): Promise<string | null> {
  /* -------- NATIVE -------- */
  if (isNative) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      // Only CHECK permission here (don't re-request – initFCMForStudent handles that)
      const permResult = await PushNotifications.checkPermissions();
      if (permResult.receive !== "granted") {
        console.warn("[FCM] Native notification permission not granted (checked in getFCMToken)");
        return null;
      }

      // Register for push and wait for the token via one-shot listeners
      return new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("[FCM] Native token timeout");
          regListener?.remove();
          errListener?.remove();
          resolve(null);
        }, 10_000);

        let regListener: { remove: () => void } | null = null;
        let errListener: { remove: () => void } | null = null;

        PushNotifications.addListener("registration", (token) => {
          clearTimeout(timeout);
          regListener?.remove();
          errListener?.remove();
          console.log("[FCM] Native token received:", token.value.substring(0, 20) + "...");
          resolve(token.value);
        }).then((h) => { regListener = h; });

        PushNotifications.addListener("registrationError", (err) => {
          clearTimeout(timeout);
          regListener?.remove();
          errListener?.remove();
          console.error("[FCM] Native registration error:", err);
          resolve(null);
        }).then((h) => { errListener = h; });

        PushNotifications.register();
      });
    } catch (err) {
      console.error("[FCM] Native getFCMToken error:", err);
      return null;
    }
  }

  /* -------- WEB -------- */
  console.log("[FCM] getFCMToken called");
  const webPerm = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";
  console.log("[FCM] Notification permission:", webPerm);

  if (webPerm !== "granted") {
    console.warn("[FCM] Cannot get token – notification permission not granted");
    return null;
  }

  const swRegistration = await registerServiceWorker();
  if (!swRegistration) {
    console.error("[FCM] Cannot get token – service worker registration failed");
    return null;
  }

  const messaging = getMessagingSafe();
  if (!messaging) {
    console.error("[FCM] Cannot get token – messaging instance not available");
    return null;
  }

  try {
    console.log("[FCM] Getting token with VAPID key...");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (token) console.log("[FCM] Token obtained successfully:", token.substring(0, 20) + "...");
    else console.warn("[FCM] getToken returned null/empty");
    return token;
  } catch (err) {
    console.warn("[FCM] getToken error (will retry once):", err);
    if (retryAfterMs > 0) {
      await new Promise((r) => setTimeout(r, retryAfterMs));
      try {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
        if (token) console.log("[FCM] Token obtained on retry:", token.substring(0, 20) + "...");
        return token;
      } catch (err2) {
        console.error("[FCM] getToken retry error:", err2);
        return null;
      }
    }
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  RTDB helpers                                                       */
/* ------------------------------------------------------------------ */

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

export async function updateStudentRouteStopInRTDB(
  studentId: string,
  routeId: string | undefined,
  stopId: string | undefined
): Promise<void> {
  if (!studentId) return;
  if (routeId != null) await set(ref(rtdb, `students/${studentId}/routeId`), routeId);
  if (stopId != null) await set(ref(rtdb, `students/${studentId}/stopId`), stopId);
}

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

// Lock to prevent concurrent initFCMForStudent calls (React StrictMode calls useEffect twice)
let _initLock: Promise<boolean> | null = null;

export async function initFCMForStudent(
  studentId: string,
  options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
  console.log("[FCM] initFCMForStudent called for:", studentId);

  if (!studentId) {
    console.warn("[FCM] No studentId – cannot save token");
    return false;
  }

  // If there's an init in flight, wait for it instead of starting another
  if (_initLock) {
    console.log("[FCM] initFCMForStudent already in flight, waiting...");
    return _initLock;
  }

  _initLock = (async () => {
    try {
      // Check / request permission
      let permission: NotificationPermission;
      if (isNative) {
        permission = await requestNotificationPermission();
      } else {
        if (!isWebSupported()) {
          console.warn("[FCM] Not supported on this browser");
          return false;
        }
        permission = (typeof window !== "undefined" && "Notification" in window) ? Notification.permission : "denied";
        if (permission === "default") {
          console.log("[FCM] Requesting notification permission...");
          permission = await requestNotificationPermission();
        }
      }

      console.log("[FCM] Notification permission:", permission);
      if (permission !== "granted") {
        console.warn("[FCM] Notification permission not granted");
        return false;
      }

      const token = await getFCMToken();
      if (!token) {
        console.warn("[FCM] getToken() failed");
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
    } finally {
      _initLock = null;
    }
  })();

  return _initLock;
}

export async function refreshAndSaveFCMToken(
  studentId: string,
  options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
  if (!studentId) return false;
  if (!isNative && (!isWebSupported() || !((typeof window !== "undefined" && "Notification" in window) && Notification.permission === "granted"))) return false;
  const token = await getFCMToken(0);
  if (!token) return false;
  await saveFCMTokenToRTDB(studentId, token, options);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Foreground message handler                                         */
/* ------------------------------------------------------------------ */

export type ForegroundMessageHandler = (payload: MessagePayload) => void;

export function setupForegroundMessageHandler(handler: ForegroundMessageHandler): (() => void) | null {
  /* -------- NATIVE -------- */
  if (isNative) {
    console.log("[FCM] Setting up native push notification listeners");

    let cleanup = false;
    let recvHandle: { remove: () => void } | null = null;
    let actionHandle: { remove: () => void } | null = null;

    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      if (cleanup) return;

      // Notification received while app is in foreground
      recvHandle = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("[FCM] Native foreground push received:", notification);
        // For data-only messages, title/body are in notification.data, not at the top level
        const dataObj = (notification.data ?? {}) as Record<string, string>;
        const title = notification.title || dataObj.title || "";
        const body = notification.body || dataObj.body || "";
        handler({
          notification: { title, body },
          data: notification.data,
        } as MessagePayload);
      });

      // User tapped on a notification
      actionHandle = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("[FCM] Native push action performed:", action);
      });
    })();

    return () => {
      cleanup = true;
      // Only remove OUR specific listeners, not all (which would nuke registration listeners too)
      recvHandle?.remove();
      actionHandle?.remove();
    };
  }

  /* -------- WEB -------- */
  const messaging = getMessagingSafe();
  if (!messaging) return null;

  console.log("[FCM] Setting up foreground message handler");
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log("[FCM] Foreground message received:", payload);
    handler(payload);
  });
  return unsubscribe;
}

/* ------------------------------------------------------------------ */
/*  Debug                                                              */
/* ------------------------------------------------------------------ */

export async function checkFCMStatus(): Promise<void> {
  console.log("=== FCM Status Check ===");
  console.log("1. Platform:", Capacitor.getPlatform());
  console.log("2. isNative:", isNative);
  console.log("3. isSupported:", isSupported());

  if (isNative) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.checkPermissions();
      console.log("4. Native permission:", perm.receive);
    } catch (e) {
      console.log("4. Native permission check failed:", e);
    }
  } else {
    console.log("4. Web Notification permission:", typeof window !== "undefined" && "Notification" in window ? Notification.permission : "N/A");
    console.log("5. Service Worker support:", "serviceWorker" in navigator);
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log("6. Service Worker registrations:", registrations.length);
    }
    console.log("7. VAPID Key (first 20 chars):", VAPID_KEY.substring(0, 20) + "...");
  }
  console.log("========================");
}

/** Test: fire a native local notification to verify the pipeline works */
export async function testNativeNotification(): Promise<void> {
  console.log("[FCM-TEST] Sending test notification...");
  await showSystemNotification("🧪 Test Notification", {
    body: "If you see this, native notifications are working!",
    tag: "test-notification-" + Date.now(),
  });
  console.log("[FCM-TEST] Test notification sent (check your tray).");
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).checkFCMStatus = checkFCMStatus;
  (window as unknown as Record<string, unknown>).testNativeNotification = testNativeNotification;
}
