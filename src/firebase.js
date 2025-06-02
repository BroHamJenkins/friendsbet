// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0f-BfZ2QSZK5xV03Z34IXjohWVOYBJpU",
  authDomain: "friendsbet-6282a.firebaseapp.com",
  projectId: "friendsbet-6282a",
  storageBucket: "friendsbet-6282a.appspot.com",  // fix: changed .app to .appspot.com
  messagingSenderId: "586073881576",
  appId: "1:586073881576:web:f79f701b4209da43ae825d",
  measurementId: "G-7EF916ZDBE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { db };


