// ==========================================
// GAME SCRIPT - BẢN DEPLOY NETLIFY (KHÔNG CHỨA API KEY)
// ==========================================

let DATABASE_SCENARIOS = []; 
let currentScenario = null;
let currentSuspect = null;
let score = 10;
let attempts = {};
let chatHistories = {}; 
let isTyping = {}; 
const MAX_ATTEMPTS = 3;

// ==========================================
// HỆ THỐNG ÂM THANH (AUDIO CONTEXT) - KHÔNG CÓ TIẾNG BÍP
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isSoundEnabled = true;

document.body.addEventListener('click', () => { if(audioCtx.state === 'suspended') audioCtx.resume(); }, {once: true});

document.getElementById('soundToggle').addEventListener('change', (e) => {
    isSoundEnabled = e.target.checked;
    if(isSoundEnabled) playNotifySound();
});

function playTone(freq, type, duration, vol=0.1) {
    if (!isSoundEnabled) return;
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
    const toast = document.createElement('div');
    toast.className = "toast-bg bg-gray-800/95 border border-gray-600 rounded-xl p-3 shadow-2xl flex items-center gap-3 toast-enter backdrop-blur-md";
    
    const shortText = text.length > 50 ? text.substring(0, 50) + '...' : text;
    
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">💬</div>
        <div class="flex-1">
            <h4 class="text-xs font-bold text-blue-400">${name} gửi 1 tin nhắn</h4>
            <p class="toast-text text-[10px] text-gray-300 font-medium">${shortText}</p>
        </div>
    `;
    container.appendChild(toast);
    playNotifySound(); 

    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- DOM ELEMENTS ---
const screens = { menu: document.getElementById('mainMenu'), loading: document.getElementById('loadingScreen'), game: document.getElementById('gameBoard'), settings: document.getElementById('settingsModal'), result: document.getElementById('resultModal'), accuse: document.getElementById('accuseModal') };
const UI = { navCase: document.getElementById('navCase'), navSuspects: document.getElementById('navSuspects'), viewCase: document.getElementById('viewCase'), viewSuspects: document.getElementById('viewSuspects'), caseIdUI: document.getElementById('caseIdUI'), caseTitle: document.getElementById('caseTitle'), caseVictim: document.getElementById('caseVictim'), caseContext: document.getElementById('caseContext'), suspectList: document.getElementById('suspectList'), accuseSelect: document.getElementById('accuseSelect'), currentSuspectName: document.getElementById('currentSuspectName'), initialStatementTooltip: document.getElementById('initialStatementTooltip'), attemptCount: document.getElementById('attemptCount'), chatBox: document.getElementById('chatBox'), userInput: document.getElementById('userInput'), btnSend: document.getElementById('btnSend'), scoreDisplay: document.getElementById('scoreDisplay') };

// ==========================================
// THIẾT LẬP MENU & CÀI ĐẶT
// ==========================================
const openSettings = () => { screens.settings.classList.remove('hidden'); setTimeout(() => screens.settings.children[0].classList.remove('scale-95'), 50); };
document.getElementById('btnSettingsMenu').onclick = openSettings;
document.getElementById('btnSettingsGame').onclick = openSettings;
document.getElementById('btnCloseSettings').onclick = () => { screens.settings.children[0].classList.add('scale-95'); setTimeout(() => screens.settings.classList.add('hidden'), 200); };

document.getElementById('themeToggle').addEventListener('change', (e) => {
    const themeStatus = document.getElementById('themeStatus');
    if (e.target.checked) {
        document.body.classList.remove('light-theme'); themeStatus.innerText = "Đang bật: Cyberpunk (Dark)"; themeStatus.className = "text-xs text-gray-400 mt-1 font-medium";
    } else {
        document.body.classList.add('light-theme'); themeStatus.innerText = "Đang bật: Ban ngày (Light)"; themeStatus.className = "text-xs font-bold text-purple-600 mt-1";
    }
});

UI.navCase.onclick = () => { UI.navCase.classList.add('active'); UI.navSuspects.classList.remove('active'); UI.viewCase.classList.remove('hidden'); UI.viewSuspects.classList.add('hidden'); };
UI.navSuspects.onclick = () => { UI.navSuspects.classList.add('active'); UI.navCase.classList.remove('active'); UI.viewSuspects.classList.remove('hidden'); UI.viewCase.classList.add('hidden'); };

document.getElementById('btnOpenAccuse').onclick = () => { screens.accuse.classList.remove('hidden'); setTimeout(() => screens.accuse.children[0].classList.remove('scale-95'), 50); };
document.getElementById('btnCloseAccuse').onclick = () => { screens.accuse.children[0].classList.add('scale-95'); setTimeout(() => screens.accuse.classList.add('hidden'), 200); };

// ==========================================
// TẢI GAME VÀ KHỞI TẠO DATA
// ==========================================
document.getElementById('btnStartGame').onclick = async () => {
    screens.menu.style.opacity = '0';
    try {
        const response = await fetch('./data.json');
        DATABASE_SCENARIOS = await response.json();
    } catch (error) { alert("Lỗi tải Data! Đảm bảo bạn đang dùng Live Server."); return; }

    setTimeout(() => {
        screens.menu.classList.add('hidden');
        screens.loading.classList.remove('hidden'); screens.loading.classList.add('flex');
        setTimeout(() => { document.getElementById('progressBar').style.width = '100%'; }, 100);
        setupRandomScenario();
        setTimeout(() => {
            screens.loading.classList.remove('flex'); 
            screens.loading.classList.add('hidden');
            screens.game.classList.remove('hidden', 'opacity-0'); 
            screens.game.classList.add('flex', 'fade-in'); 
        }, 2000);
    }, 500);
};

function setupRandomScenario() {
    currentScenario = DATABASE_SCENARIOS[Math.floor(Math.random() * DATABASE_SCENARIOS.length)];
    score = 10; attempts = {}; chatHistories = {}; isTyping = {}; currentSuspect = null;

    UI.currentSuspectName.innerText = "Chưa chọn mục tiêu";
    UI.initialStatementTooltip.innerText = "Hãy chọn mục tiêu từ cột Nghi Phạm.";
    UI.attemptCount.innerText = "Trạng thái: Chờ lệnh"; UI.attemptCount.className = "text-xs font-bold bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-600";
    UI.scoreDisplay.innerText = "10.0";
    UI.userInput.disabled = true; UI.btnSend.disabled = true;
    
    UI.caseIdUI.innerText = currentScenario.case_id; UI.caseTitle.innerText = currentScenario.title; UI.caseVictim.innerText = currentScenario.victim; UI.caseContext.innerHTML = currentScenario.context_html || currentScenario.context; 

    UI.suspectList.innerHTML = ''; UI.accuseSelect.innerHTML = '<option value="">-- Chọn kẻ thủ ác --</option>';

    for (const key in currentScenario.suspects) {
        attempts[key] = 0; isTyping[key] = false;
        chatHistories[key] = [ { sender: "hệ thống", text: `[TRÍCH XUẤT LỜI KHAI BAN ĐẦU]: "${currentScenario.suspects[key].initial}"` } ];

        const suspect = currentScenario.suspects[key];
        const btn = document.createElement('button');
        btn.id = `btn-suspect-${key}`; 
        btn.className = "text-left bg-gray-800/50 hover:bg-gray-700/80 p-4 rounded-xl border border-gray-700 transition-all flex flex-col gap-1 group";
        btn.innerHTML = `<div class="flex justify-between w-full"><span class="suspect-name font-bold text-blue-400 text-lg transition-colors">${suspect.name}</span><span class="status-badge text-[10px] font-bold text-gray-400 bg-black/50 px-2 py-1 rounded border border-gray-700 transition-all">ID: ${key.toUpperCase()}</span></div><span class="text-xs text-red-400 font-semibold italic border-l-2 border-red-500 pl-2 mt-1">Vai trò: ${suspect.role}</span>`;
        btn.onclick = () => selectSuspect(key, btn);
        UI.suspectList.appendChild(btn);

        const opt = document.createElement('option'); opt.value = key; opt.innerText = suspect.name;
        UI.accuseSelect.appendChild(opt);
    }

    UI.chatBox.innerHTML = '<div class="text-center text-gray-500 mt-40 text-sm italic tracking-widest font-bold">[ HỆ THỐNG GHI ÂM ĐÃ SẴN SÀNG ]<br>Chuyển sang Tab Nghi Phạm để làm việc.</div>';
    UI.navCase.click();
}

function selectSuspect(suspectId, btnElement) {
    currentSuspect = currentScenario.suspects[suspectId]; currentSuspect.id = suspectId;
    UI.currentSuspectName.innerText = currentSuspect.name; UI.initialStatementTooltip.innerText = `"${currentSuspect.initial}"`;
    document.querySelectorAll('#suspectList button').forEach(b => b.classList.remove('border-purple-500', 'bg-gray-700/80', 'border-l-[6px]'));
    btnElement.classList.add('border-purple-500', 'bg-gray-700/80', 'border-l-[6px]');
    updateAttemptUI(); renderChat(suspectId); 
}

function renderChat(suspectId) {
    UI.chatBox.innerHTML = ''; 
    if (chatHistories[suspectId].length === 0) { UI.chatBox.innerHTML = '<div class="text-center text-gray-600 mt-20 text-xs italic tracking-widest">[ BẮT ĐẦU PHIÊN THẨM VẤN MỚI ]</div>'; } 
    else { chatHistories[suspectId].forEach(msg => { appendMessageToDOM(msg.sender, msg.text, suspectId); }); }
    if (isTyping[suspectId]) { appendTypingIndicator(suspectId); }
    UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
}

function appendTypingIndicator(targetId) {
    if (document.getElementById(`typing-indicator-${targetId}`)) return; 
    const suspectName = currentScenario.suspects[targetId].name;
    const typingDiv = document.createElement('div');
    typingDiv.id = `typing-indicator-${targetId}`;
    typingDiv.className = "bg-gray-800/80 p-3 rounded-2xl rounded-bl-none self-start max-w-[85%] border border-gray-600/50 shadow-lg msg-fade-in";
    typingDiv.innerHTML = `<span class="text-[10px] font-black text-blue-400 block mb-1 uppercase tracking-widest">${suspectName}</span><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    UI.chatBox.appendChild(typingDiv);
}

