// js/dashboard.js
export class DashboardManager {
    constructor(app) {
        this.app = app;
        this.chart = null;
        this.stats = {};
        this.currentPeriod = 7; // days
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadChartLibrary();
    }
    
    setupEventListeners() {
        // Period selector
        const periodSelect = document.getElementById('chart-period');
        if (periodSelect) {
            periodSelect.value = this.currentPeriod;
            periodSelect.addEventListener('change', (e) => {
                this.currentPeriod = parseInt(e.target.value);
                this.updateProductivityChart();
            });
        }
        
        // View all links
        document.querySelectorAll('.view-all').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.app.ui?.switchView(view);
            });
        });
    }
    
    loadChartLibrary() {
        // Chart.js is already loaded in HTML
        // Check if it's available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }
    }
    
    async updateStats() {
        if (!this.app.todoManager) return;
        
        const stats = this.app.todoManager.getTaskStats();
        this.stats = stats;
        
        // Update UI
        this.updateStatsDisplay(stats);
        this.updateTaskLists();
        this.updateStreak();
    }
    
    updateStatsDisplay(stats) {
        // Update total tasks
        const totalElement = document.getElementById('total-tasks');
        if (totalElement) totalElement.textContent = stats.total;
        
        // Update completed tasks
        const completedElement = document.getElementById('completed-tasks');
        if (completedElement) completedElement.textContent = stats.completed;
        
        // Update pending tasks
        const pendingElement = document.getElementById('pending-tasks');
        if (pendingElement) pendingElement.textContent = stats.pending;
        
        // Update completion rate
        const completionRateElement = document.getElementById('completion-rate');
        if (completionRateElement) {
            completionRateElement.textContent = `${stats.completionRate}%`;
        }
        
        // Update overdue count
        const overdueElement = document.getElementById('overdue-count');
        if (overdueElement) overdueElement.textContent = stats.overdue;
        
        // Update important count
        const importantElement = document.getElementById('important-count');
        if (importantElement) importantElement.textContent = stats.important;
        
        // Update today's count
        const todayTasks = this.app.todoManager?.getTasks({ dueDate: 'today' }) || [];
        const todayElement = document.getElementById('today-count');
        if (todayElement) todayElement.textContent = todayTasks.length;
        
        // Update upcoming count
        const upcomingTasks = this.app.todoManager?.getTasks({ dueDate: 'upcoming' }) || [];
        const upcomingElement = document.getElementById('upcoming-count');
        if (upcomingElement) upcomingElement.textContent = upcomingTasks.length;
    }
    
    updateStreak() {
        if (!this.app.todoManager) return;
        
        const completedTasks = this.app.todoManager.tasks.filter(t => t.status === 'completed');
        const completedDates = completedTasks
            .map(t => t.completedAt)
            .filter(date => date)
            .map(date => new Date(date).toISOString().split('T')[0]);
        
        const uniqueDates = [...new Set(completedDates)];
        const streak = this.app.calculateStreak(uniqueDates);
        
        const streakElement = document.getElementById('streak-days');
        if (streakElement) streakElement.textContent = streak;
        
        // Update streak visualization
        this.updateStreakVisualization(streak);
    }
    
    updateStreakVisualization(streak) {
        const container = document.getElementById('streak-visualization');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < 7; i++) {
            const day = document.createElement('div');
            day.className = 'streak-day';
            
            if (i < streak) {
                day.classList.add('active');
                day.innerHTML = '<i class="fas fa-fire"></i>';
            }
            
            container.appendChild(day);
        }
    }
    
    updateTaskLists() {
        if (!this.app.todoManager) return;
        
        // Today's tasks
        const todayTasks = this.app.todoManager.getTasks({ 
            dueDate: 'today',
            status: 'pending'
        }).slice(0, 5); // Show only 5 tasks
        
        this.updateTaskList('today-tasks-list', todayTasks);
        
        // Upcoming tasks
        const upcomingTasks = this.app.todoManager.getTasks({ 
            dueDate: 'upcoming',
            status: 'pending'
        }).slice(0, 5);
        
        this.updateTaskList('upcoming-tasks-list', upcomingTasks);
    }
    
    updateTaskList(containerId, tasks) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-check-circle"></i>
                    <p>কোন কাজ নেই</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        tasks.forEach(task => {
            const dueDate = task.dueDate ? 
                new Date(task.dueDate).toLocaleDateString('bn-BD', { 
                    month: 'short', 
                    day: 'numeric' 
                }) : '';
            
            const priorityClass = `priority-${task.priority}`;
            
            html += `
                <div class="task-list-item">
                    <div class="task-list-content">
                        <div class="task-list-title ${task.status === 'completed' ? 'completed' : ''}">
                            ${task.title}
                        </div>
                        <div class="task-list-meta">
                            ${dueDate ? `<span class="task-date"><i class="far fa-calendar"></i> ${dueDate}</span>` : ''}
                            <span class="task-priority ${priorityClass}">${this.getPriorityLabel(task.priority)}</span>
                        </div>
                    </div>
                    <button class="task-action-btn complete-btn" data-task-id="${task.id}">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add event listeners to complete buttons
        container.querySelectorAll('.complete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                this.app.todoManager?.toggleTaskComplete(taskId);
            });
        });
    }
    
    getPriorityLabel(priority) {
        const labels = {
            'high': 'উচ্চ',
            'medium': 'মধ্যম',
            'low': 'নিম্ন'
        };
        
        return labels[priority] || priority;
    }
    
    async updateProductivityChart() {
        const canvas = document.getElementById('productivity-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Get chart data
        const chartData = await this.getProductivityChartData(this.currentPeriod);
        
        // Create new chart
        this.chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }
    
    async getProductivityChartData(period = 7) {
        if (!this.app.todoManager) return this.getDefaultChartData();
        
        const tasks = this.app.todoManager.tasks;
        const now = new Date();
        
        // Generate labels for the period
        const labels = [];
        const completedData = [];
        const createdData = [];
        
        for (let i = period - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            
            const dateString = date.toISOString().split('T')[0];
            const label = date.toLocaleDateString('bn-BD', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            labels.push(label);
            
            // Count tasks completed on this date
            const completedCount = tasks.filter(task => {
                if (task.status !== 'completed' || !task.completedAt) return false;
                const taskDate = new Date(task.completedAt).toISOString().split('T')[0];
                return taskDate === dateString;
            }).length;
            
            completedData.push(completedCount);
            
            // Count tasks created on this date
            const createdCount = tasks.filter(task => {
                if (!task.createdAt) return false;
                const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
                return taskDate === dateString;
            }).length;
            
            createdData.push(createdCount);
        }
        
        return {
            labels: labels,
            datasets: [
                {
                    label: 'সম্পন্ন কাজ',
                    data: completedData,
                    borderColor: '#4cc9f0',
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'নতুন কাজ',
                    data: createdData,
                    borderColor: '#7209b7',
                    backgroundColor: 'rgba(114, 9, 183, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    }
    
    getDefaultChartData() {
        const labels = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('bn-BD', { 
                month: 'short', 
                day: 'numeric' 
            }));
        }
        
        return {
            labels: labels,
            datasets: [
                {
                    label: 'সম্পন্ন কাজ',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#4cc9f0',
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    borderWidth: 2,
                    fill: true
                }
            ]
        };
    }
    
    // Productivity Insights
    async getProductivityInsights() {
        if (!this.app.ai) return null;
        
        return this.app.ai.getProductivityAnalysis();
    }
    
    async getDailyFocus() {
        if (!this.app.todoManager) return null;
        
        const todayTasks = this.app.todoManager.getTasks({ 
            dueDate: 'today',
            status: 'pending'
        });
        
        const overdueTasks = this.app.todoManager.getTasks({ 
            dueDate: 'overdue',
            status: 'pending'
        });
        
        const highPriorityTasks = this.app.todoManager.getTasks({ 
            priority: 'high',
            status: 'pending'
        });
        
        return {
            todayTasks: todayTasks.length,
            overdueTasks: overdueTasks.length,
            highPriorityTasks: highPriorityTasks.length,
            focusTask: this.getMostImportantTask()
        };
    }
    
    getMostImportantTask() {
        if (!this.app.todoManager) return null;
        
        const pendingTasks = this.app.todoManager.tasks.filter(t => t.status !== 'completed');
        
        if (pendingTasks.length === 0) return null;
        
        // Find task with highest priority and closest due date
        let mostImportant = null;
        let highestScore = -1;
        
        pendingTasks.forEach(task => {
            let score = 0;
            
            // Priority score
            if (task.priority === 'high') score += 30;
            else if (task.priority === 'medium') score += 20;
            else score += 10;
            
            // Due date score
            if (task.dueDate) {
                const dueDate = new Date(task.dueDate);
                const now = new Date();
                const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntilDue <= 0) score += 40; // Overdue
                else if (daysUntilDue <= 1) score += 30; // Due today/tomorrow
                else if (daysUntilDue <= 3) score += 20;
                else if (daysUntilDue <= 7) score += 10;
            }
            
            // Importance score
            if (task.important) score += 15;
            
            if (score > highestScore) {
                highestScore = score;
                mostImportant = task;
            }
        });
        
        return mostImportant;
    }
    
    // Achievement System
    async checkAchievements() {
        const achievements = [];
        
        if (!this.app.todoManager) return achievements;
        
        const stats = this.app.todoManager.getTaskStats();
        
        // First task achievement
        if (stats.total >= 1) {
            achievements.push({
                id: 'first_task',
                title: 'প্রথম কাজ',
                description: 'আপনার প্রথম কাজ তৈরি করেছেন',
                icon: 'fas fa-star',
                unlocked: true
            });
        }
        
        // 10 tasks achievement
        if (stats.total >= 10) {
            achievements.push({
                id: 'ten_tasks',
                title: '১০ টি কাজ',
                description: '১০টি কাজ তৈরি করেছেন',
                icon: 'fas fa-trophy',
                unlocked: true
            });
        }
        
        // Streak achievements
        const streak = parseInt(document.getElementById('streak-days')?.textContent || 0);
        
        if (streak >= 3) {
            achievements.push({
                id: 'three_day_streak',
                title: '৩ দিনের স্ট্রিক',
                description: '৩ দিন ধরে কাজ সম্পন্ন করছেন',
                icon: 'fas fa-fire',
                unlocked: true
            });
        }
        
        if (streak >= 7) {
            achievements.push({
                id: 'week_streak',
                title: 'সপ্তাহের স্ট্রিক',
                description: '৭ দিন ধরে কাজ সম্পন্ন করছেন',
                icon: 'fas fa-crown',
                unlocked: true
            });
        }
        
        // Completion rate achievement
        if (stats.completionRate >= 80) {
            achievements.push({
                id: 'efficient',
                title: 'দক্ষ',
                description: '৮০% এর বেশি কাজ সম্পন্ন করেছেন',
                icon: 'fas fa-bolt',
                unlocked: true
            });
        }
        
        return achievements;
    }
    
    // Export Dashboard Data
    async exportDashboardData(format = 'json') {
        const data = {
            stats: this.stats,
            productivityData: await this.getProductivityChartData(this.currentPeriod),
            achievements: await this.checkAchievements(),
            generatedAt: new Date().toISOString()
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        return data;
    }
    
    // Public Methods
    async refresh() {
        await this.updateStats();
        await this.updateProductivityChart();
        await this.updateTaskLists();
    }
    
    async getStats() {
        return this.stats;
    }
    
    async getInsights() {
        return this.getProductivityInsights();
    }
    
    async getAchievements() {
        return this.checkAchievements();
    }
    
    async getFocusTask() {
        return this.getMostImportantTask();
    }
}

export async function initDashboard(app) {
    const dashboard = new DashboardManager(app);
    return dashboard;
}