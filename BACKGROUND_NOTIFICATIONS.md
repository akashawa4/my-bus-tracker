# 🚀 Background Notifications Setup Guide

## ✅ What's Been Done

Your app now has **Firebase Cloud Functions** that send push notifications to students **even when the app is closed or minimized** — just like Uber, Swiggy, and other professional apps!

### Deployed Functions (Live on Firebase)
1. ✅ **onBusRouteStateChange** — sends "Bus Started!" and "Trip Completed" notifications
2. ✅ **onBusCurrentStopChange** — sends "Approaching", "Arrived", and "Passed" notifications
3. ✅ **onStudentTokenUpdate** — sends welcome notification when student registers

---

## 📱 How to Test

### 1. Build and Install the Android App
```bash
# Build the web app
npm run build

# Sync with Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

Then in Android Studio:
- Build → Make Project
- Run → Run 'app' on your device

### 2. Test the Notification Flow

**Step 1: Student Registers**
- Open the student app on your phone
- Log in with a student account
- Select a route and stop
- You should receive: **"🔔 Notifications Enabled"** notification

**Step 2: Driver Starts Trip**
- Open the driver app
- Start a trip on the same route
- Student should receive: **"🚌 Bus Started!"** notification (even if app is closed!)

**Step 3: Bus Approaches Student's Stop**
- Driver app updates bus location as it moves through stops
- When bus is 1 stop before student's stop: **"📍 Bus Approaching!"**
- When bus reaches student's stop: **"🎯 Bus Arrived!"**
- If bus passes student's stop: **"⚠️ Bus Passed Your Stop"**

**Step 4: Trip Completes**
- Driver ends the trip
- Student receives: **"✅ Trip Completed"**

---

## 🔍 Debugging

### Check if FCM Token is Saved
1. Open Firebase Console: https://console.firebase.google.com/project/college-bus-tracking-903e7/database
2. Navigate to **Realtime Database** → `students/{studentId}/fcmToken`
3. Should see a long token string (e.g., `fXyZ123...`)

### View Cloud Function Logs
```bash
# View all function logs
npx firebase functions:log

# View specific function logs
npx firebase functions:log --only onBusRouteStateChange
```

Or in Firebase Console:
https://console.firebase.google.com/project/college-bus-tracking-903e7/functions/logs

### Test Notifications Manually
In the student app, open Chrome DevTools (inspect the WebView) and run:
```javascript
window.testNativeNotification()
```

This sends a test notification directly to verify the FCM pipeline works.

---

## 🛠️ How It Works

### Before (In-App Notifications Only)
```
Student App (Open) → RTDB updates → React code → showSystemNotification()
Student App (Closed) → ❌ No notifications
```

### After (Cloud Functions)
```
Driver App → RTDB updates → Cloud Function (Firebase Server) → FCM Push → Student Phone
Works even when app is: ✅ Closed  ✅ Minimized  ✅ Background
```

### Architecture
1. **Driver app** writes bus data to RTDB (`buses/{busNumber}/`)
2. **Cloud Functions** watch RTDB for changes
3. When changes occur, Cloud Functions:
   - Find all students on that route (from `students/` in RTDB)
   - Send FCM push notifications to their tokens
4. **Android OS** displays the notification (using the `bus_tracking` channel)
5. **Student app** (if open) updates the in-app notification list

---

## 📊 What Changed in the Code

### New Files
- `functions/src/index.ts` — Cloud Functions code
- `functions/package.json` — Cloud Functions dependencies
- `firebase.json` — Firebase project config
- `.firebaserc` — Firebase project ID

### Modified Files
- `src/context/StudentContext.tsx`:
  - Added `Capacitor.isNativePlatform()` check
  - On **native**: only updates in-app notification list (Cloud Functions handle system notifications)
  - On **web**: still calls `showSystemNotification()` (no Cloud Functions for web)

### No Changes Needed
- ✅ Android `AndroidManifest.xml` — already configured correctly
- ✅ `MainActivity.java` — notification channel already created
- ✅ FCM token registration — already working

---

## 💰 Cost

**Free tier:** 2M function invocations/month
**Your usage:** ~4,500 invocations/month (well within free tier ✅)

---

## 🚨 Important Notes

### For Native (Android/iOS)
- System notifications are sent by **Cloud Functions** (server-side)
- In-app code only updates the notification list
- Works even when app is closed

### For Web
- System notifications are sent by **in-app code** (client-side)
- Uses browser's Notification API
- Only works when browser tab is open

### Driver App
- Make sure driver app updates RTDB correctly:
  - `buses/{busNumber}/routeState` → triggers "Bus Started" notification
  - `buses/{busNumber}/currentStop` → triggers stop-based notifications
  - `buses/{busNumber}/location.routeId` → links bus to route

---

## 📚 Next Steps

1. **Test thoroughly** on a physical Android device
2. **Monitor logs** during testing to see Cloud Functions firing
3. **Verify** notifications arrive when app is closed
4. **Deploy to production** when ready

For detailed documentation, see: `functions/README.md`
