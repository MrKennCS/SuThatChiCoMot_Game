// --- CẤU HÌNH TRÒ CHƠI ---
let DATABASE_SCENARIOS = [];
let currentScenario = null;
let currentSuspect = null;
let score = 10;
let attempts = {};
let chatHistories = {};
let isTyping = {};
const MAX_ATTEMPTS = 3;
let currentMobileTab = 'case'; // 'case' | 'suspects' | 'chat'

// ==========================================
// HỆ THỐNG ÂM THANH (AUDIO CONTEXT)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isSoundEnabled = true;

// Mở khóa AudioContext khi người chơi tương tác lần đầu (Click hoặc Touch)
const unlockAudio = () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
};
document.body.addEventListener('click', unlockAudio, {once: true});
document.body.addEventListener('touchstart', unlockAudio, {once: true});

document.getElementById('soundToggle').addEventListener('change', (e) => {
    isSoundEnabled = e.target.checked;
    if(isSoundEnabled) {
        unlockAudio();
        playNotifySound();
    }
});

function playTone(freq, type, duration, vol=0.1) {
    if (!isSoundEnabled) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function playNotifySound() {
    playTone(800, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(1200, 'sine', 0.15, 0.1), 100);
}
function playWinSound() {
    playTone(400, 'triangle', 0.1, 0.1);
    setTimeout(() => playTone(500, 'triangle', 0.1, 0.1), 100);
    setTimeout(() => playTone(600, 'triangle', 0.1, 0.1), 200);
    setTimeout(() => playTone(800, 'triangle', 0.4, 0.1), 300);
}
function playLoseSound() {
    playTone(300, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playTone(250, 'sawtooth', 0.5, 0.1), 300);
}

// ==========================================
// HỆ THỐNG THÔNG BÁO (NOTIFICATION TOAST)
// ==========================================
function showNotification(name, text) {
    const container = document.getElementById('notificationArea');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = "toast-bg bg-gray-800/95 border border-gray-600 rounded-xl p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3 toast-enter backdrop-blur-md";

    const shortText = text.length > 45 ? text.substring(0, 45) + '...' : text;

    toast.innerHTML = `
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs shrink-0">💬</div>
        <div class="flex-1 min-w-0">
            <h4 class="text-xs font-bold text-purple-400 truncate">${name} gửi tin nhắn</h4>
            <p class="toast-text text-[10px] text-gray-300 font-medium truncate">${shortText}</p>
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- DOM ELEMENTS ---
const screens = {
    menu: document.getElementById('mainMenu'),
    loading: document.getElementById('loadingScreen'),
    game: document.getElementById('gameBoard'),
    settings: document.getElementById('settingsModal'),
    result: document.getElementById('resultModal'),
    accuse: document.getElementById('accuseModal'),
    statement: document.getElementById('statementModal')
};

const UI = {
    navCase: document.getElementById('navCase'),
    navSuspects: document.getElementById('navSuspects'),
    panelDossier: document.getElementById('panelDossier'),
    panelChat: document.getElementById('panelChat'),
    viewCase: document.getElementById('viewCase'),
    viewSuspects: document.getElementById('viewSuspects'),
    caseIdUI: document.getElementById('caseIdUI'),
    mobileCaseIdUI: document.getElementById('mobileCaseIdUI'),
    caseTitle: document.getElementById('caseTitle'),
    caseVictim: document.getElementById('caseVictim'),
    caseContext: document.getElementById('caseContext'),
    suspectList: document.getElementById('suspectList'),
    accuseSelect: document.getElementById('accuseSelect'),
    currentSuspectName: document.getElementById('currentSuspectName'),
    initialStatementTooltip: document.getElementById('initialStatementTooltip'),
    attemptCount: document.getElementById('attemptCount'),
    chatBox: document.getElementById('chatBox'),
    userInput: document.getElementById('userInput'),
    btnSend: document.getElementById('btnSend'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    mobileScoreDisplay: document.getElementById('mobileScoreDisplay'),
    chatBadge: document.getElementById('chatBadge')
};

// ==========================================
// ĐIỀU HƯỚNG TAB & RESPONSIVE LAYOUT
// ==========================================
function switchMobileTab(tab) {
    currentMobileTab = tab;

    const tabCase = document.getElementById('tabMobileCase');
    const tabSuspects = document.getElementById('tabMobileSuspects');
    const tabChat = document.getElementById('tabMobileChat');

    [tabCase, tabSuspects, tabChat].forEach(btn => {
        if (btn) btn.classList.remove('active', 'text-purple-400');
    });

    if (window.innerWidth < 768) {
        // --- CHẾ ĐỘ MOBILE (< 768px) ---
        if (tab === 'case') {
            if (tabCase) tabCase.classList.add('active', 'text-purple-400');
            UI.panelDossier.classList.remove('hidden');
            UI.panelDossier.classList.add('flex');
            UI.viewCase.classList.remove('hidden');
            UI.viewSuspects.classList.add('hidden');
            UI.panelChat.classList.add('hidden');
            UI.panelChat.classList.remove('flex');
        } else if (tab === 'suspects') {
            if (tabSuspects) tabSuspects.classList.add('active', 'text-purple-400');
            UI.panelDossier.classList.remove('hidden');
            UI.panelDossier.classList.add('flex');
            UI.viewCase.classList.add('hidden');
            UI.viewSuspects.classList.remove('hidden');
            UI.panelChat.classList.add('hidden');
            UI.panelChat.classList.remove('flex');
        } else if (tab === 'chat') {
            if (tabChat) tabChat.classList.add('active', 'text-purple-400');
            UI.panelDossier.classList.add('hidden');
            UI.panelDossier.classList.remove('flex');
            UI.panelChat.classList.remove('hidden');
            UI.panelChat.classList.add('flex');
            if (UI.chatBadge) UI.chatBadge.classList.add('hidden');

            setTimeout(() => {
                if (UI.chatBox) UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
            }, 60);
        }
    } else {
        // --- CHẾ ĐỘ DESKTOP & TABLET NGANG (>= 768px) ---
        UI.panelDossier.classList.remove('hidden');
        UI.panelDossier.classList.add('flex');
        UI.panelChat.classList.remove('hidden');
        UI.panelChat.classList.add('flex');

        if (tab === 'suspects') {
            UI.navSuspects.classList.add('active');
            UI.navCase.classList.remove('active');
            UI.viewSuspects.classList.remove('hidden');
            UI.viewCase.classList.add('hidden');
        } else {
            UI.navCase.classList.add('active');
            UI.navSuspects.classList.remove('active');
            UI.viewCase.classList.remove('hidden');
            UI.viewSuspects.classList.add('hidden');
        }
    }
}

// Gắn sự kiện tab Mobile
document.getElementById('tabMobileCase').onclick = () => switchMobileTab('case');
document.getElementById('tabMobileSuspects').onclick = () => switchMobileTab('suspects');
document.getElementById('tabMobileChat').onclick = () => switchMobileTab('chat');

// Gắn sự kiện tab Desktop
UI.navCase.onclick = () => switchMobileTab('case');
UI.navSuspects.onclick = () => switchMobileTab('suspects');

// Tự động thích ứng khi xoay màn hình (Orientation Change) hoặc thay đổi kích thước
window.addEventListener('resize', () => {
    resizeCanvas();
    if (!screens.game.classList.contains('hidden')) {
        switchMobileTab(currentMobileTab);
    }
});

// ==========================================
// THIẾT LẬP MENU & CÀI ĐẶT
// ==========================================
let customApiKey = localStorage.getItem('detective_custom_api_key') || '';
const apiKeyInput = document.getElementById('customApiKeyInput');
if (apiKeyInput && customApiKey) {
    apiKeyInput.value = customApiKey;
}
const btnSaveApiKey = document.getElementById('btnSaveApiKey');
if (btnSaveApiKey && apiKeyInput) {
    btnSaveApiKey.onclick = () => {
        customApiKey = apiKeyInput.value.trim();
        localStorage.setItem('detective_custom_api_key', customApiKey);
        if (customApiKey) {
            alert('Đã lưu API Key riêng thành công! Các câu hỏi thẩm vấn sẽ dùng Key này.');
        } else {
            alert('Đã chuyển về sử dụng Key mặc định của máy chủ.');
        }
    };
}

const openSettings = () => {
    screens.settings.classList.remove('hidden');
    setTimeout(() => screens.settings.children[0].classList.remove('scale-95'), 50);
};
const closeSettings = () => {
    screens.settings.children[0].classList.add('scale-95');
    setTimeout(() => screens.settings.classList.add('hidden'), 200);
};

document.getElementById('btnSettingsMenu').onclick = openSettings;
document.getElementById('btnSettingsGame').onclick = openSettings;
document.getElementById('btnSettingsMobile').onclick = openSettings;
document.getElementById('btnCloseSettings').onclick = closeSettings;

document.getElementById('themeToggle').addEventListener('change', (e) => {
    const themeStatus = document.getElementById('themeStatus');
    if (e.target.checked) {
        document.body.classList.remove('light-theme');
        themeStatus.innerText = "Đang bật: Cyberpunk (Dark)";
        themeStatus.className = "text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium";
    } else {
        document.body.classList.add('light-theme');
        themeStatus.innerText = "Đang bật: Lavender (Light)";
        themeStatus.className = "text-[10px] sm:text-xs font-bold text-purple-600 mt-0.5";
    }
});

const openAccuseModal = () => {
    screens.accuse.classList.remove('hidden');
    setTimeout(() => screens.accuse.children[0].classList.remove('scale-95'), 50);
};
const closeAccuseModal = () => {
    screens.accuse.children[0].classList.add('scale-95');
    setTimeout(() => screens.accuse.classList.add('hidden'), 200);
};

document.getElementById('btnOpenAccuse').onclick = openAccuseModal;
document.getElementById('btnOpenAccuseMobile').onclick = openAccuseModal;
document.getElementById('btnCloseAccuse').onclick = closeAccuseModal;

// ==========================================
// MODAL XEM LỜI KHAI BAN ĐẦU (TOUCH / MOBILE)
// ==========================================
function openStatementModal(suspectId) {
    const suspect = currentScenario.suspects[suspectId];
    if (!suspect) return;

    document.getElementById('statementModalName').innerText = suspect.name;
    document.getElementById('statementModalRole').innerText = `Vai trò: ${suspect.role}`;
    document.getElementById('statementModalContent').innerText = `"${suspect.initial}"`;

    screens.statement.classList.remove('hidden');

    const btnInterrogate = document.getElementById('btnInterrogateFromModal');
    btnInterrogate.onclick = () => {
        closeStatementModal();
        const suspectBtn = document.getElementById(`btn-suspect-${suspectId}`);
        selectSuspect(suspectId, suspectBtn);
        if (window.innerWidth < 768) {
            switchMobileTab('chat');
        }
    };
}

function closeStatementModal() {
    screens.statement.classList.add('hidden');
}

document.getElementById('btnCloseStatement').onclick = closeStatementModal;
document.getElementById('btnViewStatementHeader').onclick = () => {
    if (currentSuspect) {
        openStatementModal(currentSuspect.id);
    } else {
        alert("Vui lòng chọn một mục tiêu nghi phạm trước!");
    }
};

// ==========================================
// TẢI GAME VÀ KHỞI TẠO DỮ LIỆU VỤ ÁN
// ==========================================
document.getElementById('btnStartGame').onclick = async () => {
    screens.menu.style.opacity = '0';

    const progressBar = document.getElementById('progressBar');
    progressBar.style.transitionDuration = '0s';
    progressBar.style.width = '0%';

    try {
        const response = await fetch('./data.json');
        DATABASE_SCENARIOS = await response.json();
    } catch (error) {
        alert("Lỗi tải dữ liệu vụ án! Vui lòng kiểm tra lại kết nối mạng.");
        return;
    }

    setTimeout(() => {
        screens.menu.classList.add('hidden');
        screens.loading.classList.remove('hidden');
        screens.loading.classList.add('flex');

        setTimeout(() => {
            progressBar.style.transitionDuration = '2s';
            progressBar.style.width = '100%';
        }, 50);

        setupRandomScenario();
        setTimeout(() => {
            screens.loading.classList.remove('flex');
            screens.loading.classList.add('hidden');
            screens.game.classList.remove('hidden', 'opacity-0');
            screens.game.classList.add('flex', 'fade-in');
            switchMobileTab('case');
        }, 2000);
    }, 500);
};

function updateScoreDisplay() {
    const formatted = score.toFixed(1);
    if (UI.scoreDisplay) UI.scoreDisplay.innerText = formatted;
    if (UI.mobileScoreDisplay) UI.mobileScoreDisplay.innerText = formatted;
}

function setupRandomScenario() {
    currentScenario = DATABASE_SCENARIOS[Math.floor(Math.random() * DATABASE_SCENARIOS.length)];
    score = 10; attempts = {}; chatHistories = {}; isTyping = {}; currentSuspect = null;

    UI.currentSuspectName.innerText = "Chưa chọn mục tiêu";
    UI.initialStatementTooltip.innerText = "Hãy chọn mục tiêu từ danh sách Nghi Phạm.";
    UI.attemptCount.innerText = "Chờ lệnh";
    UI.attemptCount.className = "text-[11px] sm:text-xs font-bold bg-gray-800 text-gray-400 px-2.5 sm:px-3 py-1 rounded-full border border-gray-600 whitespace-nowrap";
    updateScoreDisplay();
    UI.userInput.disabled = true; UI.btnSend.disabled = true;

    UI.caseIdUI.innerText = currentScenario.case_id;
    if (UI.mobileCaseIdUI) UI.mobileCaseIdUI.innerText = currentScenario.case_id;

    UI.caseTitle.innerText = currentScenario.title;
    UI.caseVictim.innerText = currentScenario.victim;
    UI.caseContext.innerHTML = currentScenario.context_html || currentScenario.context;

    UI.suspectList.innerHTML = '';
    UI.accuseSelect.innerHTML = '<option value="">-- Chọn kẻ thủ ác --</option>';

    for (const key in currentScenario.suspects) {
        attempts[key] = 0; isTyping[key] = false;
        chatHistories[key] = [ { sender: "hệ thống", text: `[TRÍCH XUẤT LỜI KHAI BAN ĐẦU]: "${currentScenario.suspects[key].initial}"` } ];

        const suspect = currentScenario.suspects[key];
        const btn = document.createElement('div');
        btn.id = `btn-suspect-${key}`;
        btn.className = "text-left bg-gray-800/50 hover:bg-gray-700/80 p-3 sm:p-4 rounded-xl border border-gray-700 transition-all flex flex-col gap-1.5 group cursor-pointer active:scale-[0.98]";
        btn.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <span class="suspect-name font-bold text-blue-400 text-base sm:text-lg transition-colors truncate">${suspect.name}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-statement-card text-[11px] sm:text-xs text-purple-400 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/50 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold transition-all" title="Xem lời khai">
                        <span>👁️</span> <span>Lời khai</span>
                    </button>
                    <span class="status-badge text-[10px] font-bold text-gray-400 bg-black/50 px-2 py-0.5 rounded border border-gray-700 transition-all">ID: ${key.toUpperCase()}</span>
                </div>
            </div>
            <span class="text-xs text-red-400 font-semibold italic border-l-2 border-red-500 pl-2">Vai trò: ${suspect.role}</span>
        `;

        btn.onclick = (e) => {
            if (e.target.closest('.btn-statement-card')) {
                e.stopPropagation();
                openStatementModal(key);
                return;
            }
            selectSuspect(key, btn);
            if (window.innerWidth < 768) {
                switchMobileTab('chat');
            }
        };
        UI.suspectList.appendChild(btn);

        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = suspect.name;
        UI.accuseSelect.appendChild(opt);
    }

    UI.chatBox.innerHTML = '<div class="text-center text-gray-500 mt-20 sm:mt-32 text-xs sm:text-sm italic tracking-widest font-bold">[ HỆ THỐNG ĐÃ SẴN SÀNG ]<br>Chuyển sang tab Nghi Phạm để bắt đầu.</div>';
    switchMobileTab('case');
}

