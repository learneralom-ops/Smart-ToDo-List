// js/app.js
import { initAuth } from './auth.js';
import { initTodoManager } from './todo-manager.js';
import { initAI } from './ai-features.js';
import { initNotifications } from './notification.js';
import { initOfflineSync } from './offline-sync.js';
import { initDashboard } from './dashboard.js';
import { initUI } from './ui-components.js';

class SmartTodoApp {
    constructor() {
        this.currentUser = null;
        this.tasks = [];
        this.categories = [];
        this.selectedTasks = new Set();
        this.isOnline = navigator.onLine;
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize all modules
            await this.initModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check online status
            this.setupOnlineStatus();
            
            // Show loading screen
            this.showLoading(false);
            
            console.log('Smart Todo Pro initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('অ্যাপ শুরু করতে সমস্যা হয়েছে');
        }
    }
    
    async initModules() {
        // Initialize authentication
        this.auth = await initAuth(this);
        
        // Initialize other modules
        this.todoManager = await initTodoManager(this);
        this.ai = await initAI(this);
        this.notifications = await initNotifications(this);
        this.offlineSync = await initOfflineSync(this);
        this.dashboard = await initDashboard(this);
        this.ui = await initUI(this);
    }
    
    setupEventListeners() {
        // Online/Offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Before unload
        window.addEventListener('beforeunload', () => this.beforeUnload());
    }
    
    setupOnlineStatus() {
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            statusElement.innerHTML = this.isOnline ? 
                '<i class="fas fa-wifi"></i> <span>অনলাইন</span>' :
                '<i class="fas fa-wifi-slash"></i> <span>অফলাইন</span>';
            
            statusElement.classList.toggle('online', this.isOnline);
            statusElement.classList.toggle('offline', !this.isOnline);
        }
    }
    
    handleOnline() {
        this.isOnline = true;
        this.setupOnlineStatus();
        this.offlineSync?.syncData();
        this.showToast('অনলাইনে ফিরে এসেছেন', 'success');
    }
    
    handleOffline() {
        this.isOnline = false;
        this.setupOnlineStatus();
        this.showToast('অফলাইন মোডে কাজ চলছে', 'warning');
    }
    
    beforeUnload() {
        // Save any pending data
        if (this.offlineSync?.hasPendingChanges()) {
            this.offlineSync.savePendingChanges();
        }
    }
    
    // Task Management Methods
    async addTask(taskData) {
        return this.todoManager?.addTask(taskData);
    }
    
    async updateTask(taskId, updates) {
        return this.todoManager?.updateTask(taskId, updates);
    }
    
    async deleteTask(taskId) {
        return this.todoManager?.deleteTask(taskId);
    }
    
    async toggleTaskComplete(taskId) {
        return this.todoManager?.toggleTaskComplete(taskId);
    }
    
    async getTasks(filter = {}) {
        return this.todoManager?.getTasks(filter);
    }
    
    async getTask(taskId) {
        return this.todoManager?.getTask(taskId);
    }
    
    // Category Management
    async addCategory(categoryData) {
        return this.todoManager?.addCategory(categoryData);
    }
    
    async getCategories() {
        return this.todoManager?.getCategories();
    }
    
    // AI Features
    async analyzeTaskText(text) {
        return this.ai?.analyzeTaskText(text);
    }
    
    async getPrioritySuggestion(taskData) {
        return this.ai?.getPrioritySuggestion(taskData);
    }
    
    async getProductivityAnalysis() {
        return this.ai?.getProductivityAnalysis();
    }
    
    // Dashboard Methods
    async getDashboardStats() {
        return this.dashboard?.getStats();
    }
    
    async getProductivityChartData(period = 7) {
        return this.dashboard?.getProductivityChartData(period);
    }
    
    // UI Methods
    showLoading(show = true) {
        this.ui?.showLoading(show);
    }
    
    showToast(message, type = 'info', duration = 3000) {
        this.ui?.showToast(message, type, duration);
    }
    
    showError(message) {
        this.ui?.showError(message);
    }
    
    showModal(modalId, data = null) {
        this.ui?.showModal(modalId, data);
    }
    
    hideModal(modalId) {
        this.ui?.hideModal(modalId);
    }
    
    // User Management
    setUser(user) {
        this.currentUser = user;
        this.ui?.updateUserInfo(user);
    }
    
    getUser() {
        return this.currentUser;
    }
    
    logout() {
        this.auth?.logout();
    }
    
    // Bulk Operations
    selectTask(taskId) {
        this.selectedTasks.add(taskId);
        this.updateBulkEditBar();
    }
    
    deselectTask(taskId) {
        this.selectedTasks.delete(taskId);
        this.updateBulkEditBar();
    }
    
    clearSelectedTasks() {
        this.selectedTasks.clear();
        this.updateBulkEditBar();
    }
    
    updateBulkEditBar() {
        this.ui?.updateBulkEditBar(this.selectedTasks.size);
    }
    
    async bulkCompleteTasks() {
        const tasks = Array.from(this.selectedTasks);
        await Promise.all(tasks.map(taskId => 
            this.updateTask(taskId, { status: 'completed' })
        ));
        this.clearSelectedTasks();
        this.showToast(`${tasks.length} টি কাজ সম্পন্ন করা হয়েছে`, 'success');
    }
    
    async bulkDeleteTasks() {
        const tasks = Array.from(this.selectedTasks);
        await Promise.all(tasks.map(taskId => this.deleteTask(taskId)));
        this.clearSelectedTasks();
        this.showToast(`${tasks.length} টি কাজ মুছে ফেলা হয়েছে`, 'success');
    }
    
    // Data Export/Import
    async exportData(format = 'json') {
        const data = {
            tasks: this.tasks,
            categories: this.categories,
            user: this.currentUser,
            exportedAt: new Date().toISOString()
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
    
    async importData(data) {
        // Implementation depends on data format
        console.log('Importing data:', data);
    }
    
    // Utility Methods
    formatDate(date, format = 'full') {
        const d = new Date(date);
        const options = {
            full: {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            },
            short: {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            },
            time: {
                hour: '2-digit',
                minute: '2-digit'
            }
        };
        
        return d.toLocaleDateString('bn-BD', options[format]);
    }
    
    calculateStreak(completedDates) {
        // Calculate consecutive days with completed tasks
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let streak = 0;
        let checkDate = new Date(today);
        
        while (completedDates.some(date => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === checkDate.getTime();
        })) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        return streak;
    }
}

// Initialize the app when DOM is loaded
let app;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = new SmartTodoApp();
        window.app = app; // Make app globally available for debugging
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div class="error-screen">
                <i class="fas fa-exclamation-triangle"></i>
                <h2>অ্যাপ লোড করতে সমস্যা হয়েছে</h2>
                <p>দয়া করে পৃষ্ঠাটি রিফ্রেশ করুন</p>
                <button onclick="window.location.reload()">রিফ্রেশ করুন</button>
            </div>
        `;
    }
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}