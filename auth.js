// auth.js
import { auth } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ইউজার সাইন আপ ফাংশন
export const signUpUser = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let errorMessage;
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'এই ইমেইলটি আগেই ব্যবহার করা হয়েছে';
                break;
            case 'auth/invalid-email':
                errorMessage = 'ভুল ইমেইল ফর্ম্যাট';
                break;
            case 'auth/weak-password':
                errorMessage = 'পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে';
                break;
            default:
                errorMessage = 'সাইন আপ ব্যর্থ হয়েছে';
        }
        return { success: false, error: errorMessage };
    }
};

// ইউজার লগইন ফাংশন
export const signInUser = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let errorMessage;
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'ইউজার পাওয়া যায়নি';
                break;
            case 'auth/wrong-password':
                errorMessage = 'ভুল পাসওয়ার্ড';
                break;
            case 'auth/invalid-email':
                errorMessage = 'ভুল ইমেইল ফর্ম্যাট';
                break;
            default:
                errorMessage = 'লগইন ব্যর্থ হয়েছে';
        }
        return { success: false, error: errorMessage };
    }
};

// লগআউট ফাংশন
export const logoutUser = async () => {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: 'লগআউট ব্যর্থ হয়েছে' };
    }
};

// অথ স্টেট লিসেনার
export const setupAuthStateListener = (callback) => {
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
};