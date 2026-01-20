// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase কনফিগারেশন
const firebaseConfig = {
    apiKey: "AIzaSyAnR7VHIBMH9ssNta5sdnvN6gI2THL-Abk",
    authDomain: "smart-list-bceb7.firebaseapp.com",
    databaseURL: "https://smart-list-bceb7-default-rtdb.firebaseio.com",
    projectId: "smart-list-bceb7",
    storageBucket: "smart-list-bceb7.firebasestorage.app",
    messagingSenderId: "206199621650",
    appId: "1:206199621650:web:a1b32410696561632970cb"
};

// Firebase ইনিশিয়ালাইজ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// এক্সপোর্ট করি
export { 
    auth, 
    db, 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    serverTimestamp 
};