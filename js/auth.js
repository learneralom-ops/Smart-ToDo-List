// js/auth.js
import { 
    auth,
    db,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc
} from '../firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

export class AuthManager {
    constructor(app) {
        this.app = app;
        this.currentUser = null;
        this.recaptchaVerifier = null;
        this.confirmationResult = null;
        
        this.init();
    }
    
    init() {
        this.setupAuthStateListener();
        this.setupEventListeners();
    }
    
    setupAuthStateListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile(user.uid);
                this.app.setUser(user);
                this.app.showApp();
                
                // Load user preferences
                await this.loadUserPreferences();
            } else {
                this.currentUser = null;
                this.app.showAuth();
            }
            
            this.app.showLoading(false);
        });
    }
    
    setupEventListeners() {
        // Email Login
        document.getElementById('email-login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailLogin();
        });
        
        // Email Signup
        document.getElementById('email-signup-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailSignup();
        });
        
        // Google Login
        document.getElementById('google-login-btn')?.addEventListener('click', () => {
            this.handleGoogleLogin();
        });
        
        // Phone Login
        document.getElementById('phone-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePhoneLogin();
        });
        
        // Forgot Password
        document.getElementById('reset-password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
        
        // Form Switching
        document.getElementById('show-signup')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('signup');
        });
        
        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });
        
        document.getElementById('phone-login-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('phone');
        });
        
        document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('forgot-password');
        });
        
        document.getElementById('back-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });
        
        document.getElementById('back-from-reset')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
        
        // Password visibility toggle
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const input = document.getElementById(targetId);
                const icon = this.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    }
    
    async handleEmailLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me')?.checked;
        
        if (!email || !password) {
            this.app.showToast('ইমেইল এবং পাসওয়ার্ড প্রয়োজন', 'error');
            return;
        }
        
        this.app.showLoading(true);
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Remember me functionality
            if (rememberMe) {
                localStorage.setItem('remember_email', email);
            } else {
                localStorage.removeItem('remember_email');
            }
            
            this.app.showToast('সফলভাবে লগইন করা হয়েছে!', 'success');
        } catch (error) {
            let errorMessage = 'লগইন ব্যর্থ হয়েছে';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'এই ইমেইলে কোন অ্যাকাউন্ট নেই';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'পাসওয়ার্ড ভুল';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'ভুল ইমেইল ফর্ম্যাট';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'বহুবার চেষ্টা করেছেন। পরে আবার চেষ্টা করুন';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'এই অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে';
                    break;
            }
            
            this.app.showToast(errorMessage, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async handleEmailSignup() {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validation
        if (!name || !email || !password || !confirmPassword) {
            this.app.showToast('সমস্ত তথ্য প্রয়োজন', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.app.showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.app.showToast('পাসওয়ার্ড মিলছে না', 'error');
            return;
        }
        
        this.app.showLoading(true);
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update profile with name
            await updateProfile(user, {
                displayName: name
            });
            
            // Create user profile in Firestore
            await this.createUserProfile(user.uid, {
                name: name,
                email: email,
                createdAt: new Date().toISOString(),
                preferences: {
                    theme: 'light',
                    language: 'bn',
                    notifications: true
                }
            });
            
            this.app.showToast('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!', 'success');
            this.showForm('login');
        } catch (error) {
            let errorMessage = 'সাইন আপ ব্যর্থ হয়েছে';
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'এই ইমেইলটি আগেই ব্যবহার করা হয়েছে';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'ভুল ইমেইল ফর্ম্যাট';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'সাইন আপ সিস্টেমে অক্ষম';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'পাসওয়ার্ড খুব দুর্বল';
                    break;
            }
            
            this.app.showToast(errorMessage, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async handleGoogleLogin() {
        this.app.showLoading(true);
        
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Check if user profile exists
            const profileExists = await this.checkUserProfile(user.uid);
            
            if (!profileExists) {
                // Create user profile
                await this.createUserProfile(user.uid, {
                    name: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString(),
                    preferences: {
                        theme: 'light',
                        language: 'bn',
                        notifications: true
                    }
                });
            }
            
            this.app.showToast('Google লগইন সফল!', 'success');
        } catch (error) {
            let errorMessage = 'Google লগইন ব্যর্থ';
            
            switch(error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = 'লগইন পপআপ বন্ধ করা হয়েছে';
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage = 'লগইন বাতিল করা হয়েছে';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'পপআপ ব্লক করা হয়েছে। পপআপ অনুমতি দিন';
                    break;
            }
            
            this.app.showToast(errorMessage, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async handlePhoneLogin() {
        const countryCode = document.getElementById('country-code').value;
        const phoneNumber = document.getElementById('phone-number').value;
        const otpCode = document.getElementById('otp-code').value;
        
        if (!phoneNumber) {
            this.app.showToast('ফোন নম্বর প্রয়োজন', 'error');
            return;
        }
        
        const fullPhoneNumber = countryCode + phoneNumber;
        
        this.app.showLoading(true);
        
        try {
            if (!this.confirmationResult) {
                // Send OTP
                if (!this.recaptchaVerifier) {
                    this.setupRecaptcha();
                }
                
                this.confirmationResult = await signInWithPhoneNumber(
                    auth,
                    fullPhoneNumber,
                    this.recaptchaVerifier
                );
                
                // Show OTP input
                document.querySelector('.otp-group').classList.remove('hidden');
                document.getElementById('phone-submit-btn').innerHTML = 
                    '<i class="fas fa-check"></i> OTP যাচাই করুন';
                
                this.app.showToast('OTP পাঠানো হয়েছে', 'success');
            } else {
                // Verify OTP
                if (!otpCode || otpCode.length !== 6) {
                    this.app.showToast('৬ ডিজিট OTP দিন', 'error');
                    return;
                }
                
                const result = await this.confirmationResult.confirm(otpCode);
                const user = result.user;
                
                // Check if user profile exists
                const profileExists = await this.checkUserProfile(user.uid);
                
                if (!profileExists) {
                    // Create user profile
                    await this.createUserProfile(user.uid, {
                        name: 'User',
                        phoneNumber: fullPhoneNumber,
                        createdAt: new Date().toISOString(),
                        preferences: {
                            theme: 'light',
                            language: 'bn',
                            notifications: true
                        }
                    });
                }
                
                // Reset form
                this.confirmationResult = null;
                document.querySelector('.otp-group').classList.add('hidden');
                document.getElementById('phone-submit-btn').innerHTML = 
                    '<i class="fas fa-paper-plane"></i> OTP পাঠান';
                
                this.app.showToast('ফোন লগইন সফল!', 'success');
            }
        } catch (error) {
            let errorMessage = 'ফোন লগইন ব্যর্থ';
            
            switch(error.code) {
                case 'auth/invalid-phone-number':
                    errorMessage = 'ভুল ফোন নম্বর ফর্ম্যাট';
                    break;
                case 'auth/invalid-verification-code':
                    errorMessage = 'ভুল OTP কোড';
                    this.confirmationResult = null;
                    break;
                case 'auth/code-expired':
                    errorMessage = 'OTP কোডের মেয়াদ শেষ';
                    this.confirmationResult = null;
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'বহুবার চেষ্টা করেছেন। পরে আবার চেষ্টা করুন';
                    break;
            }
            
            this.app.showToast(errorMessage, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async handleForgotPassword() {
        const email = document.getElementById('reset-email').value;
        
        if (!email) {
            this.app.showToast('ইমেইল প্রয়োজন', 'error');
            return;
        }
        
        this.app.showLoading(true);
        
        try {
            await sendPasswordResetEmail(auth, email);
            this.app.showToast('পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে', 'success');
            this.showForm('login');
        } catch (error) {
            let errorMessage = 'পাসওয়ার্ড রিসেট ব্যর্থ';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'এই ইমেইলে কোন অ্যাকাউন্ট নেই';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'ভুল ইমেইল ফর্ম্যাট';
                    break;
            }
            
            this.app.showToast(errorMessage, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async handleLogout() {
        try {
            await signOut(auth);
            this.app.showToast('সফলভাবে লগআউট করা হয়েছে', 'success');
            
            // Cleanup
            this.confirmationResult = null;
            this.recaptchaVerifier = null;
        } catch (error) {
            this.app.showToast('লগআউট ব্যর্থ হয়েছে', 'error');
        }
    }
    
    setupRecaptcha() {
        this.recaptchaVerifier = new RecaptchaVerifier(auth, 'phone-submit-btn', {
            'size': 'invisible',
            'callback': () => {
                // reCAPTCHA solved
            }
        });
    }
    
    async createUserProfile(userId, profileData) {
        try {
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, profileData);
            return true;
        } catch (error) {
            console.error('Error creating user profile:', error);
            return false;
        }
    }
    
    async loadUserProfile(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Update UI with user info
                document.getElementById('user-name').textContent = userData.name || 'User';
                document.getElementById('user-email').textContent = userData.email || '';
                
                if (userData.photoURL) {
                    document.getElementById('user-avatar').src = userData.photoURL;
                    document.getElementById('dropdown-avatar').src = userData.photoURL;
                }
                
                // Update welcome message
                document.getElementById('welcome-text').textContent = 
                    `স্বাগতম, ${userData.name}!`;
                
                return userData;
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
        
        return null;
    }
    
    async checkUserProfile(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            return userDoc.exists();
        } catch (error) {
            return false;
        }
    }
    
    async loadUserPreferences() {
        try {
            const userId = this.currentUser.uid;
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const preferences = userData.preferences || {};
                
                // Apply theme
                if (preferences.theme === 'dark') {
                    document.documentElement.classList.add('dark-mode');
                    document.getElementById('dark-mode-toggle').checked = true;
                }
                
                // Apply other preferences
                localStorage.setItem('user_preferences', JSON.stringify(preferences));
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }
    
    async updateUserProfile(updates) {
        try {
            const userId = this.currentUser.uid;
            const userRef = doc(db, 'users', userId);
            
            await updateDoc(userRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, error: error.message };
        }
    }
    
    async updateUserPreferences(preferences) {
        return this.updateUserProfile({ preferences });
    }
    
    showForm(formName) {
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        // Show selected form
        document.getElementById(`${formName}-form`).classList.add('active');
        
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        if (formName === 'login' || formName === 'signup') {
            document.querySelector(`.auth-tab[data-tab="${formName}"]`).classList.add('active');
        }
        
        // Reset phone form if going back to login
        if (formName === 'login') {
            this.confirmationResult = null;
            document.querySelector('.otp-group').classList.add('hidden');
            document.getElementById('phone-submit-btn').innerHTML = 
                '<i class="fas fa-paper-plane"></i> OTP পাঠান';
        }
    }
    
    // Public methods
    getUser() {
        return this.currentUser;
    }
    
    isAuthenticated() {
        return this.currentUser !== null;
    }
    
    async loginWithEmail(email, password) {
        return this.handleEmailLogin(email, password);
    }
    
    logout() {
        return this.handleLogout();
    }
}

export async function initAuth(app) {
    const authManager = new AuthManager(app);
    return authManager;
}