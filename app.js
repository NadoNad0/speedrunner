/**
 * Speedrunner - Multi-Track Logic
 */

class SpeedrunnerApp {
    constructor() {
        // DOM Elements
        this.timerListEl = document.getElementById('timer-list');
        this.addTimerBtn = document.getElementById('add-timer-btn');
        this.addTimerBottomBtn = document.getElementById('add-timer-bottom-btn');
        this.createFirstBtn = document.getElementById('create-first-btn');
        this.emptyStateEl = document.getElementById('empty-state');
        this.totalTimeDisplay = document.getElementById('total-time-display');
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');

        // Settings Modal Elements
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        this.toggleBtns = document.querySelectorAll('.toggle-btn');
        this.countdownConfig = document.getElementById('countdown-config');
        this.countdownInput = document.getElementById('countdown-input');
        this.showInTitleCheck = document.getElementById('show-in-title-check');

        // Alert Modal Elements
        this.alertModal = document.getElementById('alert-modal');
        this.alertMessage = document.getElementById('alert-message');
        this.alertTitle = document.getElementById('alert-title');
        this.closeAlertBtn = document.getElementById('close-alert-btn');
        this.confirmAlertBtn = document.getElementById('confirm-alert-btn');

        // Confirm Modal Elements
        this.confirmModal = document.getElementById('confirm-modal');
        this.confirmMessage = document.getElementById('confirm-message');
        this.confirmTitle = document.getElementById('confirm-title');
        this.closeConfirmBtn = document.getElementById('close-confirm-btn');
        this.cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
        this.okConfirmBtn = document.getElementById('ok-confirm-btn');

        // State
        this.timers = JSON.parse(localStorage.getItem('speedrunner_timers')) || [];
        this.theme = localStorage.getItem('speedrunner_theme') || 'dark';
        this.activeTimerId = null;
        this.confirmCallback = null;

        // Constants
        this.MAX_TIMERS = 9;
        this.TAG_OPTIONS = [
            { val: '⚪', label: '⚪' }, // No Tag
            { val: '🟢', label: '🟢' },
            { val: '🔵', label: '🔵' },
            { val: '🟡', label: '🟡' },
            { val: '🔴', label: '🔴' },
            { val: '🟣', label: '🟣' },
            { val: '⚡', label: '⚡' },
            { val: '💻', label: '💻' },
            { val: '🎨', label: '🎨' },
            { val: '🧠', label: '🧠' }
        ];

        // Bindings
        this.addTimer = this.addTimer.bind(this);
        this.updateLoop = this.updateLoop.bind(this);
        this.saveData = this.saveData.bind(this);

        this.openSettings = this.openSettings.bind(this);
        this.closeSettings = this.closeSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);

        this.resetTimer = this.resetTimer.bind(this);
        this.promptDelete = this.promptDelete.bind(this);

        // Modal Bindings
        this.closeAlert = this.closeAlert.bind(this);
        this.closeConfirm = this.closeConfirm.bind(this);
        this.handleConfirmOk = this.handleConfirmOk.bind(this);

        // Theme Binding
        this.toggleTheme = this.toggleTheme.bind(this);