function appendMessageToDOM(sender, text, suspectId) {
    const suspectName = currentScenario.suspects[suspectId].name;
    const msgDiv = document.createElement('div');
    
    if (sender === "thanh tra") {
        msgDiv.className = "bg-purple-900/60 text-white p-3 rounded-2xl rounded-br-none self-end max-w-[85%] border border-purple-500/50 shadow-lg msg-fade-in";
        msgDiv.innerHTML = `<span class="text-[10px] font-black text-purple-300 block mb-1 uppercase tracking-widest">Bạn</span><span class="font-medium text-sm leading-relaxed">${text}</span>`;
    } else if (sender === "hệ thống") {
        msgDiv.className = "bg-black/50 text-red-400 p-2 rounded-lg self-center text-xs italic font-semibold w-[90%] text-center border-l-2 border-r-2 border-red-900 msg-fade-in";
        msgDiv.innerHTML = `<span>${text}</span>`;
    } else {
        msgDiv.className = "bg-gray-800/80 text-gray-100 p-3 rounded-2xl rounded-bl-none self-start max-w-[85%] border border-gray-600/50 shadow-lg msg-fade-in";
        msgDiv.innerHTML = `<span class="text-[10px] font-black text-blue-400 block mb-1 uppercase tracking-widest">${suspectName}</span><span class="font-medium text-sm leading-relaxed">${text}</span>`;
    }
    UI.chatBox.appendChild(msgDiv);
}

