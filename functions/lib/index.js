"use strict";
/**
 * Firebase Cloud Functions for Bus Tracking Notifications
 *
 * These functions run on Firebase's servers and send push notifications
 * to students even when their app is CLOSED or MINIMIZED.
 *
 * RTDB Structure:
 *   buses/{busNumber}/
 *     location: { lat, lng, routeId, routeName, routeState, ... }
 *     routeState: "not_started" | "in_progress" | "completed"
 *     currentStop: { name, order, stopId, status, ... }
 *     stops: { [stopId]: { name, order, status, ... } }
 *
 *   students/{studentId}/
 *     fcmToken: "device-token-string"
 *     routeId: "firestore-route-doc-id"
 *     stopId: "stop-identifier"
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onStudentTokenUpdate = exports.onBusCurrentStopChange = exports.onBusRouteStateChange = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.database();
const firestore = admin.firestore();
// ─── Helper: Find all student FCM tokens for a given routeId ───
async function getStudentTokensForRoute(routeId) {
    const studentsSnap = await db.ref("students").once("value");
    const students = studentsSnap.val();
    if (!students)
        return [];
    const results = [];
    for (const [studentId, data] of Object.entries(students)) {
        const s = data;
        if (s.routeId === routeId && s.fcmToken && typeof s.fcmToken === "string") {
            results.push({
                studentId,
                token: s.fcmToken,
                stopId: typeof s.stopId === "string" ? s.stopId : undefined,
            });
        }
    }
    return results;
}
// ─── Helper: Find routeId for a bus from RTDB or Firestore ───
async function getRouteIdForBus(busNumber, busData) {
    // Try from RTDB location data first
    const location = busData.location;
    if ((location === null || location === void 0 ? void 0 : location.routeId) && typeof location.routeId === "string") {
        return location.routeId;
    }
    // Fallback: query Firestore buses collection by busNumber
    try {
        const busQuery = await firestore
            .collection("buses")
            .where("busNumber", "==", busNumber)
            .limit(1)
            .get();
        if (!busQuery.empty) {
            const busDoc = busQuery.docs[0].data();
            if (busDoc.assignedRouteId) {
                return busDoc.assignedRouteId;
            }
        }
    }
    catch (err) {
        console.error(`[CF] Firestore query failed for bus ${busNumber}:`, err);
    }
    return null;
}
// ─── Helper: Get route stops from Firestore ───
async function getRouteStops(routeId) {
    try {
        const routeDoc = await firestore.collection("routes").doc(routeId).get();
        if (routeDoc.exists) {
            const data = routeDoc.data();
            if ((data === null || data === void 0 ? void 0 : data.stops) && Array.isArray(data.stops)) {
                return data.stops.map((s) => {
                    var _a, _b;
                    return ({
                        id: (_a = s.id) !== null && _a !== void 0 ? _a : "",
                        name: (_b = s.name) !== null && _b !== void 0 ? _b : "",
                    });
                });
            }
        }
    }
    catch (err) {
        console.error(`[CF] Failed to get route stops for ${routeId}:`, err);
    }
    return [];
}
// ─── Helper: Send FCM to multiple tokens, clean up invalid ones ───
async function sendToTokens(tokens, notification, data) {
    if (tokens.length === 0)
        return 0;
    const messaging = admin.messaging();
    let sentCount = 0;
    // Send to each token individually to handle failures gracefully
    const promises = tokens.map(async ({ studentId, token }) => {
        try {
            await messaging.send({
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: data !== null && data !== void 0 ? data : {},
                android: {
                    priority: "high",
                    notification: {
                        channelId: "bus_tracking",
                        icon: "ic_notification",
                        sound: "default",
                        clickAction: "FLUTTER_NOTIFICATION_CLICK",
                    },
                },
            });
            sentCount++;
            console.log(`[CF] Notification sent to student ${studentId}`);
        }
        catch (err) {
            const error = err;
            // Remove invalid tokens
            if (error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered") {
                console.warn(`[CF] Removing invalid token for student ${studentId}`);
                await db.ref(`students/${studentId}/fcmToken`).remove().catch(() => { });
            }
            else {
                console.error(`[CF] Failed to send to student ${studentId}:`, err);
            }
        }
    });
    await Promise.all(promises);
    return sentCount;
}
// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 1: BUS STARTED — triggers when routeState changes
// ═══════════════════════════════════════════════════════════════════════
exports.onBusRouteStateChange = functions.database
    .ref("buses/{busNumber}/routeState")
    .onUpdate(async (change, context) => {
    var _a, _b, _c, _d, _e, _f;
    const busNumber = context.params.busNumber;
    const before = typeof change.before.val() === "string"
        ? change.before.val()
        : (_b = (_a = change.before.val()) === null || _a === void 0 ? void 0 : _a.state) !== null && _b !== void 0 ? _b : "";
    const after = typeof change.after.val() === "string"
        ? change.after.val()
        : (_d = (_c = change.after.val()) === null || _c === void 0 ? void 0 : _c.state) !== null && _d !== void 0 ? _d : "";
    console.log(`[CF] Bus ${busNumber} routeState: "${before}" → "${after}"`);
    // ── Bus STARTED (not_started/idle → in_progress) ──
    if (after === "in_progress" && before !== "in_progress") {
        // Get full bus data to find routeId
        const busSnap = await db.ref(`buses/${busNumber}`).once("value");
        const busData = busSnap.val();
        if (!busData)
            return;
        const routeId = await getRouteIdForBus(busNumber, busData);
        if (!routeId) {
            console.warn(`[CF] No routeId found for bus ${busNumber}`);
            return;
        }
        const routeName = (_f = (_e = busData.location) === null || _e === void 0 ? void 0 : _e.routeName) !== null && _f !== void 0 ? _f : "your route";
        const students = await getStudentTokensForRoute(routeId);
        console.log(`[CF] Found ${students.length} students for route ${routeId}`);
        const sent = await sendToTokens(students, {
            title: "🚌 Bus Started!",
            body: `Your bus (${busNumber}) has started on ${routeName}! Track it in real-time.`,
        }, {
            type: "bus-started",
            busNumber,
            routeId,
        });
        console.log(`[CF] Bus Started notification sent to ${sent}/${students.length} students`);
    }
    // ── Bus COMPLETED (in_progress → completed) ──
    if (after === "completed" && before === "in_progress") {
        const busSnap = await db.ref(`buses/${busNumber}`).once("value");
        const busData = busSnap.val();
        if (!busData)
            return;
        const routeId = await getRouteIdForBus(busNumber, busData);
        if (!routeId)
            return;
        const students = await getStudentTokensForRoute(routeId);
        const sent = await sendToTokens(students, {
            title: "✅ Trip Completed",
            body: `Bus ${busNumber} has completed its route. See you next time!`,
        }, {
            type: "bus-completed",
            busNumber,
            routeId,
        });
        console.log(`[CF] Trip Completed notification sent to ${sent}/${students.length} students`);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 2: STOP UPDATES — triggers when currentStop changes
// Sends "Bus Approaching", "Bus Arrived", and "Bus Passed" notifications
// ═══════════════════════════════════════════════════════════════════════
exports.onBusCurrentStopChange = functions.database
    .ref("buses/{busNumber}/currentStop")
    .onUpdate(async (change, context) => {
    var _a, _b, _c;
    const busNumber = context.params.busNumber;
    const beforeStop = change.before.val();
    const afterStop = change.after.val();
    if (!afterStop)
        return;
    const afterOrder = typeof afterStop.order === "number" ? afterStop.order : -1;
    const beforeOrder = beforeStop && typeof beforeStop.order === "number" ? beforeStop.order : -1;
    // Only process if stop actually changed
    if (afterOrder === beforeOrder && afterStop.name === (beforeStop === null || beforeStop === void 0 ? void 0 : beforeStop.name))
        return;
    const afterStopName = (_a = afterStop.name) !== null && _a !== void 0 ? _a : "Unknown Stop";
    console.log(`[CF] Bus ${busNumber} stop change: order ${beforeOrder} → ${afterOrder} (${afterStopName})`);
    // Get bus data for routeId
    const busSnap = await db.ref(`buses/${busNumber}`).once("value");
    const busData = busSnap.val();
    if (!busData)
        return;
    // Only send if bus is actually running
    const rs = typeof busData.routeState === "string"
        ? busData.routeState
        : (_c = (_b = busData.routeState) === null || _b === void 0 ? void 0 : _b.state) !== null && _c !== void 0 ? _c : "";
    if (rs !== "in_progress")
        return;
    const routeId = await getRouteIdForBus(busNumber, busData);
    if (!routeId)
        return;
    // Get route stops to determine student stop positions
    const routeStops = await getRouteStops(routeId);
    // Get all students on this route
    const students = await getStudentTokensForRoute(routeId);
    if (students.length === 0)
        return;
    // For each student, check if we need to send approach/arrival/passed notification
    for (const student of students) {
        if (!student.stopId)
            continue;
        // Find student's stop index in route stops
        const studentStopIndex = routeStops.findIndex((s) => s.id === student.stopId);
        if (studentStopIndex < 0)
            continue;
        const studentStopName = routeStops[studentStopIndex].name;
        // currentStop.order is 1-based, array index is 0-based
        const currentBusStopIndex = afterOrder > 0 ? afterOrder - 1 : -1;
        // Bus is ONE stop away from student's stop
        if (currentBusStopIndex === studentStopIndex - 1) {
            await sendToTokens([student], {
                title: "📍 Bus Approaching!",
                body: `Your stop "${studentStopName}" is coming up next! Get ready.`,
            }, {
                type: "bus-approaching",
                busNumber,
                stopName: studentStopName,
            });
            console.log(`[CF] Approaching notification sent to ${student.studentId}`);
        }
        // Bus arrives AT student's stop
        if (currentBusStopIndex === studentStopIndex) {
            await sendToTokens([student], {
                title: "🎯 Bus Arrived!",
                body: `Bus has arrived at "${studentStopName}"! Time to board.`,
            }, {
                type: "bus-arrived",
                busNumber,
                stopName: studentStopName,
            });
            console.log(`[CF] Arrival notification sent to ${student.studentId}`);
        }
        // Bus has PASSED student's stop (current is one beyond student's)
        const previousBusStopIndex = beforeOrder > 0 ? beforeOrder - 1 : -1;
        if (currentBusStopIndex === studentStopIndex + 1 && previousBusStopIndex === studentStopIndex) {
            await sendToTokens([student], {
                title: "⚠️ Bus Passed Your Stop",
                body: `The bus has passed "${studentStopName}". Please contact the driver if needed.`,
            }, {
                type: "bus-passed",
                busNumber,
                stopName: studentStopName,
            });
            console.log(`[CF] Passed notification sent to ${student.studentId}`);
        }
    }
});
// ═══════════════════════════════════════════════════════════════════════
// FUNCTION 3: NEW STUDENT TOKEN — when a student registers their FCM token
// Send a welcome / confirmation notification
// ═══════════════════════════════════════════════════════════════════════
exports.onStudentTokenUpdate = functions.database
    .ref("students/{studentId}/fcmToken")
    .onWrite(async (change, context) => {
    const studentId = context.params.studentId;
    const newToken = change.after.val();
    // Only fire when a new token is set (not deleted)
    if (!newToken || typeof newToken !== "string")
        return;
    // Don't fire if token didn't actually change
    const oldToken = change.before.val();
    if (oldToken === newToken)
        return;
    console.log(`[CF] Student ${studentId} registered new FCM token`);
    try {
        await admin.messaging().send({
            token: newToken,
            notification: {
                title: "🔔 Notifications Enabled",
                body: "You'll receive alerts when your bus starts, approaches, and arrives at your stop.",
            },
            android: {
                priority: "high",
                notification: {
                    channelId: "bus_tracking",
                    icon: "ic_notification",
                    sound: "default",
                },
            },
        });
        console.log(`[CF] Welcome notification sent to student ${studentId}`);
    }
    catch (err) {
        console.error(`[CF] Failed to send welcome notification:`, err);
    }
});
//# sourceMappingURL=index.js.map