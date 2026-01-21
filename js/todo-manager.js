// js/todo-manager.js
import { 
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
    serverTimestamp,
    getDocs,
    writeBatch
} from '../firebase-config.js';

export class TodoManager {
    constructor(app) {
        this.app = app;
        this.tasks = [];
        this.categories = [];
        this.listeners = new Map();
        this.undoStack = [];
        this.maxUndoSteps = 10;
        
        this.init();
    }
    
    async init() {
        // Load categories from localStorage initially
        this.loadCategoriesFromStorage();
        
        // Set up real-time listeners when user is authenticated
        if (this.app.currentUser) {
            await this.setupListeners();
        }
    }
    
    async setupListeners() {
        const userId = this.app.currentUser.uid;
        
        // Tasks listener
        const tasksRef = collection(db, 'users', userId, 'tasks');
        const tasksQuery = query(
            tasksRef,
            orderBy('createdAt', 'desc')
        );
        
        const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
            this.tasks = [];
            snapshot.forEach((doc) => {
                this.tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Update UI
            this.app.ui?.updateTaskList(this.tasks);
            this.app.dashboard?.updateStats();
            
            // Save to local storage for offline access
            this.saveTasksToStorage();
        });
        
        this.listeners.set('tasks', unsubscribeTasks);
        
        // Categories listener
        const categoriesRef = collection(db, 'users', userId, 'categories');
        const categoriesQuery = query(categoriesRef, orderBy('createdAt'));
        
        const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
            this.categories = [];
            snapshot.forEach((doc) => {
                this.categories.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Update UI
            this.app.ui?.updateCategoryList(this.categories);
            this.saveCategoriesToStorage();
        });
        
        this.listeners.set('categories', unsubscribeCategories);
    }
    