        this.init();
    }

    init() {
        // Event Listeners
        this.addTimerBtn.addEventListener('click', this.addTimer);
        this.addTimerBottomBtn.addEventListener('click', this.addTimer);
        this.createFirstBtn.addEventListener('click', this.addTimer);
        this.themeToggleBtn.addEventListener('click', this.toggleTheme);

        // Settings Modal
        this.closeSettingsBtn.addEventListener('click', this.closeSettings);
        this.saveSettingsBtn.addEventListener('click', this.saveSettings);

        this.toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const type = e.target.dataset.type;
                if (type === 'countdown') {
                    this.countdownConfig.classList.remove('hidden');
                } else {
                    this.countdownConfig.classList.add('hidden');
                }
            });
        });

        // Alert Modal
        this.closeAlertBtn.addEventListener('click', this.closeAlert);
        this.confirmAlertBtn.addEventListener('click', this.closeAlert);

        // Confirm Modal
        this.closeConfirmBtn.addEventListener('click', this.closeConfirm);
        this.cancelConfirmBtn.addEventListener('click', this.closeConfirm);
        this.okConfirmBtn.addEventListener('click', this.handleConfirmOk);

        // Initial Render
        this.initTheme();
        this.renderAllTimers();
        this.checkEmptyState();
        this.updateAddButtonState();

        // Start Loop
        requestAnimationFrame(this.updateLoop);
    }

    // --- Theme Logic ---

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeIcon();
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('speedrunner_theme', this.theme);
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        this.themeToggleBtn.textContent = this.theme === 'dark' ? '🌙' : '☀️';
    }

    // --- Helper Methods ---

    showAlert(message, title = "Alert") {
        this.alertMessage.textContent = message;
        this.alertTitle.textContent = title;
        this.alertModal.classList.remove('hidden');
    }

    closeAlert() {
        this.alertModal.classList.add('hidden');
    }

    showConfirm(message, callback, title = "Confirm") {
        this.confirmMessage.textContent = message;
        this.confirmTitle.textContent = title;
        this.confirmCallback = callback;
        this.confirmModal.classList.remove('hidden');
    }

    closeConfirm() {
        this.confirmModal.classList.add('hidden');
        this.confirmCallback = null;
    }

    handleConfirmOk() {
        if (this.confirmCallback) this.confirmCallback();
        this.closeConfirm();
    }

    // --- Core Logic ---

    getAvailableTag() {
        const usedTags = this.timers.map(t => t.tag);
        // '⚪' is always available
        const available = this.TAG_OPTIONS.find(opt => opt.val !== '⚪' && !usedTags.includes(opt.val));
        return available ? available.val : '⚪';
    }

    addTimer() {
        if (this.timers.length >= this.MAX_TIMERS) {
            this.showAlert("Maximum 9 timers allowed.", "Limit Reached");
            return;
        }

        const availableTag = this.getAvailableTag();

        const newTimer = {
            id: Date.now(),
            tag: availableTag,
            name: 'New Activity',
            type: 'stopwatch',
            duration: 0,
            remaining: 0,
            isRunning: false,
            lastTick: 0,
            initialDuration: 25 * 60 * 1000,
            showInTitle: false
        };

        this.timers.push(newTimer);
        this.saveData();

        // Only render the new row with animation
        this.renderTimerRow(newTimer, true);
        this.checkEmptyState();
        this.updateAddButtonState();

        // Re-render others to update dropdowns (without animation)
        this.renderAllTimers(newTimer.id);
    }

    toggleTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (!timer) return;

        if (!timer.isRunning) {
            const othersRunning = this.timers.some(t => t.isRunning && t.id !== id);
            if (othersRunning) {
                this.showConfirm(
                    "Are you sure you want to run multiple timers simultaneously?",
                    () => {
                        timer.isRunning = true;
                        timer.lastTick = Date.now();
                        if (timer.type === 'countdown' && timer.remaining <= 0) {
                            timer.remaining = timer.initialDuration;
                        }
                        this.saveData();
                        this.updateRowUI(timer);
                    },
                    "Multi-Timer Warning"
                );
                return;
            }

            timer.isRunning = true;
            timer.lastTick = Date.now();
            if (timer.type === 'countdown' && timer.remaining <= 0) {
                timer.remaining = timer.initialDuration;
            }
        } else {
            timer.isRunning = false;
        }

        this.saveData();
        this.updateRowUI(timer);
    }

    resetTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (!timer) return;

        this.showConfirm(
            "Are you sure you want to reset this timer?",
            () => {
                timer.isRunning = false;
                timer.duration = 0;
                timer.remaining = timer.initialDuration;
                this.saveData();
                this.updateRowUI(timer);
            },
            "Reset Timer?"
        );
    }

    updateLoop() {
        const now = Date.now();
        let totalTime = 0;
        let titleUpdated = false;

        this.timers.forEach(timer => {
            if (timer.isRunning) {
                const delta = now - timer.lastTick;
                timer.lastTick = now;

                if (timer.type === 'stopwatch') {
                    timer.duration += delta;
                } else {
                    timer.remaining -= delta;
                    if (timer.remaining <= 0) {
                        timer.remaining = 0;
                        timer.isRunning = false;
                    }
                }
                this.updateRowUI(timer);
            }

            if (timer.type === 'stopwatch') {
                totalTime += timer.duration;
            } else {
                totalTime += (timer.initialDuration - timer.remaining);
            }

            if (timer.showInTitle && !titleUpdated) {
                const timeStr = this.formatTime(timer.type === 'stopwatch' ? timer.duration : timer.remaining);
                document.title = `${timeStr} - ${timer.name}`;
                titleUpdated = true;
            }
        });

        if (!titleUpdated) {
            document.title = "Speedrunner - Multi-Track Timer";
        }

        this.totalTimeDisplay.textContent = this.formatTime(totalTime);
        requestAnimationFrame(this.updateLoop);
    }

    // --- UI Rendering ---

    checkEmptyState() {
        if (this.timers.length === 0) {
            this.emptyStateEl.classList.remove('hidden');
            this.timerListEl.classList.add('hidden');
            this.addTimerBottomBtn.parentElement.classList.add('hidden');
        } else {
            this.emptyStateEl.classList.add('hidden');
            this.timerListEl.classList.remove('hidden');
            this.addTimerBottomBtn.parentElement.classList.remove('hidden');
        }
    }

    updateAddButtonState() {
        const isFull = this.timers.length >= this.MAX_TIMERS;
        this.addTimerBtn.disabled = isFull;
        this.addTimerBottomBtn.disabled = isFull;

        if (isFull) {
            this.addTimerBtn.style.opacity = '0.5';
            this.addTimerBtn.style.cursor = 'not-allowed';
            this.addTimerBottomBtn.textContent = "Maximum Timers Reached";
        } else {
            this.addTimerBtn.style.opacity = '1';
            this.addTimerBtn.style.cursor = 'pointer';
            this.addTimerBottomBtn.textContent = "+ Add New Timer";
        }
    }

    renderAllTimers(skipId = null) {
        // We need to preserve focus if possible, but full re-render kills it.
        // However, for dropdown updates, we must re-render the select options.
        // We can iterate and update individual rows instead of wiping innerHTML.

        // Simple approach: Wipe and rebuild. Focus loss is acceptable on Tag Change.
        // But to avoid jitter, we must NOT animate existing rows.

        this.timerListEl.innerHTML = '';
        this.timers.forEach(timer => {
            // If we just added this timer (skipId), it was already rendered with animation?
            // No, if we wipe innerHTML, we lose the previous render.
            // So we render all, and only apply 'new' class to the one matching skipId?
            // Wait, if I pass skipId, I want that one to animate?
            // Actually, if I wipe innerHTML, the animation restarts if the class is there.
            // So I should render ALL, and only give the 'new' class to the one that is new.

            // But wait, if I add a timer, I want it to animate.
            // If I change a tag, I want NO animation.

            // So `renderAllTimers` should generally NOT add the 'new' class.
            // `addTimer` should add the timer, save, and then render all, passing the ID of the new one to animate.

            const isNew = (timer.id === skipId);
            this.renderTimerRow(timer, isNew);
        });
    }

    renderTimerRow(timer, isNew = false) {
        const div = document.createElement('div');
        div.className = 'timer-row';
        if (isNew) div.classList.add('new');
        div.id = `timer-${timer.id}`;

        const usedTags = this.timers.filter(t => t.id !== timer.id).map(t => t.tag);

        const optionsHtml = this.TAG_OPTIONS.map(opt => {
            // Filter out used tags unless it's the current one or '⚪'
            if (opt.val !== '⚪' && usedTags.includes(opt.val) && timer.tag !== opt.val) {
                return ''; // Hide it
            }
            return `<option value="${opt.val}" ${timer.tag === opt.val ? 'selected' : ''}>${opt.label}</option>`;
        }).join('');

        div.innerHTML = `
            <div class="col col-tag">
                <select onchange="app.updateTag(${timer.id}, this.value)">
                    ${optionsHtml}
                </select>
            </div>
            <div class="col col-name">
                <input type="text" value="${timer.name}" 
                    oninput="app.validateName(${timer.id}, this)"
                    onchange="app.updateName(${timer.id}, this.value)">
            </div>
            <div class="col col-time" id="time-${timer.id}">
                ${this.formatTime(timer.type === 'stopwatch' ? timer.duration : timer.remaining)}
            </div>
            <div class="col col-control">
                <button onclick="app.toggleTimer(${timer.id})" id="btn-${timer.id}" class="${timer.isRunning ? 'active' : ''}">
                    ${timer.isRunning ? '❚❚' : '▶'}
                </button>
            </div>
            <div class="col col-settings">
                <button onclick="app.openSettings(${timer.id})">⚙</button>
            </div>
            <div class="col col-reset">
                <button onclick="app.resetTimer(${timer.id})">↺</button>
            </div>
            <div class="col col-delete">
                <button onclick="app.promptDelete(${timer.id})">🗑️</button>
            </div>
        `;
        this.timerListEl.appendChild(div);
    }

    updateRowUI(timer) {
        const timeEl = document.getElementById(`time-${timer.id}`);
        const btnEl = document.getElementById(`btn-${timer.id}`);
        if (timeEl) timeEl.textContent = this.formatTime(timer.type === 'stopwatch' ? timer.duration : timer.remaining);
        if (btnEl) {
            btnEl.innerHTML = timer.isRunning ? '❚❚' : '▶';
            btnEl.className = timer.isRunning ? 'active' : '';
        }
    }

    // --- Helpers ---

    formatTime(ms) {
        if (ms < 0) ms = 0;
        const s = Math.floor((ms / 1000) % 60).toString().padStart(2, '0');
        const m = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, '0');
        const h = Math.floor((ms / (1000 * 60 * 60))).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    saveData() {
        localStorage.setItem('speedrunner_timers', JSON.stringify(this.timers));
    }

    validateName(id, input) {
        if (input.value.length > 45) {
            input.classList.add('warning');
        } else {
            input.classList.remove('warning');
        }
    }

    updateName(id, value) {
        if (value.length > 45) {
            this.showAlert("Name is too long! Please shorten it to under 45 characters.", "Input Warning");
        }
        const timer = this.timers.find(t => t.id === id);
        if (timer) {
            timer.name = value;
            this.saveData();
        }
    }

    updateTag(id, value) {
        const timer = this.timers.find(t => t.id === id);
        if (timer) {
            timer.tag = value;
            this.saveData();
            // Re-render all to update hidden tags in other dropdowns
            // Pass null so NO animation occurs
            this.renderAllTimers(null);
        }
    }

    // --- Settings Modal ---

    openSettings(id) {
        this.activeTimerId = id;
        const timer = this.timers.find(t => t.id === id);

        this.toggleBtns.forEach(btn => {
            if (btn.dataset.type === timer.type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (timer.type === 'countdown') {
            this.countdownConfig.classList.remove('hidden');
            this.countdownInput.value = Math.floor(timer.initialDuration / 60000);
        } else {
            this.countdownConfig.classList.add('hidden');
        }

        this.showInTitleCheck.checked = !!timer.showInTitle;

        this.settingsModal.classList.remove('hidden');
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
        this.activeTimerId = null;
    }

    saveSettings() {
        if (!this.activeTimerId) return;

        const timer = this.timers.find(t => t.id === this.activeTimerId);
        const activeTypeBtn = document.querySelector('.toggle-btn.active');
        const newType = activeTypeBtn.dataset.type;
        const showInTitle = this.showInTitleCheck.checked;

        let shouldReset = false;

        // Check if type changed
        if (timer.type !== newType) {
            shouldReset = true;
        } else if (newType === 'countdown') {
            // If type same, check if duration changed
            const newDuration = (parseInt(this.countdownInput.value) || 25) * 60 * 1000;
            if (newDuration !== timer.initialDuration) {
                shouldReset = true;
            }
        }

        // Apply changes
        timer.type = newType;

        // Exclusive Title Logic
        if (showInTitle) {
            this.timers.forEach(t => t.showInTitle = false);
            timer.showInTitle = true;
        } else {
            timer.showInTitle = false;
        }

        if (shouldReset) {
            if (newType === 'countdown') {
                const mins = parseInt(this.countdownInput.value) || 25;
                timer.initialDuration = mins * 60 * 1000;
                timer.remaining = timer.initialDuration;
                timer.duration = 0;
            } else {
                timer.duration = 0;
            }
            timer.isRunning = false;
        }

        this.saveData();
        this.renderAllTimers(null); // No animation on settings save
        this.closeSettings();
    }

    // --- Delete Modal Logic ---

    promptDelete(id) {
        this.showConfirm(
            "Are you sure you want to delete this timer? This action cannot be undone.",
            () => {
                this.timers = this.timers.filter(t => t.id !== id);
                this.saveData();
                this.renderAllTimers(null); // No animation on delete re-render
                this.checkEmptyState();
                this.updateAddButtonState();
            },
            "Delete Timer?"
        );
    }
}

// Initialize
const app = new SpeedrunnerApp();
window.app = app;
