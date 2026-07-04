/**
 * To-Do List Life Dashboard
 * A lightweight vanilla JavaScript web application combining task management, 
 * Pomodoro timer, quick links, and personalized greetings.
 */

(function() {
  'use strict';

  /* ============================= */
  /* Storage Manager Module */
  /* ============================= */

  const Storage = {
    STORAGE_KEY: 'dashboardData',

    /**
     * Initialize default data structure
     */
    getDefaultData() {
      return {
        user: {
          name: '',
          theme: 'light'
        },
        timer: {
          duration: 25,
          currentTime: 0,
          isRunning: false,
          isPaused: false
        },
        tasks: [],
        quickLinks: []
      };
    },

    /**
     * Save data to Local Storage
     */
    save(data) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          UI.showError('Storage full. Please delete some data.');
          console.error('QuotaExceededError:', error);
        } else {
          UI.showError('Failed to save data.');
          console.error('Storage error:', error);
        }
        return false;
      }
    },

    /**
     * Load data from Local Storage
     */
    load() {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : this.getDefaultData();
      } catch (error) {
        console.error('Failed to load data:', error);
        return this.getDefaultData();
      }
    },

    /**
     * Clear all data
     */
    clear() {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        return true;
      } catch (error) {
        console.error('Failed to clear storage:', error);
        return false;
      }
    }
  };

  /* ============================= */
  /* Utility Functions */
  /* ============================= */

  const Utils = {
    /**
     * Generate UUID v4
     */
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    /**
     * Format date as "Monday, January 15, 2024"
     */
    formatDate(date) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },

    /**
     * Format time as HH:MM
     */
    formatTime(date) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    /**
     * Format time display as MM:SS
     */
    formatTimeDisplay(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    /**
     * Validate URL format
     */
    validateURL(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    },

    /**
     * Validate task title
     */
    validateTaskTitle(title) {
      const trimmed = title.trim();
      return trimmed.length > 0 && trimmed.length <= 200;
    },

    /**
     * Validate timer duration
     */
    validateDuration(minutes) {
      const num = parseInt(minutes, 10);
      return !isNaN(num) && num >= 1 && num <= 60;
    },

    /**
     * Debounce function
     */
    debounce(fn, delay) {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    }
  };

  /* ============================= */
  /* Greeting Module */
  /* ============================= */

  const Greeting = {
    data: null,

    /**
     * Get greeting based on hour
     */
    getTimeBasedGreeting(hour) {
      if (hour >= 5 && hour < 12) return 'Good Morning';
      if (hour >= 12 && hour < 17) return 'Good Afternoon';
      return 'Good Evening';
    },

    /**
     * Initialize greeting
     */
    init(appData) {
      this.data = appData;
      this.update();
      setInterval(() => this.update(), 60000); // Update every minute
    },

    /**
     * Update greeting display
     */
    update() {
      const now = new Date();
      const greeting = this.getTimeBasedGreeting(now.getHours());
      const name = this.data.user.name ? `, ${this.data.user.name}` : '';
      const greetingText = `${greeting}${name}`;
      const dateText = Utils.formatDate(now);
      const timeText = Utils.formatTime(now);

      const greetingEl = document.getElementById('greeting-message');
      const dateEl = document.getElementById('greeting-date');
      const timeEl = document.getElementById('greeting-time');

      if (greetingEl) greetingEl.textContent = greetingText;
      if (dateEl) dateEl.textContent = dateText;
      if (timeEl) timeEl.textContent = timeText;
    }
  };

  /* ============================= */
  /* Settings Module */
  /* ============================= */

  const Settings = {
    data: null,

    /**
     * Initialize settings
     */
    init(appData) {
      this.data = appData;
      this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      const nameInput = document.getElementById('user-name-input');
      const saveBtn = document.getElementById('user-name-save');
      const closeBtn = document.getElementById('settings-close');

      if (nameInput) {
        nameInput.value = this.data.user.name;
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveName());
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeSettings());
      }
    },

    /**
     * Save user name
     */
    saveName() {
      const nameInput = document.getElementById('user-name-input');
      if (!nameInput) return;

      const name = nameInput.value.trim().substring(0, 50);
      this.data.user.name = name;
      Storage.save(this.data);
      Greeting.update();
      UI.showSuccess('Name saved!');
    },

    /**
     * Close settings panel
     */
    closeSettings() {
      const settingsPanel = document.getElementById('settings-panel');
      if (settingsPanel) {
        settingsPanel.style.display = 'none';
      }
    }
  };

  /* ============================= */
  /* Timer Module */
  /* ============================= */

  const Timer = {
    data: null,
    animationId: null,
    lastUpdateTime: 0,

    /**
     * Initialize timer
     */
    init(appData) {
      this.data = appData;
      this.setupEventListeners();
      this.render();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      const startBtn = document.getElementById('timer-start');
      const stopBtn = document.getElementById('timer-stop');
      const resetBtn = document.getElementById('timer-reset');
      const durationInput = document.getElementById('timer-duration');

      if (startBtn) startBtn.addEventListener('click', () => this.start());
      if (stopBtn) stopBtn.addEventListener('click', () => this.stop());
      if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
      if (durationInput) {
        durationInput.addEventListener('change', (e) => this.setDuration(e.target.value));
      }
    },

    /**
     * Set timer duration
     */
    setDuration(minutes) {
      if (!Utils.validateDuration(minutes)) {
        UI.showError('Duration must be between 1 and 60 minutes');
        return;
      }

      this.data.timer.duration = parseInt(minutes, 10);
      this.data.timer.currentTime = this.data.timer.duration * 60;
      this.data.timer.isRunning = false;
      this.data.timer.isPaused = false;

      Storage.save(this.data);
      this.render();
    },

    /**
     * Start timer
     */
    start() {
      if (this.data.timer.isRunning) return;

      if (this.data.timer.currentTime === 0) {
        this.data.timer.currentTime = this.data.timer.duration * 60;
      }

      this.data.timer.isRunning = true;
      this.data.timer.isPaused = false;
      this.lastUpdateTime = Date.now();
      Storage.save(this.data);
      this.tick();
      this.render();
    },

    /**
     * Stop (pause) timer
     */
    stop() {
      if (this.data.timer.animationId) {
        cancelAnimationFrame(this.data.timer.animationId);
      }
      this.data.timer.isRunning = false;
      this.data.timer.isPaused = true;
      Storage.save(this.data);
      this.render();
    },

    /**
     * Reset timer
     */
    reset() {
      if (this.data.timer.animationId) {
        cancelAnimationFrame(this.data.timer.animationId);
      }
      this.data.timer.currentTime = this.data.timer.duration * 60;
      this.data.timer.isRunning = false;
      this.data.timer.isPaused = false;
      Storage.save(this.data);
      this.render();
    },

    /**
     * Timer tick
     */
    tick() {
      if (!this.data.timer.isRunning) return;

      const now = Date.now();
      const elapsed = Math.floor((now - this.lastUpdateTime) / 1000);

      if (elapsed >= 1) {
        this.data.timer.currentTime--;
        this.lastUpdateTime = now;
        Storage.save(this.data);
        this.render();

        if (this.data.timer.currentTime <= 0) {
          this.complete();
          return;
        }
      }

      this.data.timer.animationId = requestAnimationFrame(() => this.tick());
    },

    /**
     * Timer completed
     */
    complete() {
      this.data.timer.isRunning = false;
      this.data.timer.currentTime = 0;
      Storage.save(this.data);
      this.render();
      this.playNotification();
      UI.showSuccess("Time's up! 🎉");
    },

    /**
     * Play notification sound
     */
    playNotification() {
      try {
        // Create simple beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.warn('Audio notification not available:', error);
      }
    },

    /**
     * Render timer display
     */
    render() {
      const display = document.getElementById('timer-display');
      const durationInput = document.getElementById('timer-duration');
      const startBtn = document.getElementById('timer-start');

      if (display) {
        display.textContent = Utils.formatTimeDisplay(this.data.timer.currentTime);
        display.classList.toggle('running', this.data.timer.isRunning);
      }

      if (durationInput) {
        durationInput.value = this.data.timer.duration;
      }

      if (startBtn) {
        startBtn.textContent = this.data.timer.isRunning ? 'Running...' : 'Start';
      }
    }
  };

  /* ============================= */
  /* Task Manager Module */
  /* ============================= */

  const TaskManager = {
    data: null,

    /**
     * Initialize task manager
     */
    init(appData) {
      this.data = appData;
      this.setupEventListeners();
      this.render();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      const addBtn = document.getElementById('task-add-btn');
      const input = document.getElementById('task-input');

      if (addBtn) {
        addBtn.addEventListener('click', () => this.handleAddTask());
      }

      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.handleAddTask();
        });
      }

      // Event delegation for task actions
      const taskList = document.getElementById('task-list');
      if (taskList) {
        taskList.addEventListener('click', (e) => this.handleTaskAction(e));
      }
    },

    /**
     * Handle add task
     */
    handleAddTask() {
      const input = document.getElementById('task-input');
      if (!input) return;

      const title = input.value.trim();

      if (!Utils.validateTaskTitle(title)) {
        UI.showError('Task must be between 1 and 200 characters');
        return;
      }

      this.addTask(title);
      input.value = '';
      input.focus();
    },

    /**
     * Add task
     */
    addTask(title) {
      const task = {
        id: Utils.generateUUID(),
        title: title,
        completed: false,
        createdAt: Date.now()
      };

      this.data.tasks.push(task);
      Storage.save(this.data);
      this.render();
      UI.showSuccess('Task added!');
    },

    /**
     * Delete task
     */
    deleteTask(id) {
      this.data.tasks = this.data.tasks.filter(task => task.id !== id);
      Storage.save(this.data);
      this.render();
      UI.showSuccess('Task deleted');
    },

    /**
     * Toggle task completion
     */
    toggleTask(id) {
      const task = this.data.tasks.find(t => t.id === id);
      if (task) {
        task.completed = !task.completed;
        Storage.save(this.data);
        this.render();
      }
    },

    /**
     * Handle task actions
     */
    handleTaskAction(e) {
      const deleteBtn = e.target.closest('.task-delete');
      const checkbox = e.target.closest('.task-checkbox');

      if (deleteBtn) {
        const taskId = deleteBtn.dataset.taskId;
        this.deleteTask(taskId);
      }

      if (checkbox) {
        const taskId = checkbox.dataset.taskId;
        this.toggleTask(taskId);
      }
    },

    /**
     * Render task list
     */
    render() {
      const taskList = document.getElementById('task-list');
      if (!taskList) return;

      taskList.innerHTML = '';

      if (this.data.tasks.length === 0) {
        taskList.innerHTML = '<li style="padding: 16px; text-align: center; color: var(--text-secondary);">No tasks yet. Add one to get started!</li>';
        return;
      }

      this.data.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;

        li.innerHTML = `
          <input 
            type="checkbox" 
            class="task-checkbox" 
            data-task-id="${task.id}"
            ${task.completed ? 'checked' : ''}
            aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
          >
          <span class="task-title">${this.escapeHtml(task.title)}</span>
          <button class="btn btn-small btn-danger task-delete" data-task-id="${task.id}" aria-label="Delete task">
            Delete
          </button>
        `;

        taskList.appendChild(li);
      });
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  /* ============================= */
  /* Quick Links Module */
  /* ============================= */

  const QuickLinks = {
    data: null,

    /**
     * Initialize quick links
     */
    init(appData) {
      this.data = appData;
      this.setupEventListeners();
      this.render();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      const addBtn = document.getElementById('link-add-btn');
      const urlInput = document.getElementById('link-url');

      if (addBtn) {
        addBtn.addEventListener('click', () => this.handleAddLink());
      }

      if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.handleAddLink();
        });
      }

      // Event delegation for link actions
      const linksContainer = document.getElementById('quick-links-container');
      if (linksContainer) {
        linksContainer.addEventListener('click', (e) => this.handleLinkAction(e));
      }
    },

    /**
     * Handle add link
     */
    handleAddLink() {
      const titleInput = document.getElementById('link-title');
      const urlInput = document.getElementById('link-url');

      if (!titleInput || !urlInput) return;

      const title = titleInput.value.trim();
      const url = urlInput.value.trim();

      if (!title) {
        UI.showError('Please enter a link title');
        return;
      }

      if (!Utils.validateURL(url)) {
        UI.showError('Please enter a valid URL (e.g., https://example.com)');
        return;
      }

      this.addLink(title, url);
      titleInput.value = '';
      urlInput.value = '';
      titleInput.focus();
    },

    /**
     * Add link
     */
    addLink(title, url) {
      const link = {
        id: Utils.generateUUID(),
        title: title,
        url: url,
        createdAt: Date.now()
      };

      this.data.quickLinks.push(link);
      Storage.save(this.data);
      this.render();
      UI.showSuccess('Link added!');
    },

    /**
     * Delete link
     */
    deleteLink(id) {
      this.data.quickLinks = this.data.quickLinks.filter(link => link.id !== id);
      Storage.save(this.data);
      this.render();
      UI.showSuccess('Link deleted');
    },

    /**
     * Handle link actions
     */
    handleLinkAction(e) {
      const deleteBtn = e.target.closest('.quick-link-delete');
      const linkBtn = e.target.closest('.quick-link-btn');

      if (deleteBtn) {
        e.preventDefault();
        const linkId = deleteBtn.dataset.linkId;
        this.deleteLink(linkId);
      }

      if (linkBtn && !deleteBtn) {
        const url = linkBtn.dataset.url;
        window.open(url, '_blank');
      }
    },

    /**
     * Render quick links
     */
    render() {
      const container = document.getElementById('quick-links-container');
      if (!container) return;

      container.innerHTML = '';

      if (this.data.quickLinks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No quick links yet. Add one to get started!</p>';
        return;
      }

      this.data.quickLinks.forEach(link => {
        const div = document.createElement('div');
        div.className = 'quick-link-item';

        const btn = document.createElement('button');
        btn.className = 'quick-link-btn';
        btn.dataset.url = link.url;
        btn.textContent = link.title;
        btn.setAttribute('aria-label', `Open ${link.title}`);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'quick-link-delete';
        deleteBtn.dataset.linkId = link.id;
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `Delete ${link.title}`);

        div.appendChild(btn);
        div.appendChild(deleteBtn);
        container.appendChild(div);
      });
    }
  };

  /* ============================= */
  /* Theme Manager Module */
  /* ============================= */

  const Theme = {
    data: null,

    /**
     * Initialize theme
     */
    init(appData) {
      this.data = appData;
      this.applyTheme(this.data.user.theme);
      this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => this.toggleTheme());
      }
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
      const newTheme = this.data.user.theme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    },

    /**
     * Set theme
     */
    setTheme(theme) {
      if (theme !== 'light' && theme !== 'dark') return;

      this.data.user.theme = theme;
      Storage.save(this.data);
      this.applyTheme(theme);
    },

    /**
     * Apply theme
     */
    applyTheme(theme) {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');

      if (theme === 'dark') {
        html.classList.add('dark-theme');
        if (toggle) toggle.querySelector('.theme-icon').textContent = '🌙';
      } else {
        html.classList.remove('dark-theme');
        if (toggle) toggle.querySelector('.theme-icon').textContent = '☀️';
      }
    }
  };

  /* ============================= */
  /* UI Module */
  /* ============================= */

  const UI = {
    /**
     * Show success notification
     */
    showSuccess(message) {
      this.showToast(message, 'success');
    },

    /**
     * Show error notification
     */
    showError(message) {
      this.showToast(message, 'error');
    },

    /**
     * Show warning notification
     */
    showWarning(message) {
      this.showToast(message, 'warning');
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'success') {
      const container = document.getElementById('notification-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');

      container.appendChild(toast);

      // Remove after 3 seconds
      setTimeout(() => {
        toast.style.animation = 'fade-in 0.3s ease-in-out reverse';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  /* ============================= */
  /* Application Initialization */
  /* ============================= */

  const App = {
    /**
     * Initialize application
     */
    init() {
      // Load data from storage
      const appData = Storage.load();

      // Initialize modules
      Theme.init(appData);
      Greeting.init(appData);
      Timer.init(appData);
      TaskManager.init(appData);
      QuickLinks.init(appData);
      Settings.init(appData);

      // Show initial greeting
      Greeting.update();

      console.log('Dashboard initialized successfully!');
    }
  };

  // Start application when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})();