function addMessage(sender, text, targetId) {
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
        suspectBtn.classList.remove('opacity-50'); suspectBtn.classList.add('hover:bg-gray-700/80'); suspectName.classList.replace('text-gray-500', 'text-blue-400');
        if(statusBadge) { statusBadge.innerHTML = `ID: ${targetId.toUpperCase()}`; statusBadge.className = "status-badge text-[10px] font-bold text-gray-400 bg-black/50 px-2 py-1 rounded border border-gray-700 transition-all"; }
    } else if (left === 1) {
        suspectBtn.classList.remove('opacity-50'); suspectBtn.classList.add('hover:bg-gray-700/80'); suspectName.classList.replace('text-gray-500', 'text-blue-400');
        if(statusBadge) { statusBadge.innerHTML = `⚠️ 1 LƯỢT`; statusBadge.className = "status-badge text-[10px] font-bold text-yellow-400 bg-yellow-950/80 px-2 py-1 rounded border border-yellow-700 animate-pulse"; }
    } else {
        suspectBtn.classList.add('opacity-50'); suspectBtn.classList.remove('hover:bg-gray-700/80'); suspectName.classList.replace('text-blue-400', 'text-gray-500'); 
        if(statusBadge) { statusBadge.innerHTML = `🚫 KHÓA`; statusBadge.className = "status-badge text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-1 rounded border border-red-800 transition-all"; }
    }
}

