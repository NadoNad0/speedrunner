/**
 * Speedrunner - Multi-Track Logic
 */

class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = localStorage.getItem('speedrunner_sound') !== 'false';
        this.initialized = false;
        this.noiseBuffer = null;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.05; // Very quiet master volume
            this.masterGain.connect(this.ctx.destination);

            this.createNoiseBuffer();
            this.initialized = true;
        } catch (e) {
            console.error("Web Audio API not supported");
        }
    }

    createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    setEnabled(val) {
        this.enabled = val;
        localStorage.setItem('speedrunner_sound', val);
    }

    // Helper for filtered noise (Used by Delete)
    playNoise(filterType, freq, duration, vol = 1.0, attack = 0.01) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;

        const gain = this.ctx.createGain();

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        src.start();
        src.stop(now + duration);
        return { src, filter, gain };
    }

    playToggle(isOn) {
        // Soft sine blip
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.value = isOn ? 400 : 300;

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.start();
        osc.stop(now + 0.1);
    }

    playDelete() {
        // "Wind in leaves" - Bandpass sweep
        if (!this.enabled || !this.ctx) return;
        const { filter } = this.playNoise('bandpass', 400, 0.6, 0.6, 0.1);

        const now = this.ctx.currentTime;
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(800, now + 0.3);
        filter.frequency.linearRampToValueAtTime(200, now + 0.6);
    }

    playFlop() {
        // "Water Bloop" - Sine sweep High -> Low
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';

        const now = this.ctx.currentTime;

        // Frequency Sweep: 600Hz -> 300Hz
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

        // Volume Envelope: Fast attack, fast decay
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.start();
        osc.stop(now + 0.15);
    }
}

class Confetti {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '90'; // Behind modal overlay (100)
        this.canvas.style.filter = 'blur(4px)'; // Blurred
        document.body.appendChild(this.canvas);

