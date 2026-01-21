// js/ui-components.js
export class UIComponents {
    constructor(app) {
        this.app = app;
        this.currentView = 'dashboard';
        this.modals = new Map();
        this.toasts = [];
        this.maxToasts = 5;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupCalendar();
        this.setupTheme();
    }
    
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const closeSidebar = document.getElementById('close-sidebar');
        const sidebar = document.getElementById('sidebar');
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }
        
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }
        
        // Menu item clicks
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
                
                // Update active state
                document.querySelectorAll('.menu-item').forEach(i => {
                    i.classList.remove('active');
                });
                item.classList.add('active');
                
                // Close sidebar on mobile
                if (window.innerWidth < 768) {
                    sidebar.classList.remove('active');
                }
            });
        });
        
        // Add task button
        const addTaskBtn = document.getElementById('add-task-btn');
        const floatingAddBtn = document.getElementById('floating-add-btn');
        
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                this.showTaskModal();
            });
        }
        
        if (floatingAddBtn) {
            floatingAddBtn.addEventListener('click', () => {
                this.showTaskModal();
            });
        }
        
        // Task modal
        const closeTaskModal = document.getElementById('close-task-modal');
        const cancelTaskBtn = document.getElementById('cancel-task-btn');
        
        if (closeTaskModal) {
            closeTaskModal.addEventListener('click', () => {
                this.hideModal('task-modal');
            });
        }
        
        if (cancelTaskBtn) {
            cancelTaskBtn.addEventListener('click', () => {
                this.hideModal('task-modal');
            });
        }
        
        // Task form submission
        const taskForm = document.getElementById('task-form');
        if (taskForm) {
            taskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleTaskFormSubmit();
            });
        }
        
        // Priority buttons
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const priority = btn.dataset.priority;
                this.setPriority(priority);
            });
        });
        
        // Bulk edit buttons
        const bulkEditBtn = document.getElementById('bulk-edit-btn');
        if (bulkEditBtn) {
            bulkEditBtn.addEventListener('click', () => {
                this.toggleBulkEditMode();
            });
        }
        
        const bulkCompleteBtn = document.getElementById('bulk-complete');
        if (bulkCompleteBtn) {
            bulkCompleteBtn.addEventListener('click', () => {
                this.app.bulkCompleteTasks();
            });
        }
        
        const bulkDeleteBtn = document.getElementById('bulk-delete');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                this.app.bulkDeleteTasks();
            });
        }
        
        const bulkCancelBtn = document.getElementById('bulk-cancel');
        if (bulkCancelBtn) {
            bulkCancelBtn.addEventListener('click', () => {
                this.toggleBulkEditMode(false);
            });
        }
        
        // Undo delete
        const undoDeleteBtn = document.getElementById('undo-delete-btn');
        if (undoDeleteBtn) {
            undoDeleteBtn.addEventListener('click', () => {
                this.app.todoManager?.undoLastAction();
                this.hideUndoToast();
            });
        }
        
        // Search functionality
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
            
            const clearSearch = document.querySelector('.clear-search');
            if (clearSearch) {
                clearSearch.addEventListener('click', () => {
                    searchInput.value = '';
                    this.handleSearch('');
                    clearSearch.classList.add('hidden');
                });
                
                searchInput.addEventListener('input', () => {
                    clearSearch.classList.toggle('hidden', !searchInput.value);
                });
            }
        }
        
        // Filter changes
        const priorityFilter = document.getElementById('priority-filter');
        const statusFilter = document.getElementById('status-filter');
        
        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        // Calendar view
        const calendarViewBtn = document.getElementById('calendar-view-btn');
        if (calendarViewBtn) {
            calendarViewBtn.addEventListener('click', () => {
                this.switchView('calendar');
            });
        }
    }
    
    setupDragAndDrop() {
        const tasksContainer = document.getElementById('tasks-container');
        if (!tasksContainer) return;
        
        let draggedTask = null;
        
        tasksContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-item')) {
                draggedTask = e.target;
                e.target.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            }
        });
        
        tasksContainer.addEventListener('dragend', (e) => {
            if (draggedTask) {
                draggedTask.style.opacity = '';
                draggedTask = null;
            }
        });
        
        tasksContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = this.getDragAfterElement(tasksContainer, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (draggable) {
                if (afterElement == null) {
                    tasksContainer.appendChild(draggable);
                } else {
                    tasksContainer.insertBefore(draggable, afterElement);
                }
            }
        });
        
        // Add drag handle to task items
        this.setupTaskDragHandles();
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    setupTaskDragHandles() {
        // This would be called when tasks are rendered
        // to add drag handles to each task
    }
    
    setupCalendar() {
        const calendarContainer = document.getElementById('calendar');
        if (!calendarContainer) return;
        
        // This would initialize the calendar view
        // For now, we'll set up the navigation
        const prevMonthBtn = document.getElementById('prev-month');
        const nextMonthBtn = document.getElementById('next-month');
        const currentMonthEl = document.getElementById('current-month');
        
        let currentDate = new Date();
        
        if (prevMonthBtn && nextMonthBtn && currentMonthEl) {
            const updateCalendar = () => {
                const month = currentDate.toLocaleDateString('bn-BD', { 
                    month: 'long', 
                    year: 'numeric' 
                });
                currentMonthEl.textContent = month;
                
                // Here you would generate the calendar grid
                this.generateCalendar(currentDate, calendarContainer);
            };
            
            prevMonthBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() - 1);
                updateCalendar();
            });
            
            nextMonthBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() + 1);
                updateCalendar();
            });
            
            updateCalendar();
        }
    }
    
    generateCalendar(date, container) {
        // Generate calendar grid with tasks
        // This is a simplified version
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        let html = '<div class="calendar-grid">';
        
        // Day headers
        const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
        dayNames.forEach(day => {
            html += `<div class="calendar-header-day">${day}</div>`;
        });
        
        // Empty cells for days before first day
        const firstDayOfWeek = firstDay.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateString = currentDate.toISOString().split('T')[0];
            
            // Count tasks for this day
            const tasks = this.app.todoManager?.getTasks({ dueDate: dateString }) || [];
            const completed = tasks.filter(t => t.status === 'completed').length;
            const pending = tasks.length - completed;
            
            html += `
                <div class="calendar-day" data-date="${dateString}">
                    <div class="calendar-day-number">${day}</div>
                    ${tasks.length > 0 ? `
                        <div class="calendar-day-tasks">
                            <span class="task-count completed">${completed}</span>
                            <span class="task-count pending">${pending}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add click handlers to days
        container.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
            day.addEventListener('click', () => {
                const date = day.dataset.date;
                this.showTasksForDate(date);
            });
        });
    }
    
    setupTheme() {
        const themeToggle = document.getElementById('dark-mode-toggle');
        if (!themeToggle) return;
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        themeToggle.checked = savedTheme === 'dark';
        
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark-mode');
        }
        
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }
    
    // View Management
    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const viewElement = document.getElementById(`${viewName}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
            this.currentView = viewName;
            
            // Update page title
            document.title = `${this.getViewTitle(viewName)} - Smart Todo Pro`;
            
            // Load view-specific data
            this.loadViewData(viewName);
        }
    }
    
    getViewTitle(viewName) {
        const titles = {
            'dashboard': 'ড্যাশবোর্ড',
            'all-tasks': 'সকল কাজ',
            'today': 'আজকের কাজ',
            'upcoming': 'আসন্ন কাজ',
            'overdue': 'মেয়াদোত্তীর্ণ',
            'important': 'গুরুত্বপূর্ণ',
            'calendar': 'ক্যালেন্ডার'
        };
        
        return titles[viewName] || viewName;
    }
    
    loadViewData(viewName) {
        if (!this.app.todoManager) return;
        
        let tasks = [];
        
        switch (viewName) {
            case 'all-tasks':
                tasks = this.app.todoManager.tasks;
                break;
                
            case 'today':
                tasks = this.app.todoManager.getTasks({ dueDate: 'today' });
                break;
                
            case 'upcoming':
                tasks = this.app.todoManager.getTasks({ dueDate: 'upcoming' });
                break;
                
            case 'overdue':
                tasks = this.app.todoManager.getTasks({ dueDate: 'overdue' });
                break;
                
            case 'important':
                tasks = this.app.todoManager.getTasks({ important: true });
                break;
        }
        
        if (viewName !== 'dashboard' && viewName !== 'calendar') {
            this.updateTaskListDisplay(tasks);
        }
    }
    
    // Task Management UI
    updateTaskList(tasks) {
        // Update the main tasks list based on current view
        this.loadViewData(this.currentView);
        
        // Also update dashboard stats
        if (this.currentView === 'dashboard') {
            this.app.dashboard?.updateStats();
        }
    }
    
    updateTaskListDisplay(tasks) {
        const container = document.getElementById('tasks-container');
        if (!container) return;
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>কোন কাজ নেই</h3>
                    <p>একটি নতুন কাজ যোগ করে শুরু করুন</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        tasks.forEach(task => {
            html += this.createTaskElement(task);
        });
        
        container.innerHTML = html;
        
        // Add event listeners to task elements
        this.setupTaskEventListeners();
    }
    
    createTaskElement(task) {
        const dueDate = task.dueDate ? 
            new Date(task.dueDate).toLocaleDateString('bn-BD', { 
                month: 'short', 
                day: 'numeric' 
            }) : '';
        
        const createdDate = task.createdAt ? 
            new Date(task.createdAt).toLocaleDateString('bn-BD', { 
                month: 'short', 
                day: 'numeric' 
            }) : '';
        
        const priorityClass = `priority-${task.priority}`;
        const statusClass = `status-${task.status}`;
        
        return `
            <div class="task-item ${statusClass}" 
                 data-id="${task.id}" 
                 data-priority="${task.priority}"
                 draggable="true">
                <div class="task-checkbox">
                    <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                </div>
                <div class="task-content">
                    <div class="task-header">
                        <h4 class="task-title ${task.status === 'completed' ? 'completed' : ''}">
                            ${task.title}
                        </h4>
                        ${task.important ? '<span class="task-important"><i class="fas fa-star"></i></span>' : ''}
                        <span class="task-priority ${priorityClass}">
                            ${this.getPriorityLabel(task.priority)}
                        </span>
                    </div>
                    
                    ${task.description ? `
                        <p class="task-description">${task.description}</p>
                    ` : ''}
                    
                    <div class="task-meta">
                        ${dueDate ? `
                            <span class="task-due-date">
                                <i class="far fa-calendar"></i> ${dueDate}
                            </span>
                        ` : ''}
                        
                        ${task.category ? `
                            <span class="task-category">
                                <i class="fas fa-tag"></i> ${task.category}
                            </span>
                        ` : ''}
                        
                        <span class="task-created">
                            <i class="far fa-clock"></i> ${createdDate}
                        </span>
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="task-action-btn edit-btn" title="এডিট করুন">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action-btn delete-btn" title="মুছুন">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setupTaskEventListeners() {
        // Checkbox clicks
        document.querySelectorAll('.task-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskItem = e.target.closest('.task-item');
                const taskId = taskItem.dataset.id;
                this.app.todoManager?.toggleTaskComplete(taskId);
            });
        });
        
        // Edit button clicks
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskItem = e.target.closest('.task-item');
                const taskId = taskItem.dataset.id;
                this.editTask(taskId);
            });
        });
        
        // Delete button clicks
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskItem = e.target.closest('.task-item');
                const taskId = taskItem.dataset.id;
                this.deleteTask(taskId);
            });
        });
        
        // Task item clicks (for selection in bulk edit mode)
        document.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (this.isBulkEditMode()) {
                    const taskId = item.dataset.id;
                    if (item.classList.contains('selected')) {
                        item.classList.remove('selected');
                        this.app.deselectTask(taskId);
                    } else {
                        item.classList.add('selected');
                        this.app.selectTask(taskId);
                    }
                }
            });
        });
    }
    
    // Task CRUD UI
    async showTaskModal(taskId = null) {
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('task-form');
        
        if (taskId) {
            // Edit mode
            title.textContent = 'কাজ এডিট করুন';
            const task = await this.app.todoManager?.getTask(taskId);
            
            if (task) {
                this.populateTaskForm(task);
            }
        } else {
            // Add mode
            title.textContent = 'নতুন কাজ যোগ করুন';
            this.resetTaskForm();
            
            // Auto-focus on title input
            setTimeout(() => {
                document.getElementById('task-title').focus();
            }, 100);
        }
        
        // Store task ID for form submission
        form.dataset.taskId = taskId || '';
        
        this.showModal('task-modal');
    }
    
    populateTaskForm(task) {
        document.getElementById('task-title').value = task.title || '';
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-due-date').value = task.dueDate?.split('T')[0] || '';
        document.getElementById('task-due-time').value = task.dueTime || '';
        document.getElementById('task-priority').value = task.priority || 'medium';
        document.getElementById('task-status').value = task.status || 'pending';
        document.getElementById('task-repeat').value = task.repeat || 'none';
        document.getElementById('task-important').checked = task.important || false;
        document.getElementById('task-reminder').checked = task.reminder || false;
        
        // Set priority buttons
        this.setPriority(task.priority || 'medium');
        
        // Set category
        const categorySelect = document.getElementById('task-category');
        if (categorySelect && task.category) {
            categorySelect.value = task.category;
        }
    }
    
    resetTaskForm() {
        document.getElementById('task-form').reset();
        this.setPriority('medium');
        
        // Set default due date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('task-due-date').value = tomorrow.toISOString().split('T')[0];
    }
    
    setPriority(priority) {
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.priority === priority) {
                btn.classList.add('active');
            }
        });
        
        document.getElementById('task-priority').value = priority;
    }
    
    async handleTaskFormSubmit() {
        const form = document.getElementById('task-form');
        const taskId = form.dataset.taskId;
        
        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            dueDate: document.getElementById('task-due-date').value || null,
            dueTime: document.getElementById('task-due-time').value || null,
            priority: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value,
            category: document.getElementById('task-category').value || null,
            repeat: document.getElementById('task-repeat').value,
            important: document.getElementById('task-important').checked,
            reminder: document.getElementById('task-reminder').checked
        };
        
        if (!taskData.title.trim()) {
            this.app.showToast('কাজের শিরোনাম প্রয়োজন', 'error');
            return;
        }
        
        this.app.showLoading(true);
        
        try {
            if (taskId) {
                // Update existing task
                await this.app.todoManager?.updateTask(taskId, taskData);
                this.app.showToast('কাজ আপডেট করা হয়েছে', 'success');
            } else {
                // Add new task
                await this.app.todoManager?.addTask(taskData);
                this.app.showToast('কাজ যোগ করা হয়েছে', 'success');
            }
            
            this.hideModal('task-modal');
            
        } catch (error) {
            this.app.showToast('কাজ সংরক্ষণ ব্যর্থ', 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    async editTask(taskId) {
        this.showTaskModal(taskId);
    }
    
    async deleteTask(taskId) {
        if (!confirm('আপনি কি নিশ্চিত এই কাজটি মুছতে চান?')) {
            return;
        }
        
        this.app.showLoading(true);
        
        try {
            await this.app.todoManager?.deleteTask(taskId);
            this.showUndoToast(taskId);
        } catch (error) {
            this.app.showToast('কাজ মুছতে সমস্যা হয়েছে', 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    // Bulk Edit Mode
    toggleBulkEditMode(enable = null) {
        const bulkEditBar = document.getElementById('bulk-edit-bar');
        const tasksContainer = document.getElementById('tasks-container');
        
        if (enable === null) {
            enable = !bulkEditBar.classList.contains('active');
        }
        
        if (enable) {
            bulkEditBar.classList.add('active');
            tasksContainer?.classList.add('bulk-edit-mode');
        } else {
            bulkEditBar.classList.remove('active');
            tasksContainer?.classList.remove('bulk-edit-mode');
            
            // Clear selections
            document.querySelectorAll('.task-item.selected').forEach(item => {
                item.classList.remove('selected');
            });
            
            this.app.clearSelectedTasks();
        }
    }
    
    isBulkEditMode() {
        const bulkEditBar = document.getElementById('bulk-edit-bar');
        return bulkEditBar.classList.contains('active');
    }
    
    updateBulkEditBar(selectedCount) {
        const countElement = document.getElementById('selected-count');
        if (countElement) {
            countElement.textContent = `${selectedCount} টি নির্বাচিত`;
        }
        
        const bulkEditBar = document.getElementById('bulk-edit-bar');
        if (selectedCount > 0) {
            bulkEditBar.classList.add('has-selections');
        } else {
            bulkEditBar.classList.remove('has-selections');
        }
    }
    
    // Search and Filter
    handleSearch(query) {
        if (!this.app.todoManager) return;
        
        let tasks = [];
        
        if (query.trim() === '') {
            tasks = this.app.todoManager.tasks;
        } else {
            const searchLower = query.toLowerCase();
            tasks = this.app.todoManager.tasks.filter(task => {
                return task.title.toLowerCase().includes(searchLower) ||
                       (task.description && task.description.toLowerCase().includes(searchLower));
            });
        }
        
        this.updateTaskListDisplay(tasks);
    }
    
    applyFilters() {
        if (!this.app.todoManager) return;
        
        const filters = {};
        
        const priorityFilter = document.getElementById('priority-filter');
        if (priorityFilter && priorityFilter.value) {
            filters.priority = priorityFilter.value;
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && statusFilter.value) {
            filters.status = statusFilter.value;
        }
        
        const tasks = this.app.todoManager.getTasks(filters);
        this.updateTaskListDisplay(tasks);
    }
    
    // Category Management
    updateCategoryList(categories) {
        const container = document.getElementById('category-list');
        if (!container) return;
        
        let html = '';
        
        categories.forEach(category => {
            html += `
                <div class="category-item" data-category-id="${category.id}">
                    <span class="category-color" style="background-color: ${category.color || '#4361ee'}"></span>
                    <span class="category-name">${category.name}</span>
                    <span class="category-count">${category.taskCount || 0}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                const categoryId = item.dataset.categoryId;
                const category = categories.find(c => c.id === categoryId);
                
                if (category) {
                    this.filterByCategory(category.name);
                }
            });
        });
    }
    
    filterByCategory(categoryName) {
        if (!this.app.todoManager) return;
        
        const tasks = this.app.todoManager.getTasks({ category: categoryName });
        this.updateTaskListDisplay(tasks);
        
        // Switch to all tasks view
        this.switchView('all-tasks');
    }
    
    // Toast Notifications
    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        // Remove oldest toast if we have too many
        if (this.toasts.length >= this.maxToasts) {
            const oldestToast = this.toasts.shift();
            if (oldestToast && oldestToast.element) {
                oldestToast.element.remove();
            }
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Store toast reference
        const toastObj = {
            element: toast,
            type: type,
            message: message
        };
        
        this.toasts.push(toastObj);
        
        // Auto-remove after duration
        const removeToast = () => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
                
                // Remove from array
                const index = this.toasts.indexOf(toastObj);
                if (index > -1) {
                    this.toasts.splice(index, 1);
                }
            }, 300);
        };
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', removeToast);
        
        // Auto-remove
        setTimeout(removeToast, duration);
    }
    
    showUndoToast(taskId) {
        const toast = document.getElementById('undo-toast');
        if (!toast) return;
        
        toast.classList.remove('hidden');
        
        // Store the task ID for undo
        toast.dataset.taskId = taskId;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideUndoToast();
        }, 5000);
    }
    
    hideUndoToast() {
        const toast = document.getElementById('undo-toast');
        if (toast) {
            toast.classList.add('hidden');
            delete toast.dataset.taskId;
        }
    }
    
    // Modal Management
    showModal(modalId, data = null) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Store data
        if (data) {
            this.modals.set(modalId, data);
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal(modalId);
            }
        });
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Clear data
        this.modals.delete(modalId);
    }
    
    // Loading States
    showLoading(show = true) {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;
        
        if (show) {
            loadingScreen.classList.remove('hidden');
        } else {
            loadingScreen.classList.add('hidden');
        }
    }
    
    // User Interface Updates
    updateUserInfo(user) {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const welcomeText = document.getElementById('welcome-text');
        
        if (userName) {
            userName.textContent = user.displayName || 'ইউজার';
        }
        
        if (userEmail) {
            userEmail.textContent = user.email || '';
        }
        
        if (welcomeText) {
            welcomeText.textContent = `স্বাগতম, ${user.displayName || 'ইউজার'}!`;
        }
    }
    
    showAuth() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('app-section').classList.add('hidden');
    }
    
    showApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');
    }
    
    // Utility Methods
    getPriorityLabel(priority) {
        const labels = {
            'high': 'উচ্চ',
            'medium': 'মধ্যম',
            'low': 'নিম্ন'
        };
        
        return labels[priority] || priority;
    }
    
    showTasksForDate(date) {
        if (!this.app.todoManager) return;
        
        const tasks = this.app.todoManager.tasks.filter(task => {
            if (!task.dueDate) return false;
            const taskDate = task.dueDate.split('T')[0];
            return taskDate === date;
        });
        
        this.updateTaskListDisplay(tasks);
        this.switchView('all-tasks');
        
        // Show date in header
        const viewHeader = document.querySelector('#all-tasks-view .view-header h1');
        if (viewHeader) {
            const formattedDate = new Date(date).toLocaleDateString('bn-BD', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            viewHeader.textContent = `কাজ: ${formattedDate}`;
        }
    }
    
    updateUndoButton(hasUndo) {
        const undoToast = document.getElementById('undo-toast');
        if (undoToast) {
            if (hasUndo) {
                undoToast.querySelector('span').textContent = 'পূর্বাবস্থায় ফেরানো যায়';
            } else {
                undoToast.querySelector('span').textContent = 'কোন পূর্বাবস্থা নেই';
            }
        }
    }
    
    showError(message) {
        this.showToast(message, 'error');
    }
    
    // Public Methods
    switchToView(viewName) {
        this.switchView(viewName);
    }
    
    showTaskDetails(taskId) {
        // Implementation for showing task details modal
        console.log('Show task details:', taskId);
    }
}

export async function initUI(app) {
    const ui = new UIComponents(app);
    return ui;
}