function selectSuspect(suspectId, btnElement) {
    currentSuspect = currentScenario.suspects[suspectId];
    currentSuspect.id = suspectId;

    UI.currentSuspectName.innerText = currentSuspect.name;
    UI.initialStatementTooltip.innerText = `"${currentSuspect.initial}"`;

    document.querySelectorAll('#suspectList > div').forEach(b => {
        b.classList.remove('border-purple-500', 'bg-gray-700/80', 'border-l-[6px]');
    });
    if (btnElement) {
        btnElement.classList.add('border-purple-500', 'bg-gray-700/80', 'border-l-[6px]');
    }

    updateAttemptUI();
    renderChat(suspectId);

    if (!UI.userInput.disabled && window.innerWidth >= 768) {
        UI.userInput.focus();
    }
}

function renderChat(suspectId) {
    UI.chatBox.innerHTML = '';
    if (!chatHistories[suspectId] || chatHistories[suspectId].length === 0) {
        UI.chatBox.innerHTML = '<div class="text-center text-gray-600 mt-16 sm:mt-20 text-xs italic tracking-widest">[ BẮT ĐẦU PHIÊN THẨM VẤN MỚI ]</div>';
    } else {
        chatHistories[suspectId].forEach(msg => {
            appendMessageToDOM(msg.sender, msg.text, suspectId);
        });
    }
    if (isTyping[suspectId]) {
        appendTypingIndicator(suspectId);
    }
    UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
}

