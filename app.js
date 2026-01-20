// app.js
import { 
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
} from './firebase.js';
import { signUpUser, signInUser, logoutUser, setupAuthStateListener } from './auth.js';

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loadingSpinner = document.getElementById('loading-spinner');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authTabs = document.querySelectorAll('.auth-tab');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-message');
const todoInput = document.getElementById('todo-input');
const addTodoBtn = document.getElementById('add-todo-btn');
const todosList = document.getElementById('todos-list');
const emptyState = document.getElementById('empty-state');
const filterSelect = document.getElementById('filter-select');
const totalCount = document.getElementById('total-count');
const completedCount = document.getElementById('completed-count');
const pendingCount = document.getElementById('pending-count');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Global Variables
let currentFilter = 'all';
let unsubscribeTodos = null;

// Initialize App
function initApp() {
    // Show loading spinner initially
    showLoading();
    
    // Setup auth state listener
    setupAuthStateListener((user) => {
        hideLoading();
        
        if (user) {
            // User is logged in
            showApp();
            showToast(`${user.email} হিসাবে লগইন করা হয়েছে`, 'success');
            setupTodosListener(user.uid);
            welcomeMessage.textContent = `স্বাগতম, ${user.email}`;
        } else {
            // User is logged out
            showAuth();
        }
    });
    
    // Setup event listeners
    setupEventListeners();
}

// Setup Event Listeners
function setupEventListeners() {
    // Auth tabs
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchAuthTab(tabId);
        });
    });
    
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        showLoading();
        const result = await signInUser(email, password);
        hideLoading();
        
        if (result.success) {
            showToast('সফলভাবে লগইন করা হয়েছে!', 'success');
        } else {
            showToast(result.error, 'error');
        }
    });
    
    // Signup form
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (password !== confirmPassword) {
            showToast('পাসওয়ার্ড মিলছে না!', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে', 'error');
            return;
        }
        
        showLoading();
        const result = await signUpUser(email, password);
        hideLoading();
        
        if (result.success) {
            showToast('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!', 'success');
            switchAuthTab('login');
        } else {
            showToast(result.error, 'error');
        }
    });
    
    // Logout button
    logoutBtn.addEventListener('click', async () => {
        showLoading();
        const result = await logoutUser();
        hideLoading();
        
        if (result.success) {
            showToast('সফলভাবে লগআউট করা হয়েছে', 'success');
        }
    });
    
    // Add todo button
    addTodoBtn.addEventListener('click', addNewTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewTodo();
        }
    });
    
    // Filter select
    filterSelect.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderTodos();
    });
}

// Switch auth tabs
function switchAuthTab(tabId) {
    // Update active tab
    authTabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Show active form
    document.querySelectorAll('.auth-form').forEach(form => {
        if (form.id === `${tabId}-form`) {
            form.classList.add('active');
        } else {
            form.classList.remove('active');
        }
    });
    
    // Clear form inputs
    if (tabId === 'login') {
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('confirm-password').value = '';
    } else {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    }
}

// Show/Hide sections
function showAuth() {
    authSection.style.display = 'flex';
    appSection.classList.add('hidden');
}

function showApp() {
    authSection.style.display = 'none';
    appSection.classList.remove('hidden');
}

function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// Todo Management Functions
async function addNewTodo() {
    const title = todoInput.value.trim();
    
    if (!title) {
        showToast('দয়া করে একটি কাজ লিখুন', 'warning');
        return;
    }
    
    if (!auth.currentUser) {
        showToast('লগইন করুন একটি কাজ যোগ করতে', 'error');
        return;
    }
    
    try {
        const userId = auth.currentUser.uid;
        const todoId = Date.now().toString();
        const todoRef = doc(db, 'users', userId, 'todos', todoId);
        
        const todoData = {
            title: title,
            completed: false,
            createdAt: serverTimestamp()
        };
        
        await setDoc(todoRef, todoData);
        todoInput.value = '';
        showToast('কাজ যোগ করা হয়েছে!', 'success');
    } catch (error) {
        console.error('Error adding todo:', error);
        showToast('কাজ যোগ করতে সমস্যা হয়েছে', 'error');
    }
}

async function toggleTodoComplete(todoId, completed) {
    if (!auth.currentUser) return;
    
    try {
        const userId = auth.currentUser.uid;
        const todoRef = doc(db, 'users', userId, 'todos', todoId);
        
        await updateDoc(todoRef, {
            completed: !completed
        });
        
        showToast(`কাজ ${!completed ? 'সম্পন্ন' : 'বাকি'} তালিকায় সরানো হয়েছে`, 'success');
    } catch (error) {
        console.error('Error toggling todo:', error);
        showToast('কাজ আপডেট করতে সমস্যা হয়েছে', 'error');
    }
}

async function deleteTodo(todoId) {
    if (!auth.currentUser) return;
    
    if (!confirm('আপনি কি নিশ্চিত এই কাজটি মুছতে চান?')) {
        return;
    }
    
    try {
        const userId = auth.currentUser.uid;
        const todoRef = doc(db, 'users', userId, 'todos', todoId);
        
        await deleteDoc(todoRef);
        showToast('কাজ মুছে ফেলা হয়েছে', 'success');
    } catch (error) {
        console.error('Error deleting todo:', error);
        showToast('কাজ মুছতে সমস্যা হয়েছে', 'error');
    }
}