        this.particles = [];
        this.animId = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    burst() {
        // Increase particle count to 300
        for (let i = 0; i < 300; i++) {
            this.particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 25,
                color: `hsl(${Math.random() * 360}, 80%, 60%)`,
                size: Math.random() * 6 + 3,
                life: 1,
                decay: Math.random() * 0.01 + 0.005
            });
        }
        if (!this.animId) this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach((p, index) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // Gravity
            p.vx *= 0.96; // Air resistance
            p.vy *= 0.96;
            p.life -= p.decay;

            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);

            if (p.life <= 0) {
                this.particles.splice(index, 1);
            }
        });

        if (this.particles.length > 0) {
            this.animId = requestAnimationFrame(() => this.animate());
        } else {
            this.animId = null;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

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

        // Dashboard Elements
        this.dashboardFooter = document.getElementById('dashboard-footer');
        this.dashboardContent = document.getElementById('dashboard-content');
        this.timeChart = document.getElementById('time-chart');
        this.chartLegend = document.getElementById('chart-legend');
        this.shareBtn = document.getElementById('share-btn');

        // Share Modal Elements
        this.shareModal = document.getElementById('share-modal');
        this.closeShareBtn = document.getElementById('close-share-btn');
        this.postcardDate = document.getElementById('postcard-date');
        this.postcardTotal = document.getElementById('postcard-total');
        this.postcardChart = document.getElementById('postcard-chart');
        this.postcardList = document.getElementById('postcard-list');
        this.shareLinkInput = document.getElementById('share-link-input');
        this.copyLinkBtn = document.getElementById('copy-link-btn');

        // Settings Modal Elements
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        this.toggleBtns = document.querySelectorAll('.toggle-btn');
        this.countdownConfig = document.getElementById('countdown-config');
        this.countdownInput = document.getElementById('countdown-input');
        this.countdownConfig = document.getElementById('countdown-config');
        this.countdownInput = document.getElementById('countdown-input');
        this.showInTitleCheck = document.getElementById('show-in-title-check');
        this.soundCheck = document.getElementById('sound-check');

        // Notification Settings
        this.notifyCheck = document.getElementById('notify-check');
        this.notifyConfig = document.getElementById('notify-config');
        this.notifyRange = document.getElementById('notify-range');
        this.notifyInput = document.getElementById('notify-input');

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
        this.dashboardExpanded = false;

        // Constants
        this.MAX_TIMERS = 9;
        this.TAG_OPTIONS = [
            { val: '⚪', label: '⚪', color: '#e0e0e0' }, // No Tag
            { val: '🟢', label: '🟢', color: '#4ade80' },
            { val: '🔵', label: '🔵', color: '#60a5fa' },
            { val: '🟡', label: '🟡', color: '#facc15' },
            { val: '🔴', label: '🔴', color: '#f87171' },
            { val: '🟣', label: '🟣', color: '#c084fc' },
            { val: '⚡', label: '⚡', color: '#fbbf24' },
            { val: '💻', label: '💻', color: '#94a3b8' },
            { val: '🎨', label: '🎨', color: '#f472b6' },
            { val: '🧠', label: '🧠', color: '#818cf8' }
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

        this.toggleDashboard = this.toggleDashboard.bind(this);

        this.openShareModal = this.openShareModal.bind(this);
        this.closeShareModal = this.closeShareModal.bind(this);
        this.copyShareLink = this.copyShareLink.bind(this);

        // Modal Bindings
        this.closeAlert = this.closeAlert.bind(this);
        this.closeConfirm = this.closeConfirm.bind(this);
        this.handleConfirmOk = this.handleConfirmOk.bind(this);

        // Theme Binding
        this.toggleTheme = this.toggleTheme.bind(this);

        this.toggleTheme = this.toggleTheme.bind(this);

        this.sound = new SoundManager();
        this.confetti = new Confetti();
        this.init();
    }

    init() {
        // Event Listeners
        this.addTimerBtn.addEventListener('click', this.addTimer);
        this.addTimerBottomBtn.addEventListener('click', this.addTimer);
        this.createFirstBtn.addEventListener('click', this.addTimer);
        this.addTimerBottomBtn.addEventListener('click', this.addTimer);
        this.createFirstBtn.addEventListener('click', this.addTimer);
        this.themeToggleBtn.addEventListener('click', this.toggleTheme);

        // Sound Triggers
        document.addEventListener('click', () => {
            this.sound.init(); // Ensure context is ready
        }, { once: true });

        // Theme Toggle Sound
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.sound.playToggle(document.documentElement.getAttribute('data-theme') === 'light');
            });
        }

        // Delete Sound (Delegated) - REMOVED (Now in confirmDelete)


        // Dashboard
        this.dashboardFooter.addEventListener('click', (e) => {
            if (e.target.closest('.dashboard-content') || e.target.closest('.share-btn')) return;
            this.toggleDashboard();
        });
        this.shareBtn.addEventListener('click', () => this.openShareModal());

        // Share Modal
        this.closeShareBtn.addEventListener('click', this.closeShareModal);
        this.copyLinkBtn.addEventListener('click', this.copyShareLink);

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

        // Notification Settings Sync
        this.notifyCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.notifyConfig.classList.remove('hidden');
                this.requestNotificationPermission();
            } else {
                this.notifyConfig.classList.add('hidden');
            }
        });

        this.notifyRange.addEventListener('input', (e) => {
            this.notifyInput.value = e.target.value;
            this.sound.playScroll();
        });
        this.notifyInput.addEventListener('input', (e) => {
            this.notifyRange.value = e.target.value;
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
        this.updateShareButtonState(); // Check initial state

        // Check for Shared View
        this.checkSharedView();

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
            showInTitle: false,
            notifyEnabled: false,
            notifyTime: 60 * 60 * 1000, // Default 1 hour
            hasNotified: false
        };

        this.timers.push(newTimer);
        this.saveData();
        this.sound.playFlop(); // Play "Flop" sound

        this.renderTimerRow(newTimer, true);
        this.checkEmptyState();
        this.updateAddButtonState();
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
                        this.startTimer(timer);
                    },
                    "Multi-Timer Warning"
                );
                return;
            }
            this.startTimer(timer);
            this.sound.playStart();
        } else {
            timer.isRunning = false;
        }

        this.saveData();
        this.updateRowUI(timer);
    }

    startTimer(timer) {
        timer.isRunning = true;
        timer.lastTick = Date.now();
        if (timer.type === 'countdown' && timer.remaining <= 0) {
            timer.remaining = timer.initialDuration;
        }
        if (timer.type === 'stopwatch' && timer.duration === 0) timer.hasNotified = false;
        if (timer.type === 'countdown' && timer.remaining === timer.initialDuration) timer.hasNotified = false;

        this.saveData();
        this.updateRowUI(timer);
    }

    promptDelete(id) {
        this.timerToDeleteId = id;
        this.showConfirm(
            "Are you sure you want to delete this timer? This action cannot be undone.",
            this.confirmDelete,
            "Delete Timer?"
        );
    }

    confirmDelete() {
        if (this.timerToDeleteId === null) return;

        this.timers = this.timers.filter(t => t.id !== this.timerToDeleteId);
        this.saveData();
        this.renderAllTimers();
        this.checkEmptyState();
        this.updateAddButtonState();
        this.updateShareButtonState();
        this.timerToDeleteId = null;
        this.sound.playDelete(); // Play sound on confirmation
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
                timer.hasNotified = false;
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
                this.checkNotifications(timer);
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
        this.updateShareButtonState(totalTime); // Update share button based on total time

        if (this.dashboardExpanded) {
            this.renderDashboard();
        }

        requestAnimationFrame(this.updateLoop);
    }

    updateShareButtonState(totalTime = null) {
        if (totalTime === null) {
            // Calculate if not provided
            totalTime = this.timers.reduce((acc, t) => {
                return acc + (t.type === 'stopwatch' ? t.duration : (t.initialDuration - t.remaining));
            }, 0);
        }

        if (totalTime > 0) {
            this.shareBtn.disabled = false;
            this.shareBtn.title = "Share Results";
        } else {
            this.shareBtn.disabled = true;
            this.shareBtn.title = "Start a timer to share results";
        }
    }

    // --- Notifications ---

    requestNotificationPermission() {
        if (!("Notification" in window)) {
            this.showAlert("This browser does not support desktop notifications.", "Error");
            return;
        }
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    toggleNotifications() {
        if (this.notifyCheck.checked) {
            if (!window.isSecureContext) {
                this.showAlert("Notifications require HTTPS or Localhost.", "Secure Context Required");
                this.notifyCheck.checked = false;
                this.notifyConfig.classList.add('hidden');
                return;
            }

            if (Notification.permission !== 'granted') {
                Notification.requestPermission().then(permission => {
                    if (permission !== 'granted') {
                        this.notifyCheck.checked = false;
                        this.notifyConfig.classList.add('hidden');
                        this.showAlert('Please enable notifications in your browser settings.', 'Notification Blocked');
                    } else {
                        new Notification("Speedrunner", {
                            body: "Notifications enabled successfully!",
                            icon: "favicon.svg"
                        });
                    }
                });
            } else {
                new Notification("Speedrunner", {
                    body: "Notifications enabled successfully!",
                    icon: "favicon.svg"
                });
            }
        }
    }

    checkNotifications(timer) {
        if (!timer.notifyEnabled || timer.hasNotified) return;

        let timeSpent = 0;
        if (timer.type === 'stopwatch') {
            timeSpent = timer.duration;
        } else {
            timeSpent = timer.initialDuration - timer.remaining;
        }

        if (timeSpent >= timer.notifyTime) {
            this.sendNotification(timer);
            timer.hasNotified = true;
            this.saveData();
        }
    }

    sendNotification(timer) {
        if (Notification.permission === "granted") {
            new Notification(`Time Reached: ${timer.name}`, {
                body: `You have spent ${this.formatTime(timer.notifyTime)} on this task.`,
                icon: 'favicon.ico'
            });
        }
    }

    // --- Dashboard ---

    toggleDashboard() {
        this.dashboardExpanded = !this.dashboardExpanded;
        if (this.dashboardExpanded) {
            this.dashboardFooter.classList.add('expanded');
            this.dashboardContent.classList.remove('hidden');
            this.renderDashboard();
        } else {
            this.dashboardFooter.classList.remove('expanded');
            this.dashboardContent.classList.add('hidden');
        }
    }

    renderDashboard() {
        const { totalMs, gradientParts, legendHtml } = this.calculateStats(this.timers);

        if (totalMs === 0) {
            this.timeChart.style.background = `conic-gradient(var(--color-border) 0% 100%)`;
            this.chartLegend.innerHTML = '<div class="legend-label">No data yet</div>';
            return;
        }

        this.timeChart.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        this.chartLegend.innerHTML = legendHtml;
    }

    calculateStats(timers) {
        let totalMs = 0;
        const data = timers.map(t => {
            const ms = t.type === 'stopwatch' ? t.duration : (t.initialDuration - t.remaining);
            totalMs += ms;
            return { ...t, ms };
        }).filter(t => t.ms > 0);

        if (totalMs === 0) return { totalMs: 0, gradientParts: [], legendHtml: '' };

        let currentDeg = 0;
        const gradientParts = [];
        let legendHtml = '';

        data.forEach(t => {
            const pct = t.ms / totalMs;
            const deg = pct * 360;
            const tagObj = this.TAG_OPTIONS.find(opt => opt.val === t.tag) || this.TAG_OPTIONS[0];
            const color = tagObj.color || '#ccc';

            gradientParts.push(`${color} ${currentDeg}deg ${currentDeg + deg}deg`);
            currentDeg += deg;

            legendHtml += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${color}"></div>
                    <span class="legend-label">${t.name}</span>
                    <span class="legend-val">${this.formatTime(t.ms)}</span>
                </div>
            `;
        });

        return { totalMs, gradientParts, legendHtml };
    }

    // --- Share Feature ---

    checkSharedView() {
        const params = new URLSearchParams(window.location.search);
        const shareData = params.get('share');
        if (shareData) {
            try {
                const decodedString = decodeURIComponent(atob(shareData));
                const items = decodedString.split(';');

                const timers = items.map(item => {
                    const [name, timeStr, tagIndexStr] = item.split('|');
                    const tagIndex = parseInt(tagIndexStr);
                    const tagObj = this.TAG_OPTIONS[tagIndex] || this.TAG_OPTIONS[0];

                    return {
                        name: name,
                        type: 'stopwatch', // Treat as stopwatch for simple duration display
                        duration: parseInt(timeStr),
                        initialDuration: 0,
                        remaining: 0,
                        tag: tagObj.val
                    };
                });

                if (timers.length > 0) {
                    this.openShareModal(timers, true);
                }
            } catch (e) {
                console.error("Invalid share data", e);
            }
        }
    }

    openShareModal(timers = null, viewOnly = false) {
        const modal = document.getElementById('share-modal');
        const overlay = document.getElementById('share-overlay');

        const timersToUse = timers || this.timers;

        // Calculate stats for chart
        const { totalMs, gradientParts } = this.calculateStats(timersToUse);

        this.postcardTotal.textContent = this.formatTime(totalMs);
        this.postcardDate.textContent = new Date().toLocaleDateString();

        // Set Chart Gradient
        if (totalMs === 0) {
            this.postcardChart.style.background = `conic-gradient(var(--color-border) 0% 100%)`;
        } else {
            this.postcardChart.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        }

        // Populate list
        const listEl = this.postcardList;
        listEl.innerHTML = '';
        timersToUse.slice(0, 5).forEach(t => { // Show top 5
            const item = document.createElement('div');
            item.className = 'legend-item';
            // Calculate ms for this timer to display correct time
            const ms = t.type === 'stopwatch' ? t.duration : (t.initialDuration - t.remaining);
            item.innerHTML = `
                <span class="legend-label">${t.name}</span>
                <span class="legend-val">${this.formatTime(ms)}</span>
            `;
            listEl.appendChild(item);
        });

        if (viewOnly) {
            document.querySelector('.share-controls').classList.add('hidden');
            document.querySelector('.share-cta').textContent = "Shared Speedrunner Results";
            this.shareLinkInput.value = window.location.href; // Display the current shared URL
        } else {
            document.querySelector('.share-controls').classList.remove('hidden');
            this.shareLinkInput.value = this.generateShareLink();

            document.querySelector('.share-cta').textContent = "Great Job! Share your results with friends.";
            // No sound for share
            this.confetti.burst();
        }

        this.shareModal.classList.remove('hidden'); // Assuming shareModal is the main modal element
    }

    closeShareModal() {
        this.shareModal.classList.add('hidden');
    }

    generateShareLink() {
        // Compact format: name|time|tagIndex;...
        // Base64 encoded
        const data = this.timers.map(t => {
            const tagObj = this.TAG_OPTIONS.find(opt => opt.val === t.tag) || this.TAG_OPTIONS[0];
            const tagIndex = this.TAG_OPTIONS.indexOf(tagObj); // Get index of the tag
            const time = t.type === 'stopwatch' ? t.duration : (t.initialDuration - t.remaining);
            return `${t.name}|${time}|${tagIndex === -1 ? 0 : tagIndex}`;
        }).join(';');

        return window.location.origin + window.location.pathname + '?share=' + btoa(encodeURIComponent(data));
    }

    copyShareLink() {
        this.shareLinkInput.select();
        document.execCommand('copy');
        this.copyLinkBtn.textContent = "Copied!";
        setTimeout(() => this.copyLinkBtn.textContent = "Copy Link", 2000);
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
        this.timerListEl.innerHTML = '';
        this.timers.forEach(timer => {
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
            if (opt.val !== '⚪' && usedTags.includes(opt.val) && timer.tag !== opt.val) {
                return '';
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
        this.soundCheck.checked = this.sound.enabled;

        // Notification Settings
        this.notifyCheck.checked = !!timer.notifyEnabled;
        if (timer.notifyEnabled) {
            this.notifyConfig.classList.remove('hidden');
        } else {
            this.notifyConfig.classList.add('hidden');
        }

        const notifyMins = Math.floor((timer.notifyTime || 3600000) / 60000);
        this.notifyRange.value = notifyMins;
        this.notifyInput.value = notifyMins;

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

        // Save Sound Preference
        this.sound.setEnabled(this.soundCheck.checked);

        // Notification Settings
        const notifyEnabled = this.notifyCheck.checked;
        const notifyMins = parseInt(this.notifyInput.value) || 60;
        const notifyTime = notifyMins * 60 * 1000;

        let shouldReset = false;

        if (timer.type !== newType) {
            shouldReset = true;
        } else if (newType === 'countdown') {
            const newDuration = (parseInt(this.countdownInput.value) || 25) * 60 * 1000;
            if (newDuration !== timer.initialDuration) {
                shouldReset = true;
            }
        }

        timer.type = newType;

        if (showInTitle) {
            this.timers.forEach(t => t.showInTitle = false);
            timer.showInTitle = true;
        } else {
            timer.showInTitle = false;
        }

        // Save Notification Settings
        timer.notifyEnabled = notifyEnabled;
        timer.notifyTime = notifyTime;
        timer.hasNotified = false;

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
        this.renderAllTimers(null);
        this.closeSettings();
    }

    // --- Delete Modal Logic ---

    promptDelete(id) {
        this.showConfirm(
            "Are you sure you want to delete this timer? This action cannot be undone.",
            () => {
                this.timers = this.timers.filter(t => t.id !== id);
                this.saveData();
                this.renderAllTimers(null);
                this.checkEmptyState();
                this.updateAddButtonState();
                this.sound.playDelete();
            },
            "Delete Timer?"
        );
    }
}

// Initialize
const app = new SpeedrunnerApp();
window.app = app;
