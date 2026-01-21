// js/ai-features.js
export class AIFeatures {
    constructor(app) {
        this.app = app;
        this.isEnabled = true;
        this.aiModel = null;
        
        this.init();
    }
    
    init() {
        this.loadPreferences();
        this.setupEventListeners();
    }
    
    loadPreferences() {
        const prefs = JSON.parse(localStorage.getItem('ai_preferences') || '{}');
        this.isEnabled = prefs.enabled !== false;
    }
    
    setupEventListeners() {
        // Listen for task input to provide real-time suggestions
        const taskInput = document.getElementById('task-title');
        if (taskInput) {
            taskInput.addEventListener('input', (e) => {
                if (this.isEnabled) {
                    this.provideRealTimeSuggestions(e.target.value);
                }
            });
        }
        
        // Listen for due date input to suggest smart dates
        const dueDateInput = document.getElementById('task-due-date');
        if (dueDateInput) {
            dueDateInput.addEventListener('focus', () => {
                if (this.isEnabled) {
                    this.suggestSmartDates();
                }
            });
        }
    }
    
    async analyzeTaskText(text) {
        if (!this.isEnabled || !text) return {};
        
        const analysis = {
            priority: this.detectPriority(text),
            dueDate: this.extractDueDate(text),
            category: this.suggestCategory(text),
            estimatedTime: this.estimateTime(text),
            keywords: this.extractKeywords(text)
        };
        
        return analysis;
    }
    
    detectPriority(text) {
        const highPriorityKeywords = [
            'জরুরি', 'আজ', 'তাড়াতাড়ি', 'অতি জরুরি', 'অবশ্যই',
            'urgent', 'asap', 'important', 'critical', 'must'
        ];
        
        const lowPriorityKeywords = [
            'কিছুদিন পর', 'যখন সময় পাব', 'ঐচ্ছিক', 'মনে থাকলে',
            'later', 'whenever', 'optional', 'if possible'
        ];
        
        const textLower = text.toLowerCase();
        
        for (const keyword of highPriorityKeywords) {
            if (textLower.includes(keyword)) {
                return 'high';
            }
        }
        
        for (const keyword of lowPriorityKeywords) {
            if (textLower.includes(keyword)) {
                return 'low';
            }
        }
        
        // Default to medium
        return 'medium';
    }
    
