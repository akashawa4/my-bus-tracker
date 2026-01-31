# Testing FCM Web Push Notifications

Follow these steps to test foreground, background, and (where supported) closed-tab notifications.

---

## Prerequisites

1. **Run the app**
   ```bash
   npm run dev
   ```
2. **Use a supported environment**
   - **localhost** works for development (Chrome, Firefox, Edge).
   - For **background/closed** notifications, use **HTTPS** in production or a tunnel (e.g. [ngrok](https://ngrok.com/)).

---

## Step 1: Get an FCM token (save to RTDB)

1. Open the app in the browser (e.g. `http://localhost:5173`).
2. **Log in** with a student account (e.g. `priya.sharma@college.edu` / `priya123`).
3. When the browser asks **“Allow notifications?”**, click **Allow**.
4. The app will save the FCM token to Realtime Database at:
   ```
   students/{studentId}/fcmToken
   ```
   - `studentId` = `student.studentId` or `student.id` (e.g. `"1"` if your student doc id is `"1"`).

5. **Confirm the token is saved**
   - Open [Firebase Console](https://console.firebase.google.com/) → your project → **Realtime Database**.
   - Go to **`students`** → your student key (e.g. `1`) → you should see **`fcmToken`** with a long string value.

6. **Optional: copy the token**
   - Copy the `fcmToken` value; you’ll need it for “Send test message” in the console or for a script.

---

## Step 2: Test foreground (app in focus)

1. Keep the app **open and focused** (tab in front).
2. Send a test message (see **Ways to send** below).
3. **Expected:** A **toast** appears inside the app (Sonner), with the notification title and body.

---

## Step 3: Test background (tab open but not focused)

1. **Minimize the window** or **switch to another tab** (leave the app tab open).
2. Send another test message.
3. **Expected:** A **system notification** (OS-level), with title and body, from the service worker.

---

## Step 4: Test with browser “closed” (optional)

1. **Close the tab** (or the whole browser, depending on OS).
2. Send a test message again.
3. **Expected (when supported):** Same system notification. Support depends on OS and browser (e.g. Chrome on desktop keeps the service worker alive for a while).

---

## Ways to send a test message

### Option A: Firebase Console (no code)

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Engage** → **Messaging** (or **Cloud Messaging**).
3. Click **“New campaign”** → **“Firebase Notification messages”**.
4. Enter **Notification title** and **Notification text**.
5. Click **“Send test message”**.
6. Paste the **FCM token** you copied from RTDB (`students/{studentId}/fcmToken`).
7. Send. You should see the toast (foreground) or system notification (background/closed).

### Option B: Node script (FCM HTTP v1)

Use the script in `scripts/send-fcm-test.js` (see below). It needs a **service account key** from Firebase:

1. Project **Settings** (gear) → **Service accounts** → **Generate new private key**.
2. Save the JSON file somewhere safe (e.g. `./service-account.json`) and **do not commit it**.

Then run:

```bash
node scripts/send-fcm-test.js <path-to-service-account.json> <fcm-token>
```

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| No permission prompt | Ensure you’re on **localhost** or **HTTPS**. Check browser settings for the site (e.g. Notifications allowed). |
| Token not in RTDB | Check browser console for errors. Ensure `studentId` is set (e.g. student logged in with `id` or `studentId`). |
| Foreground: no toast | Check console for FCM errors. Ensure Sonner `<Toaster />` is mounted (e.g. in `App.tsx`). |
| Background: no notification | Ensure **Allow** was clicked. Use **HTTPS** or localhost. Check that `/firebase-messaging-sw.js` loads (Network tab). |
| “Failed to get token” | Verify **VAPID key** (e.g. in Firebase Console → Project Settings → Cloud Messaging → Web Push certificates). |

---

## Quick checklist

- [ ] App running (`npm run dev`)
- [ ] Logged in as a student
- [ ] Notifications **Allowed**
- [ ] `students/{studentId}/fcmToken` present in RTDB
- [ ] Sent test message from Console (or script) to that token
- [ ] Foreground: toast appears
- [ ] Background: system notification appears
