# 🔔 Firebase Cloud Functions - Background Notifications

This directory contains **Firebase Cloud Functions** that send push notifications to students **even when the app is closed or minimized** — just like professional apps like Uber, Swiggy, Zomato, etc.

## 🎯 Why Cloud Functions?

**Problem:** The original notification logic ran inside the React app. When the app was closed, JavaScript stopped running, so notifications stopped too.

**Solution:** Cloud Functions run on **Firebase's servers** (not on the student's phone). They watch the Firebase Realtime Database (RTDB) for bus state changes and send FCM push notifications to all affected students.

---

## 📦 Deployed Functions

### 1. **onBusRouteStateChange**
- **Trigger:** Fires when `buses/{busNumber}/routeState` changes in RTDB
- **Notifications:**
  - **"🚌 Bus Started!"** — when `routeState` changes from `not_started` → `in_progress`
  - **"✅ Trip Completed"** — when `routeState` changes from `in_progress` → `completed`
- **Recipients:** All students subscribed to the bus's route

### 2. **onBusCurrentStopChange**
- **Trigger:** Fires when `buses/{busNumber}/currentStop` changes in RTDB
- **Notifications:**
  - **"📍 Bus Approaching!"** — when bus is ONE stop before student's stop
  - **"🎯 Bus Arrived!"** — when bus reaches student's stop
  - **"⚠️ Bus Passed Your Stop"** — when bus moves past student's stop
- **Recipients:** Only students whose stop is affected

### 3. **onStudentTokenUpdate**
- **Trigger:** Fires when a student registers/updates their FCM token at `students/{studentId}/fcmToken`
- **Notifications:**
  - **"🔔 Notifications Enabled"** — welcome message confirming notifications are working
- **Recipients:** The student who just registered

---

## 🗂️ RTDB Data Structure

The Cloud Functions expect this structure in Firebase Realtime Database:

```
buses/
  {busNumber}/              # e.g., "BUS-002"
    location:
      lat: number
      lng: number
      routeId: string       # Firestore route document ID
      routeName: string
      routeState: string    # "not_started" | "in_progress" | "completed"
    routeState: string      # Primary field (can also be object with .state)
    currentStop:
      name: string
      order: number         # 1-based index
      stopId: string
      status: string
    stops:
      {stopId}:
        name: string
        order: number
        status: "pending" | "current" | "completed"

students/
  {studentId}/              # e.g., "abc123"
    fcmToken: string        # FCM device token
    routeId: string         # Firestore route document ID
    stopId: string          # Student's selected stop ID
```

---

## 🚀 Deployment

### First-time Setup
```bash
# Install dependencies
cd functions
npm install

# Build TypeScript
npm run build

# Login to Firebase (if not already logged in)
npx firebase login

# Deploy all functions
npx firebase deploy --only functions
```

### Update Existing Functions
```bash
cd functions
npm run build
npx firebase deploy --only functions
```

### Deploy a Single Function
```bash
npx firebase deploy --only functions:onBusRouteStateChange
```

---

## 🔍 Monitoring & Debugging

### View Logs in Real-time
```bash
npx firebase functions:log
```

### View Logs in Firebase Console
https://console.firebase.google.com/project/college-bus-tracking-903e7/functions/logs

### Test Locally (Emulator)
```bash
cd functions
npm run serve
```

---

## 📱 How It Works (End-to-End)

### 1. Student App Opens
- Student logs in → FCM token is generated
- Token is saved to RTDB at `students/{studentId}/fcmToken`
- **Cloud Function `onStudentTokenUpdate`** fires → sends welcome notification

### 2. Driver Starts Trip
- Driver taps "Start Trip" in driver app
- Driver app updates RTDB: `buses/BUS-002/routeState = "in_progress"`
- **Cloud Function `onBusRouteStateChange`** fires:
  1. Reads `buses/BUS-002/location.routeId` to find which route this bus serves
  2. Queries `students/` to find all students with matching `routeId`
  3. Sends **"🚌 Bus Started!"** FCM push to all their tokens
- **Student's phone receives notification** — even if app is closed!

### 3. Bus Reaches Stops
- Driver app updates RTDB: `buses/BUS-002/currentStop = { order: 3, name: "Main Gate", ... }`
- **Cloud Function `onBusCurrentStopChange`** fires:
  1. Finds all students on this route
  2. For each student, checks if bus is approaching/at/past their stop
  3. Sends personalized notifications to affected students

### 4. Trip Completes
- Driver taps "End Trip"
- Driver app updates RTDB: `buses/BUS-002/routeState = "completed"`
- **Cloud Function `onBusRouteStateChange`** fires → sends **"✅ Trip Completed"** to all students

---

## 🛡️ Security & Best Practices

### Token Cleanup
The functions automatically remove invalid FCM tokens when they encounter errors like:
- `messaging/invalid-registration-token`
- `messaging/registration-token-not-registered`

This keeps the database clean and prevents wasted API calls.

### Error Handling
- All FCM sends are wrapped in try-catch
- Errors are logged to Firebase Functions logs
- Individual token failures don't block other students from receiving notifications

### Performance
- Functions use **parallel Promise.all()** to send notifications to multiple students simultaneously
- Each function completes in < 2 seconds for typical loads

---

## 🔧 Troubleshooting

### "No notifications received on native app"
1. Check if FCM token is saved in RTDB:
   - Open Firebase Console → Realtime Database
   - Navigate to `students/{your-student-id}/fcmToken`
   - Should see a long token string starting with `f...` or `c...`

2. Check if Cloud Functions are deployed:
   ```bash
   npx firebase functions:list
   ```
   Should show 3 functions: `onBusRouteStateChange`, `onBusCurrentStopChange`, `onStudentTokenUpdate`

3. Check function logs for errors:
   ```bash
   npx firebase functions:log --only onBusRouteStateChange
   ```

### "Notifications work on web but not native"
- **Expected behavior!** Web and native use different notification systems:
  - **Web:** In-app code calls `showSystemNotification()` → browser's Notification API
  - **Native:** Cloud Functions send FCM → Android/iOS system displays notification

### "Getting duplicate notifications"
- Check that `Capacitor.isNativePlatform()` is correctly detecting native vs web
- In-app code should NOT call `showSystemNotification()` on native (Cloud Functions handle it)

---

## 📊 Cost Estimate

Firebase Cloud Functions pricing (as of 2024):
- **Free tier:** 2M invocations/month, 400K GB-seconds/month
- **Typical usage for this app:**
  - 1 trip/day × 3 functions × 50 students = ~150 invocations/day = 4,500/month
  - Well within free tier ✅

---

## 🎓 Learn More

- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [FCM Send Messages](https://firebase.google.com/docs/cloud-messaging/send-message)
- [RTDB Triggers](https://firebase.google.com/docs/functions/database-events)
