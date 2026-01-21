// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnR7VHIBMH9ssNta5sdnvN6gI2THL-Abk",
    authDomain: "smart-list-bceb7.firebaseapp.com",
    projectId: "smart-list-bceb7",
    storageBucket: "smart-list-bceb7.firebasestorage.app",
    messagingSenderId: "206199621650",
    appId: "1:206199621650:web:a1b32410696561632970cb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

export { app, auth, db, storage, messaging };