function updateAttemptUI() {
    if(!currentSuspect) return;
    const targetId = currentSuspect.id;
    const left = MAX_ATTEMPTS - attempts[targetId];
    updateAttemptBadge(targetId); 
    
    UI.attemptCount.innerText = `Lượt: ${left}/${MAX_ATTEMPTS}`;
    if (left > 1) {
        UI.attemptCount.className = "text-xs font-bold bg-green-900/50 text-green-400 px-3 py-1 rounded-full border border-green-500/50";
        UI.userInput.disabled = false; UI.btnSend.disabled = false; UI.userInput.placeholder = "Nhập chất vấn...";
    } else if (left === 1) {
        UI.attemptCount.className = "text-xs font-bold bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/50 animate-pulse";
        UI.userInput.disabled = false; UI.btnSend.disabled = false; UI.userInput.placeholder = "Chất vấn chốt hạ...";
    } else {
        UI.attemptCount.className = "text-xs font-bold bg-red-900/50 text-red-400 px-3 py-1 rounded-full border border-red-500/50";
        UI.userInput.disabled = true; UI.btnSend.disabled = true; UI.userInput.placeholder = "Mục tiêu đã khóa miệng.";
    }
}

// ==========================================
// GỌI API THÔNG QUA NETLIFY FUNCTION MẬT
// ==========================================
async function askAI(question, targetId) {
    const targetSuspect = currentScenario.suspects[targetId];
    isTyping[targetId] = true; 

    setTimeout(() => {
        if (isTyping[targetId] && currentSuspect && currentSuspect.id === targetId) {
            appendTypingIndicator(targetId);
            UI.chatBox.scrollTop = UI.chatBox.scrollHeight;
        }
    }, 600);

    const prompt = `Trò chơi trinh thám. NHẬP VAI 100%. KHÔNG HÉ LỘ LÀ AI.
Tên bạn: ${targetSuspect.name} (${targetSuspect.role}). Bối cảnh: ${currentScenario.context}. Nạn nhân: ${currentScenario.victim}. Lời khai giả: "${targetSuspect.initial}". Sự thật: "${targetSuspect.truth}".
LUẬT: 1. Trả lời dưới 50 chữ. LẠNH LÙNG, MỈA MAI. 2. Cáo buộc suông: Cười nhạo, đòi bằng chứng. 3. VÔ TỘI: Giấu bí mật, ép logic mới thú nhận bí mật phụ (KHÔNG GIẾT NGƯỜI). 4. HUNG THỦ: Chỉ khi bắt thóp ĐÚNG thủ thuật vật lý/tâm lý, mới hoảng sợ chửi thề.
Câu hỏi: "${question}"`;

    let success = false;
    let aiResponse = "";
    let lastErrorMsg = "";

    try {
        // [QUAN TRỌNG]: GỌI VÀO API ẨN CỦA NETLIFY THAY VÌ GOOGLE
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        if (response.ok && data.reply) {
            aiResponse = data.reply;
            success = true;
        } else {
            lastErrorMsg = data.error || "Không thể kết nối máy chủ";
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
        if(!currentSuspect || currentSuspect.id !== targetId) {
            showNotification(targetSuspect.name, aiResponse);
        }
    } else {
        addMessage("hệ thống", `[LỖI]: ${lastErrorMsg}`, targetId);
        attempts[targetId]--; 
        score += 0.5; 
        UI.scoreDisplay.innerText = score.toFixed(1); 
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
    addMessage("thanh tra", text, targetId); UI.userInput.value = '';
    attempts[targetId]++; score -= 0.5; UI.scoreDisplay.innerText = score.toFixed(1); updateAttemptUI();
    askAI(text, targetId); 
};
UI.userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") UI.btnSend.click(); });

// ==========================================
// KẾT ÁN VÀ GỌI ÂM THANH KẾT QUẢ
// ==========================================
document.getElementById('btnAccuse').onclick = () => {
    const selectedKiller = UI.accuseSelect.value;
    if(!selectedKiller) { alert("Vui lòng chọn 1 mục tiêu để kết án!"); return; }

    screens.accuse.classList.add('hidden'); 
    const resultContent = document.getElementById('resultContent'); const resultIcon = document.getElementById('resultIcon'); const resultTitle = document.getElementById('resultTitle'); const resultMessage = document.getElementById('resultMessage'); const resultScore = document.getElementById('resultScore'); const btnPlayAgainDirect = document.getElementById('btnPlayAgainDirect'); const btnPlayAgainText = document.getElementById('btnPlayAgainText');
    document.getElementById('btnAccuse').disabled = true;

    if(selectedKiller === currentScenario.killer_id) {
        playWinSound(); 
        screens.result.classList.remove('hidden'); screens.result.classList.add('flex');
        resultContent.classList.remove('modal-pop'); void resultContent.offsetWidth; resultContent.classList.add('modal-pop');
        resultContent.className = "glass-panel p-10 rounded-3xl border-4 border-emerald-500/50 flex flex-col items-center text-center max-w-xl mx-4 modal-pop bg-emerald-950/40 shadow-[0_0_50px_rgba(16,185,129,0.3)]";
        resultIcon.innerHTML = "🎖️"; resultTitle.innerText = "PHÁ ÁN THÀNH CÔNG"; resultTitle.className = "text-4xl font-black uppercase tracking-widest mb-3 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]";
        resultMessage.innerHTML = `Sự thật đã được phơi bày! <br><br> Hung thủ chính là <b>${currentScenario.suspects[currentScenario.killer_id].name}</b>.<br> <span class="text-emerald-300 italic mt-2 block font-semibold">"${currentScenario.suspects[currentScenario.killer_id].truth}"</span>`;
        resultScore.innerText = score.toFixed(1); resultScore.className = "text-7xl font-black text-emerald-400 drop-shadow-lg mt-2";
        btnPlayAgainText.innerText = "TIẾP NHẬN VỤ MỚI"; btnPlayAgainDirect.className = "w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]";
        var duration = 4 * 1000; var end = Date.now() + duration; (function frame() { confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10b981', '#34d399', '#fcd34d', '#ffffff'] }); confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#34d399', '#fcd34d', '#ffffff'] }); if (Date.now() < end) { requestAnimationFrame(frame); } }());
    } else {
        playLoseSound(); 
        screens.game.classList.remove('collapse-anim'); void screens.game.offsetWidth; screens.game.classList.add('collapse-anim');
        setTimeout(() => {
            screens.result.classList.remove('hidden'); screens.result.classList.add('flex');
            resultContent.classList.remove('modal-pop'); void resultContent.offsetWidth; resultContent.classList.add('modal-pop');
            resultContent.className = "glass-panel p-10 rounded-3xl border-4 border-red-600/50 flex flex-col items-center text-center max-w-xl mx-4 modal-pop bg-red-950/60 shadow-[0_0_50px_rgba(220,38,38,0.4)]";
            resultIcon.innerHTML = "🚨"; resultTitle.innerText = "KẾT ÁN SAI LẦM"; resultTitle.className = "text-4xl font-black uppercase tracking-widest mb-3 text-red-500 glitch-effect";
            resultMessage.innerHTML = `Bạn đã tống giam một người vô tội. Hung thủ thực sự là <b>${currentScenario.suspects[currentScenario.killer_id].name}</b> đã cao chạy xa bay!<br><br><span class="text-red-400 font-bold">Bạn bị tước huy hiệu.</span>`;
            resultScore.innerText = "0.0"; resultScore.className = "text-7xl font-black text-red-500 glitch-effect mt-2";
            btnPlayAgainText.innerText = "LÀM LẠI CUỘC ĐỜI"; btnPlayAgainDirect.className = "w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-red-700 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)]";
        }, 800);
    }
};

function resetGameBoard() {
    screens.game.classList.remove('collapse-anim');
    document.getElementById('btnOpenAccuse').disabled = false;
    
    document.getElementById('btnAccuse').disabled = false;
    document.getElementById('btnAccuse').classList.replace('bg-gray-600', 'bg-red-600');
    UI.accuseSelect.disabled = false;
    document.getElementById('suspectList').style.pointerEvents = 'auto';
    
    screens.result.classList.remove('flex'); 
    screens.result.classList.add('hidden');
}

document.getElementById('btnPlayAgainDirect').onclick = () => { resetGameBoard(); setupRandomScenario(); screens.game.classList.remove('fade-in'); void screens.game.offsetWidth; screens.game.classList.add('fade-in'); };
document.getElementById('btnBackToMenu').onclick = () => { resetGameBoard(); screens.game.classList.remove('flex', 'fade-in'); screens.game.classList.add('hidden', 'opacity-0'); screens.menu.classList.remove('hidden'); setTimeout(() => { screens.menu.style.opacity = '1'; }, 50); };

// ==========================================
// HIỆU ỨNG TƯƠNG TÁC CHUỘT (DATA TRACE)
// ==========================================
const canvas = document.getElementById('traceCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let particles = [];
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*?'; 
let mouse = { x: null, y: null };

window.addEventListener('mousemove', (e) => {
    if (!screens.menu.classList.contains('hidden')) {
        mouse.x = e.x;
        mouse.y = e.y;
        if (Math.random() > 0.4) { 
            particles.push(new Particle(mouse.x, mouse.y));
        }
    }
});

class Particle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 30; 
        this.y = y + (Math.random() - 0.5) * 30;
        this.char = chars[Math.floor(Math.random() * chars.length)];
        this.size = Math.random() * 12 + 12;
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