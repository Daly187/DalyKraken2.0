import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration (public - safe to commit)
const firebaseConfig = {
  apiKey: "AIzaSyDhZ5ZGz8-Y5fvZYX9jN8hZqRc1qZW0z8Y",
  authDomain: "dalydough.firebaseapp.com",
  projectId: "dalydough",
  storageBucket: "dalydough.firebasestorage.app",
  messagingSenderId: "446315539667",
  appId: "1:446315539667:web:abcdefgh123456789",
  databaseURL: "https://dalydough-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
