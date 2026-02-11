/**
 * Push Notifications for Student Bus Tracker
 * Supports both:
 * - Web: Firebase Cloud Messaging with Service Worker
 * - Native (Android/iOS): Capacitor Push Notifications
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { ref, set, update } from "firebase/database";
import app, { rtdb } from "@/lib/firebase";

const VAPID_KEY =
    typeof import.meta.env !== "undefined" && import.meta.env.VITE_VAPID_KEY
        ? import.meta.env.VITE_VAPID_KEY
        : "BGinVDFTAtjjdew-FgbaItj_umBrX7jVLhurnQjBQojPE_mRb5jCGlqh8zlmKNs4vUTnke9bVvvM-RzfvWDXIlA";

const isNative = Capacitor.isNativePlatform();

const isWebSupported = (): boolean => {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
};

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

/**
 * Register the Firebase Cloud Messaging service worker (WEB ONLY).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (isNative) {
        console.log("[FCM] Running on native platform - service worker not needed");
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
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/"
        });

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

/**
 * Request notification permission (works for both web and native)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (isNative) {
        console.log("[Notifications] Requesting permission on native platform");
        try {
            const result = await PushNotifications.requestPermissions();
            if (result.receive === 'granted') {
                console.log("[Notifications] Permission granted on native");
                return "granted";
            } else {
                console.warn("[Notifications] Permission denied on native");
                return "denied";
            }
        } catch (err) {
            console.error("[Notifications] Permission request failed:", err);
            return "denied";
        }
    }

    // Web
    if (!isWebSupported()) {
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
 * Show a system notification
 */
export function showSystemNotification(
    title: string,
    options?: { body?: string; icon?: string; tag?: string; data?: Record<string, unknown> }
): void {
    if (isNative) {
        // On native, use Capacitor LocalNotifications to show a real system notification
        console.log("[Notifications] Scheduling local notification on native:", title);
        const notifId = Math.floor(Math.random() * 2147483647); // unique int id
        LocalNotifications.schedule({
            notifications: [
                {
                    title: title,
                    body: options?.body ?? "",
                    id: notifId,
                    schedule: { at: new Date(Date.now() + 100) }, // show almost immediately
                    sound: undefined, // use default sound
                    smallIcon: "ic_stat_icon_config_sample", // default Capacitor icon
                    largeIcon: "ic_launcher",
                    channelId: "bus_tracking",
                    extra: options?.data ?? {},
                },
            ],
        }).then(() => {
            console.log("[Notifications] Local notification scheduled successfully, id:", notifId);
        }).catch((err) => {
            console.error("[Notifications] Failed to schedule local notification:", err);
        });
        return;
    }

    if (!isWebSupported() || typeof window === "undefined") return;
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
 * Get FCM/Push notification token
 */
export async function getFCMToken(retryAfterMs = 2000): Promise<string | null> {
    if (isNative) {
        console.log("[Notifications] Getting token on native platform");
        try {
            // Register for push notifications on native
            await PushNotifications.register();

            // Wait for token
            return new Promise((resolve) => {
                PushNotifications.addListener('registration', (token: Token) => {
                    console.log("[Notifications] Native push token received:", token.value.substring(0, 20) + "...");
                    resolve(token.value);
                });

                PushNotifications.addListener('registrationError', (error) => {
                    console.error("[Notifications] Native registration error:", error);
                    resolve(null);
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    console.warn("[Notifications] Token registration timeout");
                    resolve(null);
                }, 10000);
            });
        } catch (err) {
            console.error("[Notifications] Failed to get native token:", err);
            return null;
        }
    }

    // Web FCM token
    console.log("[FCM] getFCMToken called");
    console.log("[FCM] Notification permission:", Notification.permission);

    if (Notification.permission !== "granted") {
        console.warn("[FCM] Cannot get token - notification permission not granted");
        return null;
    }

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
 * Save FCM/Push token to Realtime Database
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
 * Update student route/stop in RTDB
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
 * Initialize push notifications for student
 */
export async function initFCMForStudent(
    studentId: string,
    options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
    console.log("[FCM] initFCMForStudent called for:", studentId);

    if (!studentId) {
        console.warn("[FCM] No studentId – cannot save token");
        return false;
    }

    // Request permission
    let permission: NotificationPermission = isNative ? "granted" : Notification.permission;
    if (permission === "default") {
        console.log("[FCM] Requesting notification permission...");
        permission = await requestNotificationPermission();
    }

    if (permission !== "granted") {
        console.warn("[FCM] Notification permission not granted");
        return false;
    }

    const token = await getFCMToken();
    if (!token) {
        console.warn("[FCM] Failed to get token");
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
 * Refresh and save FCM token
 */
export async function refreshAndSaveFCMToken(
    studentId: string,
    options?: { routeId?: string; stopId?: string }
): Promise<boolean> {
    if (!studentId) return false;

    const permission = isNative ? "granted" : Notification.permission;
    if (permission !== "granted") return false;

    const token = await getFCMToken(0);
    if (!token) return false;

    await saveFCMTokenToRTDB(studentId, token, options);
    return true;
}

export type ForegroundMessageHandler = (payload: MessagePayload | any) => void;

/**
 * Setup foreground message handler
 */
export function setupForegroundMessageHandler(handler: ForegroundMessageHandler): (() => void) | null {
    if (isNative) {
        console.log("[Notifications] Setting up native push notification listeners");

        // Handle notification received
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log("[Notifications] Push received:", notification);
            handler({
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: notification.data
            });
        });

        // Handle notification action (user tapped)
        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            console.log("[Notifications] Push action performed:", action);
        });

        // Return cleanup function
        return () => {
            PushNotifications.removeAllListeners();
        };
    }

    // Web
    const messaging = getMessagingSafe();
    if (!messaging) return null;

    console.log("[FCM] Setting up foreground message handler");
    const unsubscribe = onMessage(messaging, (payload) => {
        console.log("[FCM] Foreground message received:", payload);
        handler(payload);
    });

    return unsubscribe;
}

export { isWebSupported as isSupported };
