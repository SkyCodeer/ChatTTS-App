/**
 * ChatTTS Web Frontend - Enhanced Version
 */

// Preset configurations
const PRESETS = {
    default: { speed: 5, temperature: 0.3, top_k: 20, top_p: 0.7 },
    news: { speed: 6, temperature: 0.2, top_k: 10, top_p: 0.5 },
    story: { speed: 4, temperature: 0.4, top_k: 40, top_p: 0.8 },
    chat: { speed: 5, temperature: 0.5, top_k: 50, top_p: 0.9 },
    poetry: { speed: 3, temperature: 0.6, top_k: 60, top_p: 0.95 },
    tech: { speed: 7, temperature: 0.2, top_k: 15, top_p: 0.6 }
};

// Default values for reset
const DEFAULT_PARAMS = { ...PRESETS.default };

// State
let currentAudioBlob = null;
let audioContext = null;
let analyser = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSliders();
    initPresets();
    initTextActions();
    initGenerate();
    initAudioActions();
    initKeyboardShortcuts();
});

/* Theme */
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', savedTheme);

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

/* Sliders */
function initSliders() {
    const sliders = [
        { id: 'speed', display: 'speed-value', formatter: v => Math.round(v) },
        { id: 'temperature', display: 'temperature-value', formatter: v => v.toFixed(1) },
        { id: 'top_k', display: 'top_k-value', formatter: v => Math.round(v) },
        { id: 'top_p', display: 'top_p-value', formatter: v => v.toFixed(1) }
    ];

    sliders.forEach(({ id, display, formatter }) => {
        const slider = document.getElementById(id);
        const valueEl = document.getElementById(display);

        // Initialize display
        valueEl.textContent = formatter(parseFloat(slider.value));

        slider.addEventListener('input', () => {
            valueEl.textContent = formatter(parseFloat(slider.value));
        });
    });

    // Reset button
    document.getElementById('reset-params').addEventListener('click', () => {
        setParams(DEFAULT_PARAMS);
        showToast('参数已重置', 'success');
    });
}

function setParams(params) {
    Object.entries(params).forEach(([key, value]) => {
        const slider = document.getElementById(key);
        const display = document.getElementById(`${key}-value`);

        if (slider && display) {
            slider.value = value;

            const formatter = key === 'temperature' || key === 'top_p'
                ? v => v.toFixed(1)
                : v => Math.round(v);

            display.textContent = formatter(value);
        }
    });
}

/* Presets */
function initPresets() {
    const presetBtns = document.querySelectorAll('.preset-btn');

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply preset
            const preset = btn.dataset.preset;
            if (PRESETS[preset]) {
                setParams(PRESETS[preset]);
                showToast(`已应用「${btn.querySelector('span:last-child').textContent}」预设`, 'success');
            }
        });
    });
}

/* Text Actions */
function initTextActions() {
    const textInput = document.getElementById('text-input');
    const charCount = document.getElementById('current-char');

    // Character count
    textInput.addEventListener('input', () => {
        charCount.textContent = textInput.value.length;
    });

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
        textInput.value = '';
        charCount.textContent = '0';
        textInput.focus();
    });

    // Paste button
    document.getElementById('paste-btn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            textInput.value = text;
            charCount.textContent = text.length;
            showToast('已粘贴文本', 'success');
        } catch (err) {
            showToast('无法访问剪贴板', 'error');
        }
    });
}

/* Generate */
function initGenerate() {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');

    generateBtn.addEventListener('click', generateSpeech);

    async function generateSpeech() {
        const text = textInput.value.trim();

        if (!text) {
            showToast('请输入要转换的文本', 'error');
            textInput.focus();
            return;
        }

        // Set loading state
        generateBtn.disabled = true;
        generateBtn.classList.add('loading');

        const params = {
            text,
            speed: parseInt(document.getElementById('speed').value),
            temperature: parseFloat(document.getElementById('temperature').value),
            top_k: parseInt(document.getElementById('top_k').value),
            top_p: parseFloat(document.getElementById('top_p').value)
        };

        try {
            const response = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '生成失败');
            }

            currentAudioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(currentAudioBlob);

            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.src = audioUrl;

            // Show audio section
            const audioSection = document.getElementById('audio-section');
            audioSection.hidden = false;

            // Get audio duration
            audioPlayer.addEventListener('loadedmetadata', () => {
                const duration = formatDuration(audioPlayer.duration);
                document.getElementById('audio-duration').textContent = duration;
            });

            // Draw waveform
            drawWaveform(audioUrl);

            showToast('语音生成成功', 'success');

        } catch (err) {
            showToast(`错误: ${err.message}`, 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
        }
    }
}

/* Audio Actions */
function initAudioActions() {
    const playBtn = document.getElementById('play-btn');
    const downloadBtn = document.getElementById('download-btn');
    const copyBtn = document.getElementById('copy-btn');
    const audioPlayer = document.getElementById('audio-player');

    playBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play();
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
                <span>暂停</span>
            `;
        } else {
            audioPlayer.pause();
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>播放</span>
            `;
        }
    });

    audioPlayer.addEventListener('ended', () => {
        playBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>播放</span>
        `;
    });

    downloadBtn.addEventListener('click', () => {
        if (!currentAudioBlob) return;

        const url = URL.createObjectURL(currentAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chattts_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('已开始下载', 'success');
    });

    copyBtn.addEventListener('click', async () => {
        if (!currentAudioBlob) return;

        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'audio/wav': currentAudioBlob })
            ]);
            showToast('已复制到剪贴板', 'success');
        } catch (err) {
            showToast('复制失败，请尝试下载', 'error');
        }
    });
}

/* Keyboard Shortcuts */
function initKeyboardShortcuts() {
    const textInput = document.getElementById('text-input');

    textInput.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to generate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('generate-btn').click();
        }

        // Escape to clear
        if (e.key === 'Escape') {
            textInput.value = '';
            document.getElementById('current-char').textContent = '0';
        }
    });
}

/* Waveform */
function drawWaveform(audioUrl) {
    const canvas = document.getElementById('waveform-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // Create audio context
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const audio = new Audio();
    audio.src = audioUrl;

    audio.addEventListener('canplaythrough', async () => {
        try {
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Get waveform data
            const rawData = audioBuffer.getChannelData(0);
            const samples = 100;
            const blockSize = Math.floor(rawData.length / samples);
            const waveform = [];

            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[i * blockSize + j]);
                }
                waveform.push(sum / blockSize);
            }

            // Normalize
            const max = Math.max(...waveform);
            const normalized = waveform.map(v => v / max);

            // Draw
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            const barWidth = width / samples;
            const gap = 2;

            // Get theme colors
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const primaryColor = '#6366f1';
            const bgColor = isDark ? '#334155' : '#e2e8f0';

            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = primaryColor;

            for (let i = 0; i < normalized.length; i++) {
                const barHeight = normalized[i] * (height * 0.8) + 2;
                const x = i * barWidth;
                const y = (height - barHeight) / 2;

                ctx.beginPath();
                ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 2);
                ctx.fill();
            }

        } catch (err) {
            console.error('Waveform error:', err);
        }
    });
}

/* Toast */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success'
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* Utilities */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
