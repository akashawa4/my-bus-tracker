# My Bus Tracker

A college bus tracking application for students.

## Project Info

This is a React-based web application for tracking college buses.

## How can I edit this code?

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Firebase

## How do I test FCM (push notifications)?

1. Run the app and log in as a student. When the browser asks, **allow** notifications.
2. In [Firebase Console](https://console.firebase.google.com/) → **Realtime Database**, confirm the token is saved at `students/{studentId}/fcmToken`.
3. **Firebase Console** → **Messaging** → **New campaign** → **Send test message** and paste that FCM token.
4. **Foreground:** keep the app tab focused → you should see an in-app toast.
5. **Background:** switch to another tab and send again → you should see a system notification.

For full steps and a Node script to send from the command line, see **[docs/TESTING_FCM.md](docs/TESTING_FCM.md)**.

## How can I deploy this project?

Build the project using:

```sh
npm run build
```

Then deploy the `dist` folder to your preferred hosting platform.
