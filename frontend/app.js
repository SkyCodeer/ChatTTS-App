/**
 * ChatTTS Web Frontend - 自然韵律优化版
 */

// 预设配置 — 优化后参数
const PRESETS = {
    default:  { temperature: 0.2, top_P: 0.8, top_K: 30, repetition_penalty: 1.1 },
    news:     { temperature: 0.15, top_P: 0.7, top_K: 20, repetition_penalty: 1.05 },
    story:    { temperature: 0.25, top_P: 0.85, top_K: 40, repetition_penalty: 1.1 },
    podcast:  { temperature: 0.3, top_P: 0.9, top_K: 50, repetition_penalty: 1.15 },
    read:     { temperature: 0.15, top_P: 0.75, top_K: 25, repetition_penalty: 1.05 },
    dialogue: { temperature: 0.35, top_P: 0.9, top_K: 60, repetition_penalty: 1.2 },
};

const DEFAULT_PARAMS = { ...PRESETS.default };

let currentAudioBlob = null;
let audioContext = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSliders();
    initPresets();
    initRefineToggle();
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
        { id: 'temperature',       display: 'temperature-value',       format: v => v.toFixed(2) },
        { id: 'top_P',             display: 'top_P-value',             format: v => v.toFixed(2) },
        { id: 'top_K',             display: 'top_K-value',             format: v => Math.round(v) },
        { id: 'repetition_penalty',display: 'repetition_penalty-value',format: v => v.toFixed(2) },
    ];

    sliders.forEach(({ id, display, format }) => {
        const slider = document.getElementById(id);
        const valueEl = document.getElementById(display);
        if (!slider || !valueEl) return;

        valueEl.textContent = format(parseFloat(slider.value));
        slider.addEventListener('input', () => {
            valueEl.textContent = format(parseFloat(slider.value));
        });
    });

    document.getElementById('reset-params').addEventListener('click', () => {
        setParams(DEFAULT_PARAMS);
        showToast('参数已重置', 'success');
    });
}

function setParams(params) {
    Object.entries(params).forEach(([key, value]) => {
        const slider = document.getElementById(key);
        const display = document.getElementById(`${key}-value`);
        if (!slider || !display) return;

        slider.value = value;
        const format = (key === 'top_K')
            ? v => Math.round(v)
            : v => v.toFixed(2);
        display.textContent = format(value);
    });
}

/* Refine Text Toggle */
function initRefineToggle() {
    const toggle = document.getElementById('refine-text');
    if (!toggle) return;
    toggle.addEventListener('change', () => {
        showToast(
            toggle.checked ? '文本精炼已开启' : '文本精炼已关闭',
            toggle.checked ? 'success' : 'info'
        );
    });
}

/* Presets */
function initPresets() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

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

    textInput.addEventListener('input', () => {
        charCount.textContent = textInput.value.length;
        // 超出限制变红
        charCount.style.color = textInput.value.length > 1000 ? '#ef4444' : '';
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        textInput.value = '';
        charCount.textContent = '0';
        textInput.focus();
    });

    document.getElementById('paste-btn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            textInput.value = text;
            charCount.textContent = text.length;
            showToast('已粘贴文本', 'success');
        } catch {
            showToast('无法访问剪贴板', 'error');
        }
    });
}

/* Generate */
function initGenerate() {
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.addEventListener('click', generateSpeech);

    async function generateSpeech() {
        const text = document.getElementById('text-input').value.trim();

        if (!text) {
            showToast('请输入要转换的文本', 'error');
            return;
        }
        if (text.length > 1000) {
            showToast('文本过长，建议 1000 字以内', 'error');
            return;
        }

        generateBtn.disabled = true;
        generateBtn.classList.add('loading');

        const params = {
            text,
            temperature: parseFloat(document.getElementById('temperature').value),
            top_P: parseFloat(document.getElementById('top_P').value),
            top_K: parseInt(document.getElementById('top_K').value),
            repetition_penalty: parseFloat(document.getElementById('repetition_penalty').value),
            refine_text: document.getElementById('refine-text').checked,
        };

        try {
            const response = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '生成失败');
            }

            currentAudioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(currentAudioBlob);

            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.src = audioUrl;

            document.getElementById('audio-section').hidden = false;

            audioPlayer.addEventListener('loadedmetadata', () => {
                document.getElementById('audio-duration').textContent = formatDuration(audioPlayer.duration);
            });

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
    const audioPlayer = document.getElementById('audio-player');

    playBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play();
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg><span>暂停</span>`;
        } else {
            audioPlayer.pause();
            playBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg><span>播放</span>`;
        }
    });

    audioPlayer.addEventListener('ended', () => {
        playBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg><span>播放</span>`;
    });

    document.getElementById('download-btn').addEventListener('click', () => {
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

    document.getElementById('copy-btn').addEventListener('click', async () => {
        if (!currentAudioBlob) return;
        // ClipboardItem 需要安全上下文（HTTPS 或 localhost），否则降级为下载
        if (typeof ClipboardItem !== 'undefined') {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'audio/wav': currentAudioBlob })]);
                showToast('已复制到剪贴板', 'success');
                return;
            } catch {
                // 安全上下文不可用，降级
            }
        }
        // 回退：触发下载
        const url = URL.createObjectURL(currentAudioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chattts_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('安全上下文不可用，已改用下载', 'info');
    });
}

/* Keyboard Shortcuts */
function initKeyboardShortcuts() {
    document.getElementById('text-input').addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('generate-btn').click();
        }
        if (e.key === 'Escape') {
            document.getElementById('text-input').value = '';
            document.getElementById('current-char').textContent = '0';
        }
    });
}

/* Waveform */
function drawWaveform(audioUrl) {
    const canvas = document.getElementById('waveform-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

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

            const max = Math.max(...waveform);
            const normalized = waveform.map(v => v / max);

            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            const barWidth = width / samples;
            const gap = 2;

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            ctx.fillStyle = isDark ? '#334155' : '#e2e8f0';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#6366f1';

            for (let i = 0; i < normalized.length; i++) {
                const barHeight = Math.max(2, normalized[i] * (height * 0.8));
                const x = i * barWidth;
                const y = (height - barHeight) / 2;
                ctx.beginPath();
                ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 2);
                ctx.fill();
            }
        } catch {
            // 波形渲染失败不影响音频播放，静默忽略
        }
    });
}

/* Toast — XSS safe */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('class', 'toast-icon');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '2');
    iconSvg.innerHTML = type === 'success'
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;

    toast.appendChild(iconSvg);
    toast.appendChild(messageSpan);
    container.appendChild(toast);

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
