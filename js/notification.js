// js/notification.js
import { messaging } from '../firebase-config.js';
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js";

export class NotificationManager {
    constructor(app) {
        this.app = app;
        this.permission = null;
        this.notificationsEnabled = true;
        this.scheduledReminders = new Map();
        this.audioContext = null;
        this.notificationSound = null;
        
        this.init();
    }
    
    async init() {
        this.loadPreferences();
        
        // Request notification permission
        if ('Notification' in window) {
            this.permission = Notification.permission;
            
            if (this.permission === 'default') {
                // Request permission later when user interacts
                this.setupPermissionRequest();
            }
        }
        
        // Setup Firebase Cloud Messaging
        if ('serviceWorker' in navigator && messaging) {
            await this.setupFCM();
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup audio for notification sounds
        this.setupAudio();
        
        // Check for scheduled reminders
        this.checkScheduledReminders();
    }
    
    loadPreferences() {
        const prefs = JSON.parse(localStorage.getItem('notification_preferences') || '{}');
        this.notificationsEnabled = prefs.enabled !== false;
        this.soundEnabled = prefs.sound !== false;
        this.vibrationEnabled = prefs.vibration !== false;
        this.reminderTime = prefs.reminderTime || '09:00';
        this.silentMode = prefs.silentMode || { enabled: false, start: '22:00', end: '08:00' };
    }
    
    savePreferences() {
        const prefs = {
            enabled: this.notificationsEnabled,
            sound: this.soundEnabled,
            vibration: this.vibrationEnabled,
            reminderTime: this.reminderTime,
            silentMode: this.silentMode
        };
        
        localStorage.setItem('notification_preferences', JSON.stringify(prefs));
    }
    
    setupPermissionRequest() {
        // Show permission request button in settings
        const requestBtn = document.getElementById('request-notification-permission');
        if (requestBtn) {
            requestBtn.addEventListener('click', () => {
                this.requestPermission();
            });
        }
    }
    
    async requestPermission() {
        if (!('Notification' in window)) {
            this.app.showToast('ব্রাউজার নোটিফিকেশন সাপোর্ট করে না', 'error');
            return;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                this.app.showToast('নোটিফিকেশন অনুমতি প্রদান করা হয়েছে', 'success');
                await this.setupFCM();
            } else if (permission === 'denied') {
                this.app.showToast('নোটিফিকেশন অনুমতি প্রত্যাখ্যান করা হয়েছে', 'warning');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            this.app.showToast('নোটিফিকেশন অনুমতি চাওয়া ব্যর্থ', 'error');
        }
    }
    
    async setupFCM() {
        if (!messaging) return;
        
        try {
            // Get FCM token
            const token = await getToken(messaging, {
                vapidKey: 'YOUR_VAPID_KEY_HERE' // Add your VAPID key
            });
            
            if (token) {
                console.log('FCM Token:', token);
                await this.saveFCMToken(token);
            } else {
                console.log('No registration token available');
            }
            
            // Handle incoming messages
            onMessage(messaging, (payload) => {
                console.log('Message received:', payload);
                this.handlePushNotification(payload);
            });
            
        } catch (error) {
            console.error('Error setting up FCM:', error);
        }
    }
    
    async saveFCMToken(token) {
        // Save token to user's profile in Firestore
        if (this.app.auth?.currentUser) {
            const userId = this.app.auth.currentUser.uid;
            await this.app.auth.updateUserProfile({
                fcmToken: token,
                fcmTokenUpdatedAt: new Date().toISOString()
            });
        }
    }
    
    setupEventListeners() {
        // Toggle notification settings
        const toggleBtn = document.getElementById('toggle-notifications');
        if (toggleBtn) {
            toggleBtn.addEventListener('change', (e) => {
                this.notificationsEnabled = e.target.checked;
                this.savePreferences();
                
                if (this.notificationsEnabled) {
                    this.app.showToast('নোটিফিকেশন সক্রিয় করা হয়েছে', 'success');
                } else {
                    this.app.showToast('নোটিফিকেশন নিষ্ক্রিয় করা হয়েছে', 'info');
                }
            });
        }
        
        // Sound toggle
        const soundToggle = document.getElementById('toggle-notification-sound');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                this.soundEnabled = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Vibration toggle
        const vibrationToggle = document.getElementById('toggle-notification-vibration');
        if (vibrationToggle) {
            vibrationToggle.addEventListener('change', (e) => {
                this.vibrationEnabled = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Reminder time
        const reminderTimeInput = document.getElementById('reminder-time');
        if (reminderTimeInput) {
            reminderTimeInput.value = this.reminderTime;
            reminderTimeInput.addEventListener('change', (e) => {
                this.reminderTime = e.target.value;
                this.savePreferences();
                this.rescheduleDailyReminder();
            });
        }
        
        // Silent mode
        const silentModeToggle = document.getElementById('toggle-silent-mode');
        if (silentModeToggle) {
            silentModeToggle.checked = this.silentMode.enabled;
            silentModeToggle.addEventListener('change', (e) => {
                this.silentMode.enabled = e.target.checked;
                this.savePreferences();
            });
        }
        
        // Silent mode start time
        const silentStartInput = document.getElementById('silent-mode-start');
        if (silentStartInput) {
            silentStartInput.value = this.silentMode.start;
            silentStartInput.addEventListener('change', (e) => {
                this.silentMode.start = e.target.value;
                this.savePreferences();
            });
        }
        
        // Silent mode end time
        const silentEndInput = document.getElementById('silent-mode-end');
        if (silentEndInput) {
            silentEndInput.value = this.silentMode.end;
            silentEndInput.addEventListener('change', (e) => {
                this.silentMode.end = e.target.value;
                this.savePreferences();
            });
        }
    }
    
    setupAudio() {
        try {
            if (window.AudioContext || window.webkitAudioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (error) {
            console.error('Error setting up audio:', error);
        }
    }
    
    playNotificationSound() {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }
    
    vibrate(pattern = [100, 50, 100]) {
        if (!this.vibrationEnabled || !navigator.vibrate) return;
        
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.error('Error with vibration:', error);
        }
    }
    
    isInSilentMode() {
        if (!this.silentMode.enabled) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMinute] = this.silentMode.start.split(':').map(Number);
        const [endHour, endMinute] = this.silentMode.end.split(':').map(Number);
        
        const silentStart = startHour * 60 + startMinute;
        const silentEnd = endHour * 60 + endMinute;
        
        if (silentStart <= silentEnd) {
            return currentTime >= silentStart && currentTime < silentEnd;
        } else {
            //跨越午夜的情况
            return currentTime >= silentStart || currentTime < silentEnd;
        }
    }
    
    async showNotification(title, options = {}) {
        if (!this.notificationsEnabled || this.isInSilentMode()) return;
        
        // Check permission
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        const defaultOptions = {
            body: '',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: 'smart-todo',
            renotify: true,
            requireInteraction: false,
            silent: !this.soundEnabled,
            vibrate: this.vibrationEnabled ? [100, 50, 100] : undefined,
            data: {
                url: window.location.href,
                timestamp: Date.now()
            },
            actions: [
                {
                    action: 'view',
                    title: 'দেখুন'
                },
                {
                    action: 'dismiss',
                    title: 'বন্ধ করুন'
                }
            ]
        };
        
        const notificationOptions = { ...defaultOptions, ...options };
        
        try {
            const notification = new Notification(title, notificationOptions);
            
            // Play sound if enabled
            if (this.soundEnabled) {
                this.playNotificationSound();
            }
            
            // Vibrate if enabled
            if (this.vibrationEnabled) {
                this.vibrate();
            }
            
            // Handle notification click
            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                notification.close();
                
                if (notificationOptions.data?.url) {
                    window.location.href = notificationOptions.data.url;
                }
                
                // Handle custom actions
                if (notificationOptions.data?.action) {
                    this.handleNotificationAction(notificationOptions.data.action);
                }
            };
            
            // Handle notification close
            notification.onclose = () => {
                console.log('Notification closed');
            };
            
            // Auto-close after 10 seconds if not interactive
            if (!notificationOptions.requireInteraction) {
                setTimeout(() => {
                    notification.close();
                }, 10000);
            }
            
            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
            
            // Fallback to toast notification
            this.app.showToast(title, 'info');
        }
    }
    
    handleNotificationAction(action) {
        switch (action) {
            case 'complete_task':
                // Mark task as complete
                if (action.taskId) {
                    this.app.todoManager?.toggleTaskComplete(action.taskId);
                }
                break;
                
            case 'snooze_task':
                // Snooze task for 1 hour
                if (action.taskId) {
                    const newDueDate = new Date(Date.now() + 60 * 60 * 1000);
                    this.app.todoManager?.updateTask(action.taskId, {
                        dueDate: newDueDate.toISOString()
                    });
                }
                break;
                
            case 'view_task':
                // Open task details
                if (action.taskId) {
                    this.app.ui?.showTaskDetails(action.taskId);
                }
                break;
        }
    }
    
    handlePushNotification(payload) {
        const { title, body, icon, data } = payload.notification || payload.data || {};
        
        this.showNotification(title || 'Smart Todo Pro', {
            body: body || 'নতুন নোটিফিকেশন',
            icon: icon || '/icons/icon-192.png',
            data: data || {}
        });
    }
    
    // Task Reminder System
    async scheduleTaskReminder(task) {
        if (!task.dueDate && !task.reminderTime) return;
        
        const reminderId = `reminder_${task.id}`;
        
        // Clear existing reminder
        this.cancelReminder(reminderId);
        
        const dueDate = new Date(task.dueDate);
        const reminderTime = task.reminderTime ? new Date(task.reminderTime) : dueDate;
        
        // Schedule reminder 1 hour before due time
        const reminderDateTime = new Date(reminderTime.getTime() - 60 * 60 * 1000);
        const now = new Date();
        
        // Don't schedule if reminder is in the past
        if (reminderDateTime <= now) return;
        
        const delay = reminderDateTime.getTime() - now.getTime();
        
        const timeoutId = setTimeout(() => {
            this.sendTaskReminder(task);
        }, delay);
        
        this.scheduledReminders.set(reminderId, timeoutId);
        
        console.log(`Reminder scheduled for task ${task.id} in ${Math.round(delay/1000/60)} minutes`);
    }
    
    async sendTaskReminder(task) {
        const title = 'কাজের রিমাইন্ডার ⏰';
        const body = `"${task.title}" - ${this.formatReminderTime(task.dueDate)}`;
        
        const options = {
            body: body,
            tag: `task_reminder_${task.id}`,
            requireInteraction: true,
            data: {
                taskId: task.id,
                action: 'view_task'
            },
            actions: [
                {
                    action: 'complete_task',
                    title: 'সম্পন্ন করুন',
                    taskId: task.id
                },
                {
                    action: 'snooze_task',
                    title: '1 ঘন্টা পরে',
                    taskId: task.id
                }
            ]
        };
        
        await this.showNotification(title, options);
        
        // Remove from scheduled reminders
        this.scheduledReminders.delete(`reminder_${task.id}`);
    }
    
    cancelReminder(reminderId) {
        const timeoutId = this.scheduledReminders.get(reminderId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.scheduledReminders.delete(reminderId);
        }
    }
    
    cancelAllReminders() {
        for (const [id, timeoutId] of this.scheduledReminders) {
            clearTimeout(timeoutId);
        }
        this.scheduledReminders.clear();
    }
    
    formatReminderTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        
        const minutes = Math.round(diff / (1000 * 60));
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        
        if (minutes <= 0) {
            return 'সময় শেষ!';
        } else if (minutes < 60) {
            return `${minutes} মিনিট বাকি`;
        } else if (hours < 24) {
            return `${hours} ঘন্টা বাকি`;
        } else {
            return `${days} দিন বাকি`;
        }
    }
    
    // Daily Reminder System
    scheduleDailyReminder() {
        const [hour, minute] = this.reminderTime.split(':').map(Number);
        const now = new Date();
        const reminderTime = new Date();
        
        reminderTime.setHours(hour, minute, 0, 0);
        
        // If reminder time has passed for today, schedule for tomorrow
        if (reminderTime <= now) {
            reminderTime.setDate(reminderTime.getDate() + 1);
        }
        
        const delay = reminderTime.getTime() - now.getTime();
        
        // Clear existing daily reminder
        const existingReminder = this.scheduledReminders.get('daily_reminder');
        if (existingReminder) {
            clearTimeout(existingReminder);
        }
        
        const timeoutId = setTimeout(() => {
            this.sendDailyReminder();
            // Schedule next day's reminder
            this.scheduleDailyReminder();
        }, delay);
        
        this.scheduledReminders.set('daily_reminder', timeoutId);
        
        console.log(`Daily reminder scheduled for ${this.reminderTime}`);
    }
    
    rescheduleDailyReminder() {
        this.cancelReminder('daily_reminder');
        this.scheduleDailyReminder();
    }
    
    async sendDailyReminder() {
        if (!this.app.todoManager) return;
        
        const todayTasks = this.app.todoManager.getTasks({
            dueDate: 'today',
            status: 'pending'
        });
        
        const overdueTasks = this.app.todoManager.getTasks({
            dueDate: 'overdue',
            status: 'pending'
        });
        
        let body = '';
        
        if (overdueTasks.length > 0) {
            body += `মেয়াদোত্তীর্ণ: ${overdueTasks.length} টি কাজ\n`;
        }
        
        if (todayTasks.length > 0) {
            body += `আজকের: ${todayTasks.length} টি কাজ`;
        }
        
        if (body === '') {
            body = 'আজকের জন্য কোন কাজ নেই!';
        }
        
        const title = 'দৈনিক পরিকল্পনা 📅';
        
        const options = {
            body: body,
            tag: 'daily_reminder',
            requireInteraction: false,
            data: {
                action: 'view_dashboard'
            }
        };
        
        await this.showNotification(title, options);
    }
    
    // Overdue Task Alerts
    async checkOverdueTasks() {
        if (!this.app.todoManager) return;
        
        const overdueTasks = this.app.todoManager.getTasks({
            dueDate: 'overdue',
            status: 'pending'
        });
        
        if (overdueTasks.length > 0) {
            const title = 'মেয়াদোত্তীর্ণ কাজ ⚠️';
            const body = `${overdueTasks.length} টি কাজের সময় শেষ হয়েছে`;
            
            const options = {
                body: body,
                tag: 'overdue_alert',
                requireInteraction: true,
                data: {
                    action: 'view_overdue'
                }
            };
            
            await this.showNotification(title, options);
        }
    }
    
    // Check scheduled reminders on startup
    checkScheduledReminders() {
        // This would check for reminders that should have fired while the app was closed
        // For now, we'll just reschedule daily reminder
        this.scheduleDailyReminder();
        
        // Check for overdue tasks every hour
        setInterval(() => {
            this.checkOverdueTasks();
        }, 60 * 60 * 1000); // 1 hour
    }
    
    // Public methods
    async enableNotifications(enabled = true) {
        this.notificationsEnabled = enabled;
        this.savePreferences();
        
        if (enabled && this.permission !== 'granted') {
            await this.requestPermission();
        }
        
        if (enabled) {
            this.scheduleDailyReminder();
        } else {
            this.cancelAllReminders();
        }
        
        return enabled;
    }
    
    async showTaskReminder(task) {
        return this.sendTaskReminder(task);
    }
    
    async scheduleReminderForTask(task) {
        return this.scheduleTaskReminder(task);
    }
    
    async showSuccessNotification(message) {
        return this.showNotification('সফল হয়েছে ✅', {
            body: message,
            icon: '/icons/success.png'
        });
    }
    
    async showErrorNotification(message) {
        return this.showNotification('ত্রুটি হয়েছে ❌', {
            body: message,
            icon: '/icons/error.png'
        });
    }
    
    async showInfoNotification(message) {
        return this.showNotification('ম información', {
            body: message,
            icon: '/icons/info.png'
        });
    }
}

export async function initNotifications(app) {
    const notifications = new NotificationManager(app);
    return notifications;
}