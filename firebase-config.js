import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, runTransaction, push, set, get, child, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBL32KwCkJqSe2KBAO1sbuWLl83s4Cn8lo",
  authDomain: "modulos-3d5de.firebaseapp.com",
  databaseURL: "https://modulos-3d5de-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "modulos-3d5de",
  storageBucket: "modulos-3d5de.firebasestorage.app",
  messagingSenderId: "803636782488",
  appId: "1:803636782488:web:736eef934ac4c08ee177ed",
  measurementId: "G-79YXV1JXY5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const analytics = getAnalytics(app);

export { auth, db, analytics, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, ref, runTransaction, push, set, get, child, update, onValue };
