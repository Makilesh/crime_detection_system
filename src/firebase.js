import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_fDAMlzCb4Zsnu2oJqsEZ6Ix3JPxbygQ",
  authDomain: "crime-detection-system-80b2c.firebaseapp.com",
  projectId: "crime-detection-system-80b2c",
  storageBucket: "crime-detection-system-80b2c.firebasestorage.app",
  messagingSenderId: "759557318802",
  appId: "1:759557318802:web:883b24d84f90b1d5b71e4b",
  measurementId: "G-ZHR6HQV193"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