function startEditTodo(todoElement, todoId, currentTitle) {
    // Remove editing from any other todo
    document.querySelectorAll('.todo-item.editing').forEach(item => {
        item.classList.remove('editing');
        const contentDiv = item.querySelector('.todo-content');
        const editInput = item.querySelector('.edit-input');
        if (editInput) {
            contentDiv.innerHTML = `
                <div class="todo-text">${editInput.value}</div>
                <div class="todo-date">${item.querySelector('.todo-date').textContent}</div>
            `;
        }
    });
    
    // Set current todo to editing mode
    todoElement.classList.add('editing');
    const contentDiv = todoElement.querySelector('.todo-content');
    const dateText = todoElement.querySelector('.todo-date').textContent;
    
    contentDiv.innerHTML = `
        <input type="text" class="edit-input" value="${currentTitle}" maxlength="200">
        <div class="todo-date">${dateText}</div>
    `;
    
    const editInput = contentDiv.querySelector('.edit-input');
    editInput.focus();
    editInput.select();
    
    // Handle edit completion
    const finishEdit = async () => {
        const newTitle = editInput.value.trim();
        
        if (!newTitle) {
            deleteTodo(todoId);
            return;
        }
        
        if (newTitle === currentTitle) {
            cancelEdit(todoElement, currentTitle, dateText);
            return;
        }
        
        try {
            const userId = auth.currentUser.uid;
            const todoRef = doc(db, 'users', userId, 'todos', todoId);
            
            await updateDoc(todoRef, {
                title: newTitle
            });
            
            showToast('কাজ আপডেট করা হয়েছে', 'success');
        } catch (error) {
            console.error('Error updating todo:', error);
            showToast('কাজ আপডেট করতে সমস্যা হয়েছে', 'error');
            cancelEdit(todoElement, currentTitle, dateText);
        }
    };
    
    editInput.addEventListener('blur', finishEdit);
    editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishEdit();
        }
    });
}

function cancelEdit(todoElement, title, date) {
    todoElement.classList.remove('editing');
    const contentDiv = todoElement.querySelector('.todo-content');
    contentDiv.innerHTML = `
        <div class="todo-text">${title}</div>
        <div class="todo-date">${date}</div>
    `;
}

// Setup Firestore listener for todos
function setupTodosListener(userId) {
    // Unsubscribe from previous listener if exists
    if (unsubscribeTodos) {
        unsubscribeTodos();
    }
    
    const todosRef = collection(db, 'users', userId, 'todos');
    const todosQuery = query(todosRef, orderBy('createdAt', 'desc'));
    
    unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
        const todos = [];
        snapshot.forEach((doc) => {
            todos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Store todos globally and render
        window.todos = todos;
        renderTodos();
    }, (error) => {
        console.error('Error listening to todos:', error);
        showToast('ডেটা লোড করতে সমস্যা হয়েছে', 'error');
    });
}

// Render todos based on current filter
function renderTodos() {
    if (!window.todos) {
        todosList.innerHTML = '';
        emptyState.classList.remove('hidden');
        updateCounters(0, 0, 0);
        return;
    }
    
    // Filter todos
    let filteredTodos = window.todos;
    if (currentFilter === 'completed') {
        filteredTodos = window.todos.filter(todo => todo.completed);
    } else if (currentFilter === 'pending') {
        filteredTodos = window.todos.filter(todo => !todo.completed);
    }
    
    // Update counters
    const total = window.todos.length;
    const completed = window.todos.filter(todo => todo.completed).length;
    const pending = total - completed;
    updateCounters(total, completed, pending);
    
    // Render todos
    if (filteredTodos.length === 0) {
        todosList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    todosList.innerHTML = '';
    
    filteredTodos.forEach(todo => {
        const todoElement = createTodoElement(todo);
        todosList.appendChild(todoElement);
    });
}

// Create todo element
function createTodoElement(todo) {
    const div = document.createElement('div');
    div.className = 'todo-item';
    div.dataset.id = todo.id;
    
    // Format date
    let dateString = 'তারিখ নেই';
    if (todo.createdAt) {
        const date = todo.createdAt.toDate();
        dateString = date.toLocaleDateString('bn-BD', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    div.innerHTML = `
        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
        <div class="todo-content">
            <div class="todo-text ${todo.completed ? 'completed' : ''}">${todo.title}</div>
            <div class="todo-date">${dateString}</div>
        </div>
        <div class="todo-actions">
            <button class="btn btn-edit" title="এডিট করুন">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger" title="মুছুন">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Add event listeners
    const checkbox = div.querySelector('.todo-checkbox');
    const editBtn = div.querySelector('.btn-edit');
    const deleteBtn = div.querySelector('.btn-danger');
    
    checkbox.addEventListener('change', () => {
        toggleTodoComplete(todo.id, todo.completed);
    });
    
    editBtn.addEventListener('click', () => {
        startEditTodo(div, todo.id, todo.title);
    });
    
    deleteBtn.addEventListener('click', () => {
        deleteTodo(todo.id);
    });
    
    return div;
}

// Update counter display
function updateCounters(total, completed, pending) {
    totalCount.textContent = total;
    completedCount.textContent = completed;
    pendingCount.textContent = pending;
}

// Toast notification
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = 'toast';
    
    // Add type-based styling
    switch(type) {
        case 'success':
            toast.style.background = '#28a745';
            break;
        case 'error':
            toast.style.background = '#dc3545';
            break;
        case 'warning':
            toast.style.background = '#ffc107';
            break;
        default:
            toast.style.background = '#343a40';
    }
    
    toast.classList.remove('hidden');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);