    // Task CRUD Operations
    async addTask(taskData) {
        try {
            const userId = this.app.currentUser.uid;
            const taskId = Date.now().toString();
            
            const taskRef = doc(db, 'users', userId, 'tasks', taskId);
            
            const task = {
                ...taskData,
                id: taskId,
                userId: userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                important: taskData.important || false,
                status: taskData.status || 'pending',
                priority: taskData.priority || 'medium',
                completedAt: null
            };
            
            // Auto-detect due date from text if AI is enabled
            if (this.app.ai && !taskData.dueDate && taskData.title) {
                const aiAnalysis = await this.app.ai.analyzeTaskText(taskData.title);
                if (aiAnalysis.dueDate) {
                    task.dueDate = aiAnalysis.dueDate;
                }
                if (aiAnalysis.priority) {
                    task.priority = aiAnalysis.priority;
                }
            }
            
            await setDoc(taskRef, task);
            
            // Add to undo stack
            this.addToUndoStack({
                type: 'add',
                taskId: taskId,
                task: task
            });
            
            return { success: true, taskId };
        } catch (error) {
            console.error('Error adding task:', error);
            
            // Save to local storage for offline
            if (!this.app.isOnline) {
                this.saveTaskOffline(taskData);
                return { success: true, offline: true };
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async updateTask(taskId, updates) {
        try {
            const userId = this.app.currentUser.uid;
            const taskRef = doc(db, 'users', userId, 'tasks', taskId);
            
            // Get current task for undo
            const currentTask = this.tasks.find(t => t.id === taskId);
            if (currentTask) {
                this.addToUndoStack({
                    type: 'update',
                    taskId: taskId,
                    previous: { ...currentTask },
                    updates: updates
                });
            }
            
            await updateDoc(taskRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            
            // If marking as complete, set completedAt
            if (updates.status === 'completed') {
                await updateDoc(taskRef, {
                    completedAt: serverTimestamp()
                });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error updating task:', error);
            
            // Update locally for offline
            if (!this.app.isOnline) {
                this.updateTaskOffline(taskId, updates);
                return { success: true, offline: true };
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async deleteTask(taskId, permanent = false) {
        try {
            const userId = this.app.currentUser.uid;
            const taskRef = doc(db, 'users', userId, 'tasks', taskId);
            
            // Get task for undo
            const task = this.tasks.find(t => t.id === taskId);
            if (task && !permanent) {
                this.addToUndoStack({
                    type: 'delete',
                    taskId: taskId,
                    task: task
                });
            }
            
            if (permanent) {
                await deleteDoc(taskRef);
            } else {
                // Soft delete
                await updateDoc(taskRef, {
                    deleted: true,
                    deletedAt: serverTimestamp()
                });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting task:', error);
            
            // Delete locally for offline
            if (!this.app.isOnline) {
                this.deleteTaskOffline(taskId);
                return { success: true, offline: true };
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return { success: false };
        
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        return this.updateTask(taskId, { status: newStatus });
    }
    
    // Category Management
    async addCategory(categoryData) {
        try {
            const userId = this.app.currentUser.uid;
            const categoryId = Date.now().toString();
            
            const categoryRef = doc(db, 'users', userId, 'categories', categoryId);
            
            const category = {
                ...categoryData,
                id: categoryId,
                userId: userId,
                createdAt: serverTimestamp(),
                taskCount: 0
            };
            
            await setDoc(categoryRef, category);
            
            return { success: true, categoryId };
        } catch (error) {
            console.error('Error adding category:', error);
            
            // Save locally for offline
            if (!this.app.isOnline) {
                this.saveCategoryOffline(categoryData);
                return { success: true, offline: true };
            }
            
            return { success: false, error: error.message };
        }
    }
    
    async updateCategory(categoryId, updates) {
        try {
            const userId = this.app.currentUser.uid;
            const categoryRef = doc(db, 'users', userId, 'categories', categoryId);
            
            await updateDoc(categoryRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating category:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Task Filtering and Sorting
    getTasks(filter = {}) {
        let filteredTasks = [...this.tasks];
        
        // Apply filters
        if (filter.status) {
            filteredTasks = filteredTasks.filter(task => task.status === filter.status);
        }
        
        if (filter.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === filter.priority);
        }
        
        if (filter.category) {
            filteredTasks = filteredTasks.filter(task => task.category === filter.category);
        }
        
        if (filter.important) {
            filteredTasks = filteredTasks.filter(task => task.important);
        }
        
        if (filter.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (filter.dueDate === 'today') {
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    const dueDate = new Date(task.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate.getTime() === today.getTime();
                });
            } else if (filter.dueDate === 'overdue') {
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate || task.status === 'completed') return false;
                    const dueDate = new Date(task.dueDate);
                    return dueDate < today;
                });
            } else if (filter.dueDate === 'upcoming') {
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);
                
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate || task.status === 'completed') return false;
                    const dueDate = new Date(task.dueDate);
                    return dueDate > today && dueDate <= nextWeek;
                });
            }
        }
        
        // Apply sorting
        if (filter.sortBy) {
            filteredTasks.sort((a, b) => {
                switch (filter.sortBy) {
                    case 'dueDate':
                        if (!a.dueDate && !b.dueDate) return 0;
                        if (!a.dueDate) return 1;
                        if (!b.dueDate) return -1;
                        return new Date(a.dueDate) - new Date(b.dueDate);
                        
                    case 'priority':
                        const priorityOrder = { high: 3, medium: 2, low: 1 };
                        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
                        
                    case 'createdAt':
                        return new Date(b.createdAt) - new Date(a.createdAt);
                        
                    default:
                        return 0;
                }
            });
        }
        
        return filteredTasks;
    }
    
    getTask(taskId) {
        return this.tasks.find(task => task.id === taskId);
    }
    
    // Statistics
    getTaskStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.status === 'completed').length;
        const pending = this.tasks.filter(task => task.status === 'pending').length;
        const inProgress = this.tasks.filter(task => task.status === 'in-progress').length;
        const overdue = this.tasks.filter(task => {
            if (!task.dueDate || task.status === 'completed') return false;
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
        }).length;
        
        const important = this.tasks.filter(task => task.important).length;
        
        return {
            total,
            completed,
            pending,
            inProgress,
            overdue,
            important,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }
    
    // Undo System
    addToUndoStack(action) {
        this.undoStack.push(action);
        
        // Limit stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Update UI
        this.app.ui?.updateUndoButton(this.undoStack.length > 0);
    }
    
    async undoLastAction() {
        if (this.undoStack.length === 0) return;
        
        const action = this.undoStack.pop();
        
        try {
            switch (action.type) {
                case 'add':
                    await this.deleteTask(action.taskId, true);
                    break;
                    
                case 'update':
                    await this.updateTask(action.taskId, action.previous);
                    break;
                    
                case 'delete':
                    await this.addTask(action.task);
                    break;
            }
            
            this.app.showToast('পূর্বাবস্থায় ফিরে যাওয়া হয়েছে', 'success');
        } catch (error) {
            console.error('Error undoing action:', error);
            this.app.showToast('পূর্বাবস্থায় ফিরে যেতে সমস্যা হয়েছে', 'error');
        }
    }
    
    // Offline Support
    saveTaskOffline(taskData) {
        const offlineTasks = JSON.parse(localStorage.getItem('offline_tasks') || '[]');
        offlineTasks.push({
            ...taskData,
            id: Date.now().toString(),
            offline: true,
            createdAt: new Date().toISOString()
        });
        
        localStorage.setItem('offline_tasks', JSON.stringify(offlineTasks));
        this.app.offlineSync?.queueSync('task', 'add', taskData);
    }
    
    updateTaskOffline(taskId, updates) {
        // Update in local tasks
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveTasksToStorage();
        }
        
        // Queue for sync
        this.app.offlineSync?.queueSync('task', 'update', { taskId, updates });
    }
    
    deleteTaskOffline(taskId) {
        // Remove from local tasks
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasksToStorage();
        
        // Queue for sync
        this.app.offlineSync?.queueSync('task', 'delete', { taskId });
    }
    
    saveCategoryOffline(categoryData) {
        const offlineCategories = JSON.parse(localStorage.getItem('offline_categories') || '[]');
        offlineCategories.push({
            ...categoryData,
            id: Date.now().toString(),
            offline: true
        });
        
        localStorage.setItem('offline_categories', JSON.stringify(offlineCategories));
    }
    
    // Local Storage Management
    saveTasksToStorage() {
        try {
            localStorage.setItem('tasks_cache', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error saving tasks to storage:', error);
        }
    }
    
    loadTasksFromStorage() {
        try {
            const cached = localStorage.getItem('tasks_cache');
            if (cached) {
                this.tasks = JSON.parse(cached);
                return true;
            }
        } catch (error) {
            console.error('Error loading tasks from storage:', error);
        }
        return false;
    }
    
    saveCategoriesToStorage() {
        try {
            localStorage.setItem('categories_cache', JSON.stringify(this.categories));
        } catch (error) {
            console.error('Error saving categories to storage:', error);
        }
    }
    
    loadCategoriesFromStorage() {
        try {
            const cached = localStorage.getItem('categories_cache');
            if (cached) {
                this.categories = JSON.parse(cached);
                return true;
            }
        } catch (error) {
            console.error('Error loading categories from storage:', error);
        }
        return false;
    }
    
    // Cleanup
    cleanup() {
        // Unsubscribe all listeners
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners.clear();
        
        // Clear data
        this.tasks = [];
        this.categories = [];
        this.undoStack = [];
    }
}

export async function initTodoManager(app) {
    const todoManager = new TodoManager(app);
    return todoManager;
}