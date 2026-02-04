// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBe12v3ULPNlAxapSZ1zu5eFoxxHzpY-rU",
  authDomain: "college-bus-tracking-903e7.firebaseapp.com",
  databaseURL: "https://college-bus-tracking-903e7-default-rtdb.firebaseio.com",
  projectId: "college-bus-tracking-903e7",
  storageBucket: "college-bus-tracking-903e7.firebasestorage.app",
  messagingSenderId: "898454276553",
  appId: "1:898454276553:web:f09ddeada5625dd04d4018",
  measurementId: "G-ST576M02S7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Realtime Database
export const rtdb = getDatabase(app);

export default app;