    extractDueDate(text) {
        const datePatterns = [
            // Today
            { pattern: /আজ|today|tonight/i, offset: 0 },
            // Tomorrow
            { pattern: /আগামীকাল|tomorrow/i, offset: 1 },
            // Day after tomorrow
            { pattern: /পরশু|day after tomorrow/i, offset: 2 },
            // This week
            { pattern: /এই সপ্তাহ|this week/i, offset: null, getDate: () => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                return new Date(today.setDate(today.getDate() + (6 - dayOfWeek)));
            }},
            // Next week
            { pattern: /পরের সপ্তাহ|next week/i, offset: null, getDate: () => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                return new Date(today.setDate(today.getDate() + (7 - dayOfWeek) + 7));
            }},
            // This month
            { pattern: /এই মাস|this month/i, offset: null, getDate: () => {
                const today = new Date();
                return new Date(today.getFullYear(), today.getMonth() + 1, 0);
            }},
            // Specific dates (DD/MM/YYYY or MM/DD/YYYY)
            { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, getDate: (match) => {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const year = parseInt(match[3]);
                return new Date(year, month, day);
            }},
            // Relative days
            { pattern: /(\d+)\s*দিন পর|in (\d+)\s*days/i, getDate: (match) => {
                const days = parseInt(match[1] || match[2]);
                const today = new Date();
                return new Date(today.setDate(today.getDate() + days));
            }}
        ];
        
        for (const pattern of datePatterns) {
            const match = text.match(pattern.pattern);
            if (match) {
                if (pattern.offset !== null) {
                    const today = new Date();
                    return new Date(today.setDate(today.getDate() + pattern.offset))
                        .toISOString().split('T')[0];
                } else if (pattern.getDate) {
                    const date = pattern.getDate(match);
                    return date.toISOString().split('T')[0];
                }
            }
        }
        
        return null;
    }
    
    suggestCategory(text) {
        const categoryKeywords = {
            'কাজ': ['অফিস', 'প্রোজেক্ট', 'মিটিং', 'রিপোর্ট', 'প্রেজেন্টেশন'],
            'ব্যক্তিগত': ['বাজার', 'ডাক্তার', 'পরিবার', 'বন্ধু', 'অবসর'],
            'শিক্ষা': ['স্টাডি', 'রিডিং', 'কোর্স', 'হোমওয়ার্ক', 'পরীক্ষা'],
            'স্বাস্থ্য': ['ওয়ার্কআউট', 'জিম', 'ডায়েট', 'যোগা', 'চেকআপ'],
            'আর্থিক': ['বিল', 'টাকা', 'ব্যয়', 'বাজেট', 'ইনভেস্ট']
        };
        
        const textLower = text.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            for (const keyword of keywords) {
                if (textLower.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }
        
        return 'সাধারণ';
    }
    
    estimateTime(text) {
        // Simple estimation based on word count
        const wordCount = text.split(/\s+/).length;
        
        if (wordCount <= 5) return '5m'; // 5 minutes
        if (wordCount <= 10) return '15m'; // 15 minutes
        if (wordCount <= 20) return '30m'; // 30 minutes
        if (wordCount <= 50) return '1h'; // 1 hour
        if (wordCount <= 100) return '2h'; // 2 hours
        return '3h+'; // 3+ hours
    }
    
    extractKeywords(text) {
        // Remove common words and extract meaningful keywords
        const stopWords = new Set([
            'এবং', 'বা', 'কিন্তু', 'তবে', 'যদি', 'তাহলে',
            'the', 'and', 'or', 'but', 'if', 'then', 'for'
        ]);
        
        const words = text.toLowerCase().split(/\W+/);
        const keywords = words.filter(word => 
            word.length > 2 && !stopWords.has(word)
        );
        
        return [...new Set(keywords)]; // Remove duplicates
    }
    
    async getPrioritySuggestion(taskData) {
        const analysis = await this.analyzeTaskText(taskData.title);
        
        // Consider due date in priority calculation
        if (taskData.dueDate) {
            const dueDate = new Date(taskData.dueDate);
            const today = new Date();
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDue <= 0) {
                return 'high'; // Overdue or due today
            } else if (daysUntilDue <= 2) {
                return analysis.priority === 'low' ? 'medium' : 'high';
            } else if (daysUntilDue <= 7) {
                return analysis.priority === 'high' ? 'high' : 'medium';
            }
        }
        
        return analysis.priority;
    }
    
    async getProductivityAnalysis() {
        if (!this.app.todoManager) return null;
        
        const tasks = this.app.todoManager.tasks;
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const pendingTasks = tasks.filter(t => t.status !== 'completed');
        
        // Calculate productivity metrics
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? 
            Math.round((completedTasks.length / totalTasks) * 100) : 0;
        
        // Calculate average completion time
        let avgCompletionTime = 0;
        if (completedTasks.length > 0) {
            const totalTime = completedTasks.reduce((sum, task) => {
                if (task.createdAt && task.completedAt) {
                    const created = new Date(task.createdAt);
                    const completed = new Date(task.completedAt);
                    return sum + (completed - created);
                }
                return sum;
            }, 0);
            
            avgCompletionTime = Math.round(totalTime / completedTasks.length / (1000 * 60 * 60)); // in hours
        }
        
        // Identify productivity patterns
        const patterns = {
            mostProductiveDay: this.findMostProductiveDay(completedTasks),
            peakHours: this.findPeakHours(completedTasks),
            commonCategories: this.findCommonCategories(completedTasks),
            overdueRate: this.calculateOverdueRate(tasks)
        };
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(patterns, pendingTasks);
        
        return {
            metrics: {
                totalTasks,
                completedTasks: completedTasks.length,
                completionRate,
                avgCompletionTime,
                pendingTasks: pendingTasks.length
            },
            patterns,
            recommendations
        };
    }
    
    findMostProductiveDay(completedTasks) {
        const dayCount = {};
        const days = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
        
        completedTasks.forEach(task => {
            if (task.completedAt) {
                const date = new Date(task.completedAt);
                const day = date.getDay();
                dayCount[day] = (dayCount[day] || 0) + 1;
            }
        });
        
        if (Object.keys(dayCount).length === 0) return null;
        
        const mostProductiveDay = Object.keys(dayCount).reduce((a, b) => 
            dayCount[a] > dayCount[b] ? a : b
        );
        
        return {
            day: days[mostProductiveDay],
            count: dayCount[mostProductiveDay]
        };
    }
    
    findPeakHours(completedTasks) {
        const hourCount = {};
        
        completedTasks.forEach(task => {
            if (task.completedAt) {
                const date = new Date(task.completedAt);
                const hour = date.getHours();
                hourCount[hour] = (hourCount[hour] || 0) + 1;
            }
        });
        
        const peakHours = Object.entries(hourCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([hour, count]) => ({
                hour: `${hour}:00`,
                count
            }));
        
        return peakHours;
    }
    
    findCommonCategories(completedTasks) {
        const categoryCount = {};
        
        completedTasks.forEach(task => {
            const category = task.category || 'সাধারণ';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        return Object.entries(categoryCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
    }
    
    calculateOverdueRate(tasks) {
        const overdueTasks = tasks.filter(task => {
            if (!task.dueDate || task.status === 'completed') return false;
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
        });
        
        return tasks.length > 0 ? 
            Math.round((overdueTasks.length / tasks.length) * 100) : 0;
    }
    
    generateRecommendations(patterns, pendingTasks) {
        const recommendations = [];
        
        // Based on overdue rate
        if (patterns.overdueRate > 30) {
            recommendations.push({
                type: 'warning',
                message: 'অনেক কাজ মেয়াদোত্তীর্ণ হয়েছে। আজকে গুরুত্বপূর্ণ কাজগুলি করুন।'
            });
        }
        
        // Based on peak hours
        if (patterns.peakHours.length > 0) {
            const bestHour = patterns.peakHours[0].hour;
            recommendations.push({
                type: 'tip',
                message: `আপনি ${bestHour} সময়ে সবচেয়ে বেশি উৎপাদনশীল। গুরুত্বপূর্ণ কাজগুলি এই সময়ে করুন।`
            });
        }
        
        // Based on pending tasks count
        if (pendingTasks.length > 10) {
            recommendations.push({
                type: 'suggestion',
                message: 'বহু কাজ বাকি আছে। ছোট ছোট কাজে ভাগ করে নিন।'
            });
        }
        
        // Suggest breaks if too many high priority tasks
        const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');
        if (highPriorityTasks.length > 5) {
            recommendations.push({
                type: 'reminder',
                message: 'বহু উচ্চ গুরুত্বের কাজ আছে। বিরতি নিতে ভুলবেন না।'
            });
        }
        
        return recommendations;
    }
    
    async getSmartTaskSuggestion() {
        if (!this.app.todoManager) return null;
        
        const tasks = this.app.todoManager.tasks;
        const pendingTasks = tasks.filter(t => t.status !== 'completed');
        
        if (pendingTasks.length === 0) return null;
        
        // Find the most urgent task
        const now = new Date();
        let mostUrgent = null;
        let highestScore = -Infinity;
        
        for (const task of pendingTasks) {
            let score = 0;
            
            // Priority score
            if (task.priority === 'high') score += 30;
            else if (task.priority === 'medium') score += 20;
            else score += 10;
            
            // Due date score (closer due date = higher score)
            if (task.dueDate) {
                const dueDate = new Date(task.dueDate);
                const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntilDue <= 0) score += 40; // Overdue
                else if (daysUntilDue <= 1) score += 30; // Due tomorrow or today
                else if (daysUntilDue <= 3) score += 20;
                else if (daysUntilDue <= 7) score += 10;
            }
            
            // Importance score
            if (task.important) score += 15;
            
            // Time-based score (morning/evening preference)
            const hour = now.getHours();
            if ((hour >= 9 && hour <= 12) || (hour >= 15 && hour <= 18)) {
                // Peak hours - suggest medium priority tasks
                if (task.priority === 'medium') score += 5;
            }
            
            if (score > highestScore) {
                highestScore = score;
                mostUrgent = task;
            }
        }
        
        return mostUrgent;
    }
    
    provideRealTimeSuggestions(text) {
        if (!text || text.length < 3) return;
        
        const suggestions = [];
        const analysis = this.analyzeTaskText(text);
        
        // Clear previous suggestions
        this.clearSuggestions();
        
        // Add priority suggestion
        if (analysis.priority) {
            suggestions.push({
                type: 'priority',
                value: analysis.priority,
                text: `গুরুত্ব: ${analysis.priority}`
            });
        }
        
        // Add due date suggestion
        if (analysis.dueDate) {
            const date = new Date(analysis.dueDate);
            const formattedDate = date.toLocaleDateString('bn-BD');
            suggestions.push({
                type: 'dueDate',
                value: analysis.dueDate,
                text: `পরামর্শকৃত তারিখ: ${formattedDate}`
            });
        }
        
        // Add category suggestion
        if (analysis.category) {
            suggestions.push({
                type: 'category',
                value: analysis.category,
                text: `ক্যাটাগরি: ${analysis.category}`
            });
        }
        
        // Display suggestions
        this.displaySuggestions(suggestions);
    }
    
    displaySuggestions(suggestions) {
        const container = document.getElementById('ai-suggestions');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (suggestions.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        
        suggestions.forEach(suggestion => {
            const element = document.createElement('div');
            element.className = 'ai-suggestion';
            element.textContent = suggestion.text;
            element.dataset.type = suggestion.type;
            element.dataset.value = suggestion.value;
            
            element.addEventListener('click', () => {
                this.applySuggestion(suggestion);
            });
            
            container.appendChild(element);
        });
    }
    
    clearSuggestions() {
        const container = document.getElementById('ai-suggestions');
        if (container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    }
    
    applySuggestion(suggestion) {
        switch (suggestion.type) {
            case 'priority':
                document.getElementById('task-priority').value = suggestion.value;
                this.updatePriorityButtons(suggestion.value);
                break;
                
            case 'dueDate':
                document.getElementById('task-due-date').value = suggestion.value;
                break;
                
            case 'category':
                const categorySelect = document.getElementById('task-category');
                const option = Array.from(categorySelect.options)
                    .find(opt => opt.text === suggestion.value);
                
                if (option) {
                    categorySelect.value = option.value;
                } else {
                    // Add new category
                    this.app.todoManager?.addCategory({
                        name: suggestion.value,
                        color: this.getRandomColor()
                    });
                }
                break;
        }
        
        this.clearSuggestions();
    }
    
    updatePriorityButtons(priority) {
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.priority === priority) {
                btn.classList.add('active');
            }
        });
    }
    
    getRandomColor() {
        const colors = [
            '#4361ee', '#7209b7', '#4cc9f0', '#f72585',
            '#ff9e00', '#25d366', '#db4437', '#0ea5e9'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    suggestSmartDates() {
        const today = new Date();
        const suggestions = [
            { label: 'আজ', date: this.formatDate(today) },
            { label: 'আগামীকাল', date: this.formatDate(this.addDays(today, 1)) },
            { label: 'পরশু', date: this.formatDate(this.addDays(today, 2)) },
            { label: 'এই সপ্তাহের শেষ', date: this.formatDate(this.getWeekEnd(today)) },
            { label: 'পরের সপ্তাহ', date: this.formatDate(this.addDays(today, 7)) }
        ];
        
        this.displayDateSuggestions(suggestions);
    }
    
    displayDateSuggestions(suggestions) {
        const container = document.getElementById('date-suggestions');
        if (!container) return;
        
        container.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'date-suggestion-btn';
            button.textContent = `${suggestion.label} (${suggestion.date})`;
            button.dataset.date = suggestion.date;
            
            button.addEventListener('click', () => {
                document.getElementById('task-due-date').value = suggestion.date;
                container.innerHTML = '';
            });
            
            container.appendChild(button);
        });
        
        container.classList.remove('hidden');
    }
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
    
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    
    getWeekEnd(date) {
        const result = new Date(date);
        const day = result.getDay();
        const diff = 6 - day; // Saturday is end of week
        result.setDate(result.getDate() + diff);
        return result;
    }
    
    // Public methods
    async enableAI(enabled = true) {
        this.isEnabled = enabled;
        localStorage.setItem('ai_preferences', JSON.stringify({ enabled }));
        
        if (enabled) {
            this.app.showToast('AI সক্ষম করা হয়েছে', 'success');
        } else {
            this.app.showToast('AI নিষ্ক্রিয় করা হয়েছে', 'info');
        }
    }
    
    async analyzeText(text) {
        return this.analyzeTaskText(text);
    }
    
    async getSuggestions(taskData) {
        return {
            priority: await this.getPrioritySuggestion(taskData),
            dueDate: this.extractDueDate(taskData.title),
            category: this.suggestCategory(taskData.title),
            estimatedTime: this.estimateTime(taskData.title)
        };
    }
    
    async getProductivityInsights() {
        return this.getProductivityAnalysis();
    }
    
    async getDailySuggestion() {
        return this.getSmartTaskSuggestion();
    }
}

export async function initAI(app) {
    const ai = new AIFeatures(app);
    return ai;
}