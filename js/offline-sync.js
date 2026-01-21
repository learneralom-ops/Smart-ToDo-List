// js/offline-sync.js
import { 
    db,
    collection,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    writeBatch,
    getDocs,
    query,
    where
} from '../firebase-config.js';

export class OfflineSync {
    constructor(app) {
        this.app = app;
        this.isOnline = navigator.onLine;
        this.pendingChanges = [];
        this.isSyncing = false;
        this.syncInterval = null;
        this.maxRetries = 3;
        this.retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
        
        this.init();
    }
    
    async init() {
        this.loadPendingChanges();
        this.setupEventListeners();
        this.setupDatabase();
        
        // Start sync interval
        this.startSyncInterval();
        
        // Initial sync if online
        if (this.isOnline) {
            await this.syncData();
        }
    }
    
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus();
            this.syncData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus();
        });
        
        // Before page unload
        window.addEventListener('beforeunload', () => {
            this.savePendingChanges();
        });
    }
    
    setupDatabase() {
        if (!this.isIndexedDBSupported()) {
            console.warn('IndexedDB not supported, offline features limited');
            return;
        }
        
        this.openDatabase();
    }
    
    isIndexedDBSupported() {
        return 'indexedDB' in window;
    }
    
    openDatabase() {
        const request = indexedDB.open('SmartTodoDB', 1);
        
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log('IndexedDB opened successfully');
            
            // Load offline data
            this.loadOfflineData();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('tasks')) {
                const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                taskStore.createIndex('userId', 'userId', { unique: false });
                taskStore.createIndex('status', 'status', { unique: false });
                taskStore.createIndex('dueDate', 'dueDate', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('categories')) {
                const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
                categoryStore.createIndex('userId', 'userId', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('syncQueue')) {
                const syncStore = db.createObjectStore('syncQueue', { 
                    keyPath: 'id',
                    autoIncrement: true 
                });
                syncStore.createIndex('type', 'type', { unique: false });
                syncStore.createIndex('status', 'status', { unique: false });
            }
        };
    }
    
    async loadOfflineData() {
        if (!this.db) return;
        
        try {
            // Load tasks
            const tasks = await this.getAllFromStore('tasks');
            if (tasks.length > 0 && this.app.todoManager) {
                this.app.todoManager.tasks = tasks;
                this.app.ui?.updateTaskList(tasks);
            }
            
            // Load categories
            const categories = await this.getAllFromStore('categories');
            if (categories.length > 0 && this.app.todoManager) {
                this.app.todoManager.categories = categories;
                this.app.ui?.updateCategoryList(categories);
            }
            
            console.log(`Loaded ${tasks.length} tasks and ${categories.length} categories from offline storage`);
        } catch (error) {
            console.error('Error loading offline data:', error);
        }
    }
    
    // IndexedDB Operations
    async addToStore(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async updateInStore(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteFromStore(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getFromStore(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Sync Queue Management
    async queueSync(type, action, data) {
        const syncItem = {
            type,
            action,
            data,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
            lastError: null
        };
        
        // Save to IndexedDB
        if (this.db) {
            try {
                await this.addToStore('syncQueue', syncItem);
            } catch (error) {
                console.error('Error saving to sync queue:', error);
            }
        }
        
        // Also save to memory for quick access
        this.pendingChanges.push(syncItem);
        
        // Update UI
        this.updateSyncStatus();
        
        // Try to sync immediately if online
        if (this.isOnline && !this.isSyncing) {
            this.syncData();
        }
    }
    
    async syncData() {
        if (!this.isOnline || this.isSyncing) return;
        
        this.isSyncing = true;
        this.updateSyncStatus();
        
        try {
            // Get pending changes from IndexedDB
            const pendingItems = await this.getAllFromStore('syncQueue');
            
            if (pendingItems.length === 0) {
                this.isSyncing = false;
                this.updateSyncStatus();
                return;
            }
            
            console.log(`Syncing ${pendingItems.length} pending changes...`);
            
            // Process each pending change
            for (const item of pendingItems) {
                if (item.status === 'completed') continue;
                
                try {
                    await this.processSyncItem(item);
                    
                    // Mark as completed
                    item.status = 'completed';
                    await this.updateInStore('syncQueue', item);
                    
                    // Remove from memory array
                    const index = this.pendingChanges.findIndex(p => 
                        p.timestamp === item.timestamp && p.type === item.type
                    );
                    if (index !== -1) {
                        this.pendingChanges.splice(index, 1);
                    }
                    
                } catch (error) {
                    console.error(`Error syncing item ${item.type}:${item.action}:`, error);
                    
                    // Update retry count
                    item.retryCount = (item.retryCount || 0) + 1;
                    item.lastError = error.message;
                    
                    if (item.retryCount >= this.maxRetries) {
                        item.status = 'failed';
                        this.app.showToast(`সিঙ্ক ব্যর্থ: ${error.message}`, 'error');
                    }
                    
                    await this.updateInStore('syncQueue', item);
                }
            }
            
            // After sync, refresh data from server
            await this.refreshFromServer();
            
            console.log('Sync completed successfully');
            this.app.showToast('সকল ডেটা সিঙ্ক করা হয়েছে', 'success');
            
        } catch (error) {
            console.error('Error during sync:', error);
            this.app.showToast('সিঙ্ক ব্যর্থ হয়েছে', 'error');
        } finally {
            this.isSyncing = false;
            this.updateSyncStatus();
        }
    }
    
    async processSyncItem(item) {
        const { type, action, data } = item;
        const userId = this.app.auth?.currentUser?.uid;
        
        if (!userId) {
            throw new Error('User not authenticated');
        }
        
        switch (type) {
            case 'task':
                await this.syncTask(action, data, userId);
                break;
                
            case 'category':
                await this.syncCategory(action, data, userId);
                break;
                
            case 'user':
                await this.syncUser(action, data, userId);
                break;
                
            default:
                console.warn(`Unknown sync type: ${type}`);
        }
    }
    
    async syncTask(action, data, userId) {
        switch (action) {
            case 'add':
                const taskId = data.id || `offline_${Date.now()}`;
                const taskRef = doc(db, 'users', userId, 'tasks', taskId);
                
                await setDoc(taskRef, {
                    ...data,
                    id: taskId,
                    userId: userId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                break;
                
            case 'update':
                const { taskId: updateId, updates } = data;
                const updateRef = doc(db, 'users', userId, 'tasks', updateId);
                
                await updateDoc(updateRef, {
                    ...updates,
                    updatedAt: new Date().toISOString()
                });
                break;
                
            case 'delete':
                const deleteRef = doc(db, 'users', userId, 'tasks', data.taskId);
                await deleteDoc(deleteRef);
                break;
        }
    }
    
    async syncCategory(action, data, userId) {
        // Similar implementation for categories
        console.log('Syncing category:', action, data);
    }
    
    async syncUser(action, data, userId) {
        // Similar implementation for user data
        console.log('Syncing user:', action, data);
    }
    
    async refreshFromServer() {
        if (!this.app.auth?.currentUser) return;
        
        const userId = this.app.auth.currentUser.uid;
        
        try {
            // Refresh tasks
            const tasksRef = collection(db, 'users', userId, 'tasks');
            const tasksQuery = query(tasksRef);
            const tasksSnapshot = await getDocs(tasksQuery);
            
            const tasks = [];
            tasksSnapshot.forEach((doc) => {
                tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Update local storage
            if (this.app.todoManager) {
                this.app.todoManager.tasks = tasks;
                
                // Save to IndexedDB
                for (const task of tasks) {
                    await this.updateInStore('tasks', task);
                }
            }
            
            // Refresh categories
            const categoriesRef = collection(db, 'users', userId, 'categories');
            const categoriesQuery = query(categoriesRef);
            const categoriesSnapshot = await getDocs(categoriesQuery);
            
            const categories = [];
            categoriesSnapshot.forEach((doc) => {
                categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            if (this.app.todoManager) {
                this.app.todoManager.categories = categories;
                
                // Save to IndexedDB
                for (const category of categories) {
                    await this.updateInStore('categories', category);
                }
            }
            
            console.log(`Refreshed ${tasks.length} tasks and ${categories.length} categories from server`);
            
        } catch (error) {
            console.error('Error refreshing from server:', error);
        }
    }
    
    updateSyncStatus() {
        const statusElement = document.getElementById('sync-status');
        if (!statusElement) return;
        
        if (this.isSyncing) {
            statusElement.innerHTML = '<i class="fas fa-sync fa-spin"></i> <span>সিঙ্ক হচ্ছে...</span>';
            statusElement.className = 'sync-status syncing';
        } else if (this.pendingChanges.length > 0) {
            statusElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${this.pendingChanges.length} অপেক্ষমান</span>`;
            statusElement.className = 'sync-status pending';
        } else if (this.isOnline) {
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> <span>সিঙ্কড</span>';
            statusElement.className = 'sync-status online';
        } else {
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>অফলাইন</span>';
            statusElement.className = 'sync-status offline';
        }
    }
    
    startSyncInterval() {
        // Sync every 5 minutes if online
        this.syncInterval = setInterval(() => {
            if (this.isOnline && this.pendingChanges.length > 0) {
                this.syncData();
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    // Conflict Resolution
    async resolveConflict(localData, serverData) {
        // Simple conflict resolution: use the most recent update
        const localTime = new Date(localData.updatedAt || localData.createdAt || 0);
        const serverTime = new Date(serverData.updatedAt || serverData.createdAt || 0);
        
        if (localTime > serverTime) {
            return { resolved: localData, conflict: true };
        } else {
            return { resolved: serverData, conflict: true };
        }
    }
    
    // Data Backup and Restore
    async exportData() {
        try {
            const tasks = await this.getAllFromStore('tasks');
            const categories = await this.getAllFromStore('categories');
            
            const exportData = {
                tasks,
                categories,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `smart-todo-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.app.showToast('ডেটা এক্সপোর্ট করা হয়েছে', 'success');
            
        } catch (error) {
            console.error('Error exporting data:', error);
            this.app.showToast('এক্সপোর্ট ব্যর্থ', 'error');
        }
    }
    
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);
                    
                    // Validate import data
                    if (!importData.tasks || !importData.categories) {
                        throw new Error('Invalid backup file format');
                    }
                    
                    // Clear existing data
                    await this.clearLocalData();
                    
                    // Import tasks
                    for (const task of importData.tasks) {
                        await this.updateInStore('tasks', task);
                        
                        // Queue for sync
                        await this.queueSync('task', 'add', task);
                    }
                    
                    // Import categories
                    for (const category of importData.categories) {
                        await this.updateInStore('categories', category);
                        await this.queueSync('category', 'add', category);
                    }
                    
                    // Refresh UI
                    await this.loadOfflineData();
                    
                    this.app.showToast('ডেটা ইমপোর্ট করা হয়েছে', 'success');
                    resolve(true);
                    
                } catch (error) {
                    console.error('Error importing data:', error);
                    this.app.showToast('ইমপোর্ট ব্যর্থ', 'error');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('File read error'));
            };
            
            reader.readAsText(file);
        });
    }
    
    async clearLocalData() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction(['tasks', 'categories', 'syncQueue'], 'readwrite');
            
            await Promise.all([
                this.clearStore(transaction.objectStore('tasks')),
                this.clearStore(transaction.objectStore('categories')),
                this.clearStore(transaction.objectStore('syncQueue'))
            ]);
            
            this.pendingChanges = [];
            this.updateSyncStatus();
            
        } catch (error) {
            console.error('Error clearing local data:', error);
        }
    }
    
    clearStore(store) {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // Storage Management
    async getStorageUsage() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return null;
        }
        
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
            };
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return null;
        }
    }
    
    updateStorageDisplay() {
        this.getStorageUsage().then(usage => {
            if (!usage) return;
            
            const fillElement = document.getElementById('storage-fill');
            const textElement = document.getElementById('storage-text');
            
            if (fillElement && textElement) {
                const percentage = Math.min(usage.percentage, 100);
                fillElement.style.width = `${percentage}%`;
                
                const usageMB = (usage.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (usage.quota / (1024 * 1024)).toFixed(2);
                textElement.textContent = `${usageMB}MB / ${quotaMB}MB`;
            }
        });
    }
    
    // Utility Methods
    loadPendingChanges() {
        const saved = localStorage.getItem('pending_changes');
        if (saved) {
            try {
                this.pendingChanges = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading pending changes:', error);
                this.pendingChanges = [];
            }
        }
    }
    
    savePendingChanges() {
        localStorage.setItem('pending_changes', JSON.stringify(this.pendingChanges));
    }
    
    hasPendingChanges() {
        return this.pendingChanges.length > 0;
    }
    
    getPendingChangesCount() {
        return this.pendingChanges.length;
    }
    
    // Public Methods
    async forceSync() {
        await this.syncData();
    }
    
    async backupData() {
        return this.exportData();
    }
    
    async restoreData(file) {
        return this.importData(file);
    }
    
    async clearCache() {
        await this.clearLocalData();
        this.app.showToast('ক্যাশে পরিষ্কার করা হয়েছে', 'success');
    }
    
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            pendingChanges: this.pendingChanges.length,
            lastSync: new Date().toISOString()
        };
    }
}

export async function initOfflineSync(app) {
    const offlineSync = new OfflineSync(app);
    return offlineSync;
}