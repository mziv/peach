import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCpYQvMuw8cTwut9Fy2abOPzGWXgtkgk8Y",
  authDomain: "peach-clone.firebaseapp.com",
  projectId: "peach-clone",
  storageBucket: "peach-clone.firebasestorage.app",
  messagingSenderId: "889806133846",
  appId: "1:889806133846:web:083594786555c3c3d839f7",
  measurementId: "G-08VY6BESEF",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