function appendTypingIndicator(targetId) {
    if (document.getElementById(`typing-indicator-${targetId}`)) return;
    const suspectName = currentScenario.suspects[targetId].name;
    const typingDiv = document.createElement('div');
    typingDiv.id = `typing-indicator-${targetId}`;
    typingDiv.className = "bg-gray-800/80 p-3 rounded-2xl rounded-bl-none self-start max-w-[85%] sm:max-w-[80%] border border-gray-600/50 shadow-lg msg-fade-in";
    typingDiv.innerHTML = `<span class="text-[10px] font-black text-blue-400 block mb-1 uppercase tracking-widest">${suspectName}</span><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    UI.chatBox.appendChild(typingDiv);
}

function appendMessageToDOM(sender, text, suspectId) {
    const suspectName = currentScenario.suspects[suspectId].name;
    const msgDiv = document.createElement('div');

    if (sender === "thanh tra") {
        msgDiv.className = "bg-purple-900/60 text-white p-3 sm:p-3.5 rounded-2xl rounded-br-none self-end max-w-[88%] sm:max-w-[80%] border border-purple-500/50 shadow-lg msg-fade-in";
        msgDiv.innerHTML = `<span class="text-[10px] font-black text-purple-300 block mb-1 uppercase tracking-widest">Bạn (Thám tử)</span><span class="font-medium text-xs sm:text-sm leading-relaxed">${text}</span>`;
    } else if (sender === "hệ thống") {
        msgDiv.className = "bg-black/50 text-red-400 p-2 sm:p-2.5 rounded-lg self-center text-[11px] sm:text-xs italic font-semibold w-[95%] sm:w-[90%] text-center border-l-2 border-r-2 border-red-900 msg-fade-in";
        msgDiv.innerHTML = `<span>${text}</span>`;
    } else {
        msgDiv.className = "bg-gray-800/80 text-gray-100 p-3 sm:p-3.5 rounded-2xl rounded-bl-none self-start max-w-[88%] sm:max-w-[80%] border border-gray-600/50 shadow-lg msg-fade-in";
        msgDiv.innerHTML = `<span class="text-[10px] font-black text-blue-400 block mb-1 uppercase tracking-widest">${suspectName}</span><span class="font-medium text-xs sm:text-sm leading-relaxed">${text}</span>`;
    }
    UI.chatBox.appendChild(msgDiv);
}

function addMessage(sender, text, targetId) {
    if (!chatHistories[targetId]) chatHistories[targetId] = [];
    chatHistories[targetId].push({ sender: sender, text: text });
    if (currentSuspect && currentSuspect.id === targetId) {
        appendMessageToDOM(sender, text, targetId);
        UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
    }
}

function updateAttemptBadge(targetId) {
    const left = MAX_ATTEMPTS - attempts[targetId];
    const suspectBtn = document.getElementById(`btn-suspect-${targetId}`);
    if (!suspectBtn) return;
    const statusBadge = suspectBtn.querySelector('.status-badge');
    const suspectName = suspectBtn.querySelector('.suspect-name');

    if (left > 1) {
        suspectBtn.classList.remove('opacity-50');
        suspectName.classList.remove('text-gray-500');
        suspectName.classList.add('text-blue-400');
        if(statusBadge) {
            statusBadge.innerHTML = `ID: ${targetId.toUpperCase()}`;
            statusBadge.className = "status-badge text-[10px] font-bold text-gray-400 bg-black/50 px-2 py-0.5 rounded border border-gray-700 transition-all";
        }
    } else if (left === 1) {
        suspectBtn.classList.remove('opacity-50');
        suspectName.classList.remove('text-gray-500');
        suspectName.classList.add('text-blue-400');
        if(statusBadge) {
            statusBadge.innerHTML = `⚠️ 1 LƯỢT`;
            statusBadge.className = "status-badge text-[10px] font-bold text-yellow-400 bg-yellow-950/80 px-2 py-0.5 rounded border border-yellow-700 animate-pulse";
        }
    } else {
        suspectBtn.classList.add('opacity-50');
        suspectName.classList.remove('text-blue-400');
        suspectName.classList.add('text-gray-500');
        if(statusBadge) {
            statusBadge.innerHTML = `🚫 KHÓA`;
            statusBadge.className = "status-badge text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800 transition-all";
        }
    }
}

function updateAttemptUI() {
    if(!currentSuspect) return;
    const targetId = currentSuspect.id;
    const left = MAX_ATTEMPTS - attempts[targetId];
    updateAttemptBadge(targetId);

    UI.attemptCount.innerText = `Lượt: ${left}/${MAX_ATTEMPTS}`;
    if (left > 1) {
        UI.attemptCount.className = "text-[11px] sm:text-xs font-bold bg-green-900/50 text-green-400 px-2.5 sm:px-3 py-1 rounded-full border border-green-500/50 whitespace-nowrap";
        UI.userInput.disabled = false; UI.btnSend.disabled = false; UI.userInput.placeholder = "Nhập câu hỏi chất vấn...";
    } else if (left === 1) {
        UI.attemptCount.className = "text-[11px] sm:text-xs font-bold bg-yellow-900/50 text-yellow-400 px-2.5 sm:px-3 py-1 rounded-full border border-yellow-500/50 animate-pulse whitespace-nowrap";
        UI.userInput.disabled = false; UI.btnSend.disabled = false; UI.userInput.placeholder = "Chất vấn chốt hạ...";
    } else {
        UI.attemptCount.className = "text-[11px] sm:text-xs font-bold bg-red-900/50 text-red-400 px-2.5 sm:px-3 py-1 rounded-full border border-red-500/50 whitespace-nowrap";
        UI.userInput.disabled = true; UI.btnSend.disabled = true; UI.userInput.placeholder = "Mục tiêu đã khóa miệng.";
    }
}

function getCleanContext(scenario) {
    if (scenario.context) return scenario.context;
    if (scenario.context_html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = scenario.context_html;
        return tempDiv.textContent || tempDiv.innerText || "";
    }
    return "Hiện trường vụ án mạng";
}

// ==========================================
// GỌI API THÔNG QUA NETLIFY SERVERLESS
// ==========================================
async function askAI(question, targetId) {
    const targetSuspect = currentScenario.suspects[targetId];
    isTyping[targetId] = true;

    setTimeout(() => {
        if (isTyping[targetId] && currentSuspect && currentSuspect.id === targetId) {
            appendTypingIndicator(targetId);
            UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
        }
    }, 400);

    const cleanContext = getCleanContext(currentScenario);
    let psychoPrompt = "";
    if (targetSuspect.psycho) {
        const p = targetSuspect.psycho;
        psychoPrompt = `Tính cách: ${p.trait || ""}. Đại từ xưng hô: ${p.pronouns || ""}. Cử chỉ/Hành vi đặc trưng: ${p.behavior || ""}. `;
    }

    const recentHistory = (chatHistories[targetId] || [])
        .slice(0, -1)
        .filter(m => m.sender === "thanh tra" || m.sender === "nghi phạm")
        .map(m => m.sender === "thanh tra" ? `Thám tử: "${m.text}"` : `Bạn (${targetSuspect.name}): "${m.text}"`)
        .join("\n");
    const historyBlock = recentHistory ? `\n[LỊCH SỬ THẨM VẤN TRƯỚC ĐÓ VỚI THÁM TỬ]:\n${recentHistory}\n` : "";

    const prompt = `Bạn đang tham gia một trò chơi trinh thám suy luận. Hãy NHẬP VAI 100% vào nhân vật, TUYỆT ĐỐI KHÔNG hé lộ bạn là AI hay nói chuyện ngoài vai diễn.

THÔNG TIN NHÂN VẬT CỦA BẠN:
- Họ tên & Vai trò: ${targetSuspect.name} (${targetSuspect.role})
- ${psychoPrompt}
- Lời khai ban đầu của bạn: "${targetSuspect.initial}"
- Sự thật / Bí mật thực tế của bạn: "${targetSuspect.truth}"

BỐI CẢNH HIỆN TRƯỜNG & VỤ ÁN:
- Nạn nhân: ${currentScenario.victim}
- Bối cảnh: ${cleanContext}
${historyBlock}
CÂU HỎI MỚI CỦA THÁM TỬ: "${question}"

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. ĐỘ DÀI & ĐỊNH DẠNG: Trả lời tự nhiên, độ dài khoảng 50 - 80 chữ. CHỈ TRẢ LỜI LỜI THOẠI TRỰC TIẾP của nhân vật (có thể kèm cử chỉ trong dấu sao *...*). TUYỆT ĐỐI KHÔNG lặp lại câu hỏi, không thêm tiền tố như "Input:", "'s input:", "Trả lời:"... Nếu thám tử chỉ chào hỏi ngắn gọn (như "hello", "chào bạn"), hãy đáp lại tự nhiên theo tính cách nhân vật.
2. HỢP TÁC & CUNG CẤP LỜI KHAI:
   - Khi được hỏi về lịch trình / alibi: Hãy kể lại bạn đã ở đâu, làm gì vào các thời điểm liên quan dựa theo bối cảnh và lời khai ban đầu.
   - Khi được hỏi về người khác / đồ vật / hiện trường: Hãy chia sẻ những điều bạn nhìn thấy, nghe thấy hoặc nhận xét về người khác trong vụ án để thám tử có manh mối điều tra.
   - TUYỆT ĐỐI TRÁNH kiểu trả lời cùn máy móc như "Bằng chứng đâu", "Không có bằng chứng thì đừng nói". Nếu bị nghi ngờ, hãy dùng cảm xúc, lý lẽ và chứng cứ ngoại phạm của nhân vật để thanh minh.
3. PHÂN HÓA HUNG THỦ VÀ NGƯỜI VÔ TỘI:
   - NẾU BẠN VÔ TỘI: Bạn hoàn toàn không giết người. Nếu có bí mật phụ (lén lút, giấu đồ, việc riêng...), bạn có thể ngập ngừng ban đầu nhưng khi bị thám tử hỏi dồn logic sẽ thành thật kể ra để tự minh oan.
   - NẾU BẠN LÀ HUNG THỦ: Hãy tỏ ra tự tin, ngụy tạo bằng chứng ngoại phạm khéo léo và có thể đánh lạc hướng sang người khác; chỉ khi thám tử chỉ ra đúng mâu thuẫn thời gian, cơ học hay vật chứng then chốt thì mới bối rối, hoảng sợ hoặc lỡ lời.`;

    let success = false;
    let aiResponse = "";
    let lastErrorMsg = "";

    try {
        const response = await fetch("/.netlify/functions/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: prompt,
                customApiKey: customApiKey
            })
        });

        let data = {};
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const rawText = await response.text();
            throw new Error(`Máy chủ trả về trạng thái ${response.status} (${response.statusText}). Vui lòng kiểm tra Netlify Functions / GEMINI_API_KEY.`);
        }

        if (response.ok && data.reply) {
            let cleanedReply = data.reply.trim().replace(/^('s\s*input:?|input:?|trả\s*lời:?|output:?)\s*(\*{1,2})?\s*(".*?")?/i, "").trim();
            aiResponse = cleanedReply || data.reply;
            success = true;
        } else {
            lastErrorMsg = data.error || "Không thể kết nối máy chủ AI";
        }
    } catch (error) {
        lastErrorMsg = error.message;
    }

    isTyping[targetId] = false;

    if (currentSuspect && currentSuspect.id === targetId) {
        const typingElement = document.getElementById(`typing-indicator-${targetId}`);
        if (typingElement) typingElement.remove();
    }

    if (success) {
        addMessage("nghi phạm", aiResponse, targetId);
        playNotifySound();

        // Nếu người chơi đang ở màn hình khác trên mobile hoặc đang chọn người khác
        if (window.innerWidth < 768 && currentMobileTab !== 'chat') {
            if (UI.chatBadge) UI.chatBadge.classList.remove('hidden');
            showNotification(targetSuspect.name, aiResponse);
        } else if (!currentSuspect || currentSuspect.id !== targetId) {
            showNotification(targetSuspect.name, aiResponse);
        }
    } else {
        addMessage("hệ thống", `[LỖI]: ${lastErrorMsg}`, targetId);
        playLoseSound();

        attempts[targetId]--;
        score += 0.5;
        updateScoreDisplay();
        updateAttemptBadge(targetId);
        if (currentSuspect && currentSuspect.id === targetId) {
            updateAttemptUI();
        }
    }
}

UI.btnSend.onclick = () => {
    const text = UI.userInput.value.trim();
    if (!text || !currentSuspect || attempts[currentSuspect.id] >= MAX_ATTEMPTS) return;
    const targetId = currentSuspect.id;
    addMessage("thanh tra", text, targetId);
    UI.userInput.value = '';
    attempts[targetId]++;
    score -= 0.5;
    updateScoreDisplay();
    updateAttemptUI();
    askAI(text, targetId);
};
UI.userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") UI.btnSend.click(); });

// ==========================================
// KẾT ÁN VÀ XỬ LÝ KẾT QUẢ
// ==========================================
document.getElementById('btnAccuse').onclick = () => {
    const selectedKiller = UI.accuseSelect.value;
    if(!selectedKiller) { alert("Vui lòng chọn 1 mục tiêu để kết án!"); return; }

    screens.accuse.classList.add('hidden');
    const resultContent = document.getElementById('resultContent');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const resultScore = document.getElementById('resultScore');
    const btnPlayAgainDirect = document.getElementById('btnPlayAgainDirect');
    const btnPlayAgainText = document.getElementById('btnPlayAgainText');
    document.getElementById('btnAccuse').disabled = true;

    if(selectedKiller === currentScenario.killer_id) {
        playWinSound();
        screens.result.classList.remove('hidden');
        screens.result.classList.add('flex');
        resultContent.classList.remove('modal-pop');
        void resultContent.offsetWidth;
        resultContent.classList.add('modal-pop');

        resultContent.className = "glass-panel p-6 sm:p-10 rounded-3xl border-4 border-emerald-500/50 flex flex-col items-center text-center w-[92vw] max-w-lg my-auto modal-pop bg-emerald-950/40 shadow-[0_0_50px_rgba(16,185,129,0.3)] max-h-[92dvh] overflow-y-auto";
        resultIcon.innerHTML = "🎖️";
        resultTitle.innerText = "PHÁ ÁN THÀNH CÔNG";
        resultTitle.className = "text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]";
        resultMessage.innerHTML = `Sự thật đã được phơi bày! <br><br> Hung thủ chính là <b>${currentScenario.suspects[currentScenario.killer_id].name}</b>.<br> <span class="text-emerald-300 italic mt-2 block font-semibold">"${currentScenario.suspects[currentScenario.killer_id].truth}"</span>`;
        resultScore.innerText = score.toFixed(1);
        resultScore.className = "text-4xl sm:text-6xl font-black text-emerald-400 drop-shadow-lg mt-1";
        btnPlayAgainText.innerText = "TIẾP NHẬN VỤ MỚI";
        btnPlayAgainDirect.className = "w-full py-3.5 sm:py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.5)]";

        const duration = 4 * 1000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10b981', '#34d399', '#fcd34d', '#ffffff'] });
            confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#34d399', '#fcd34d', '#ffffff'] });
            if (Date.now() < end) { requestAnimationFrame(frame); }
        }());
    } else {
        playLoseSound();
        screens.game.classList.remove('collapse-anim');
        void screens.game.offsetWidth;
        screens.game.classList.add('collapse-anim');

        setTimeout(() => {
            screens.result.classList.remove('hidden');
            screens.result.classList.add('flex');
            resultContent.classList.remove('modal-pop');
            void resultContent.offsetWidth;
            resultContent.classList.add('modal-pop');

            resultContent.className = "glass-panel p-6 sm:p-10 rounded-3xl border-4 border-red-600/50 flex flex-col items-center text-center w-[92vw] max-w-lg my-auto modal-pop bg-red-950/60 shadow-[0_0_50px_rgba(220,38,38,0.4)] max-h-[92dvh] overflow-y-auto";
            resultIcon.innerHTML = "🚨";
            resultTitle.innerText = "KẾT ÁN SAI LẦM";
            resultTitle.className = "text-2xl sm:text-3xl font-black uppercase tracking-widest mb-2 text-red-500 glitch-effect";
            resultMessage.innerHTML = `Bạn đã tống giam một người vô tội. Hung thủ thực sự là <b>${currentScenario.suspects[currentScenario.killer_id].name}</b> đã cao chạy xa bay!<br><br><span class="text-red-400 font-bold">Bạn bị tước huy hiệu và sa thải khỏi cục cảnh sát.</span>`;
            resultScore.innerText = "0.0";
            resultScore.className = "text-4xl sm:text-6xl font-black text-red-500 glitch-effect mt-1";
            btnPlayAgainText.innerText = "LÀM LẠI CUỘC ĐỜI";
            btnPlayAgainDirect.className = "w-full py-3.5 sm:py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-red-700 hover:bg-red-500 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.5)]";
        }, 800);
    }
};

function resetGameBoard() {
    screens.game.classList.remove('collapse-anim');
    document.getElementById('btnOpenAccuse').disabled = false;
    document.getElementById('btnOpenAccuseMobile').disabled = false;
    document.getElementById('btnAccuse').disabled = false;
    document.getElementById('btnAccuse').classList.replace('bg-gray-600', 'bg-red-600');
    UI.accuseSelect.disabled = false;
    document.getElementById('suspectList').style.pointerEvents = 'auto';

    screens.result.classList.remove('flex');
    screens.result.classList.add('hidden');
}

document.getElementById('btnPlayAgainDirect').onclick = () => {
    resetGameBoard();
    setupRandomScenario();
    screens.game.classList.remove('fade-in');
    void screens.game.offsetWidth;
    screens.game.classList.add('fade-in');
};
document.getElementById('btnBackToMenu').onclick = () => {
    resetGameBoard();
    screens.game.classList.remove('flex', 'fade-in');
    screens.game.classList.add('hidden', 'opacity-0');
    screens.menu.classList.remove('hidden');
    setTimeout(() => { screens.menu.style.opacity = '1'; }, 50);
};

// ==========================================
// XỬ LÝ BÀN PHÍM ẢO TRÊN MOBILE (VISUAL VIEWPORT)
// ==========================================
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        // Bàn phím ảo mở ra làm giảm đáng kể chiều cao viewport
        if (window.innerHeight - currentHeight > 120) {
            document.body.style.height = `${currentHeight}px`;
            if (currentMobileTab === 'chat' && UI.chatBox) {
                setTimeout(() => {
                    UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
                }, 80);
            }
        } else {
            document.body.style.height = '100dvh';
        }
    });

    window.visualViewport.addEventListener('scroll', () => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
    });
}

// ==========================================
// HIỆU ỨNG HẠT MA TRẬN (CHẠM & CHUỘT)
// ==========================================
const canvas = document.getElementById('traceCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();

let particles = [];
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*?';
let mouse = { x: null, y: null };

function addParticleAt(x, y) {
    if (!screens.menu.classList.contains('hidden')) {
        particles.push(new Particle(x, y));
    }
}

window.addEventListener('mousemove', (e) => {
    if (!screens.menu.classList.contains('hidden')) {
        mouse.x = e.x;
        mouse.y = e.y;
        if (Math.random() > 0.4) {
            addParticleAt(mouse.x, mouse.y);
        }
    }
});

window.addEventListener('touchstart', (e) => {
    if (!screens.menu.classList.contains('hidden') && e.touches.length > 0) {
        const t = e.touches[0];
        for (let i = 0; i < 3; i++) {
            addParticleAt(t.clientX, t.clientY);
        }
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!screens.menu.classList.contains('hidden') && e.touches.length > 0) {
        const t = e.touches[0];
        if (Math.random() > 0.2) {
            addParticleAt(t.clientX, t.clientY);
        }
    }
}, { passive: true });

class Particle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 30;
        this.y = y + (Math.random() - 0.5) * 30;
        this.char = chars[Math.floor(Math.random() * chars.length)];
        this.size = Math.random() * 10 + 10;
        this.vy = Math.random() * -1 - 0.5;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.015;
    }

    update() {
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        const isLight = document.body.classList.contains('light-theme');
        ctx.fillStyle = isLight ? `rgba(76, 29, 149, ${this.life})` : `rgba(168, 85, 247, ${this.life})`;
        ctx.font = `bold ${this.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = isLight ? `rgba(107, 33, 168, ${this.life})` : `rgba(168, 85, 247, ${this.life})`;
        ctx.fillText(this.char, this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

function animateTrace() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animateTrace);
}
animateTrace();