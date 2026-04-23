const socket = io();

// UI Elementleri
const els = {
    authScreen: document.getElementById('auth-screen'),
    browserScreen: document.getElementById('browser-screen'),
    gameScreen: document.getElementById('game-screen'),
    
    usernameInput: document.getElementById('username'),
    loginBtn: document.getElementById('login-btn'),
    displayUsername: document.getElementById('display-username'),
    displayAvatar: document.getElementById('display-avatar'),
    
    roomList: document.getElementById('room-list'),
    createRoomName: document.getElementById('create-room-name'),
    createRoomMax: document.getElementById('create-room-max'),
    createRoomPass: document.getElementById('create-room-pass'),
    createRoomBtn: document.getElementById('create-room-btn'),
    refreshRoomsBtn: document.getElementById('refresh-rooms-btn'),
    
    currentRoomTitle: document.getElementById('current-room-title'),
    roomStatusBadge: document.getElementById('room-status-badge'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    
    lobbyView: document.getElementById('lobby-view'),
    playingView: document.getElementById('playing-view'),
    resultsView: document.getElementById('results-view'),
    
    startGameBtn: document.getElementById('start-game-btn'),
    nextRoundBtn: document.getElementById('next-round-btn'),
    submitAnswersBtn: document.getElementById('submit-answers-btn'),
    
    currentLetter: document.getElementById('current-letter'),
    timer: document.getElementById('timer'),
    playerList: document.getElementById('player-list'),
    playerCount: document.getElementById('player-count'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendChat: document.getElementById('send-chat'),
    
    passwordModal: document.getElementById('password-modal'),
    joinRoomPassword: document.getElementById('join-room-password'),
    confirmPasswordBtn: document.getElementById('confirm-password'),
    cancelPasswordBtn: document.getElementById('cancel-password')
};

// State
let myUsername = '';
let selectedAvatar = '😎';
let currentRoomId = null;
let amIHost = false;
let pendingJoinRoomId = null;

// --- YARDIMCI: TOAST BİLDİRİMLERİ ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let icon = 'fa-circle-info', bgColor = 'bg-blue-500/20', borderColor = 'border-blue-500/50', textColor = 'text-blue-300';
    if(type === 'success') { icon = 'fa-check-circle'; bgColor = 'bg-green-500/20'; borderColor = 'border-green-500/50'; textColor = 'text-green-300'; }
    if(type === 'warning') { icon = 'fa-triangle-exclamation'; bgColor = 'bg-yellow-500/20'; borderColor = 'border-yellow-500/50'; textColor = 'text-yellow-300'; }
    if(type === 'error') { icon = 'fa-circle-xmark'; bgColor = 'bg-red-500/20'; borderColor = 'border-red-500/50'; textColor = 'text-red-300'; }

    toast.className = `flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg toast-enter ${bgColor} ${borderColor} min-w-[250px]`;
    toast.innerHTML = `<i class="fa-solid ${icon} ${textColor} text-xl"></i><span class="text-white text-sm font-medium">${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Ses Efekti Oynatıcı (İsteğe Bağlı)
function playSound(type) {
    // const audio = new Audio(`sounds/${type}.mp3`); audio.play().catch(e=>{});
}

// --- EKRAN 1: KİMLİK DOĞRULAMA ---
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active-avatar'));
        e.currentTarget.classList.add('active-avatar');
        selectedAvatar = e.currentTarget.dataset.avatar;
    });
});

els.loginBtn.addEventListener('click', () => {
    myUsername = els.usernameInput.value.trim();
    if (myUsername.length < 3) return showToast("Kullanıcı adı en az 3 karakter olmalı", "error");
    
    els.displayUsername.innerText = myUsername;
    els.displayAvatar.innerText = selectedAvatar;
    
    els.authScreen.classList.add('hidden');
    els.browserScreen.classList.remove('hidden');
    els.browserScreen.classList.add('flex');
    
    socket.emit('requestRooms');
    showToast(`Hoş geldin, ${myUsername}!`, "success");
});

// --- EKRAN 2: ODA TARAYICISI ---
els.refreshRoomsBtn.addEventListener('click', () => {
    socket.emit('requestRooms');
    els.refreshRoomsBtn.classList.add('animate-spin');
    setTimeout(() => els.refreshRoomsBtn.classList.remove('animate-spin'), 500);
});

socket.on('roomListUpdated', (rooms) => {
    els.roomList.innerHTML = '';
    if (rooms.length === 0) {
        els.roomList.innerHTML = `<div class="text-center text-white/30 py-8"><i class="fa-solid fa-ghost text-4xl mb-2"></i><p>Aktif oda bulunmuyor. İlk kuran sen ol!</p></div>`;
        return;
    }

    rooms.forEach(room => {
        const isFull = room.currentPlayers >= room.maxPlayers;
        const isPlaying = room.status !== 'lobby';
        const canJoin = !isFull && !isPlaying;
        
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-4 rounded-xl border ${canJoin ? 'bg-white/5 border-white/10 hover:bg-white/10 transition cursor-pointer' : 'bg-black/30 border-red-500/20 opacity-70'} group`;
        
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition">
                    <i class="fa-solid ${room.isPrivate ? 'fa-lock text-fuchsia-400' : 'fa-door-open text-cyan-400'} text-xl"></i>
                </div>
                <div>
                    <h4 class="font-bold text-lg text-white">${room.name}</h4>
                    <div class="flex gap-3 text-xs text-white/50 mt-1">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-users"></i> ${room.currentPlayers}/${room.maxPlayers}</span>
                        <span class="flex items-center gap-1"><i class="fa-solid fa-gamepad"></i> ${room.status === 'lobby' ? 'Lobide' : 'Oyunda'}</span>
                    </div>
                </div>
            </div>
            <button class="join-specific-room-btn px-6 py-2 rounded-lg font-bold transition ${canJoin ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}" data-id="${room.id}" data-private="${room.isPrivate}" ${!canJoin ? 'disabled' : ''}>
                ${isFull ? 'Dolu' : isPlaying ? 'Oyunda' : 'Katıl'}
            </button>
        `;
        els.roomList.appendChild(div);
    });

    document.querySelectorAll('.join-specific-room-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const roomId = e.target.dataset.id;
            const isPrivate = e.target.dataset.private === 'true';
            if (isPrivate) {
                pendingJoinRoomId = roomId;
                els.passwordModal.classList.remove('hidden');
                setTimeout(() => els.passwordModal.querySelector('#password-modal-content').classList.replace('scale-95', 'scale-100'), 10);
            } else {
                socket.emit('joinRoom', { username: myUsername, avatar: selectedAvatar, roomId: roomId, password: null });
            }
        });
    });
});

els.createRoomBtn.addEventListener('click', () => {
    const name = els.createRoomName.value.trim() || `${myUsername}'in Odası`;
    const max = els.createRoomMax.value;
    const pass = els.createRoomPass.value.trim();
    socket.emit('createRoom', { username: myUsername, avatar: selectedAvatar, roomName: name, password: pass, maxPlayers: max });
});

// Şifre Modalı İşlemleri
els.cancelPasswordBtn.addEventListener('click', () => {
    els.passwordModal.querySelector('#password-modal-content').classList.replace('scale-100', 'scale-95');
    setTimeout(() => els.passwordModal.classList.add('hidden'), 300);
    pendingJoinRoomId = null;
    els.joinRoomPassword.value = '';
});

els.confirmPasswordBtn.addEventListener('click', () => {
    const pass = els.joinRoomPassword.value.trim();
    socket.emit('joinRoom', { username: myUsername, avatar: selectedAvatar, roomId: pendingJoinRoomId, password: pass });
    els.cancelPasswordBtn.click();
});

// --- ODA/OYUN YÖNETİMİ ---
socket.on('roomJoined', ({ roomId, room }) => {
    currentRoomId = roomId;
    els.browserScreen.classList.add('hidden');
    els.browserScreen.classList.remove('flex');
    els.gameScreen.classList.remove('hidden');
    els.gameScreen.classList.add('flex');
    
    els.currentRoomTitle.innerText = room.name;
    els.playerCount.innerText = `1/${room.maxPlayers}`;
    switchGameView('lobby');
});

socket.on('roomError', (msg) => showToast(msg, "error"));
socket.on('systemNotification', (data) => showToast(data.message, data.type));

els.leaveRoomBtn.addEventListener('click', () => {
    window.location.reload(); // En temiz çıkış yöntemi bağlantıyı sıfırlamaktır
});

socket.on('updatePlayers', (players) => {
    els.playerList.innerHTML = '';
    const me = players.find(p => p.id === socket.id);
    if (me) {
        amIHost = me.isHost;
        els.startGameBtn.classList.toggle('hidden', !amIHost);
        els.nextRoundBtn.classList.toggle('hidden', !amIHost);
    }

    const roomMax = els.playerCount.innerText.split('/')[1] || 8;
    els.playerCount.innerText = `${players.length}/${roomMax}`;

    players.forEach(player => {
        const isMe = player.id === socket.id;
        const li = document.createElement('li');
        li.className = `flex justify-between items-center p-2 rounded-lg ${isMe ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5 border border-transparent'}`;
        li.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl">${player.avatar}</span>
                <div>
                    <span class="text-sm font-bold ${isMe ? 'text-cyan-300' : 'text-white'}">${player.username}</span>
                    ${player.isHost ? '<span class="text-[10px] bg-fuchsia-600 px-2 py-0.5 rounded-full ml-2">HOST</span>' : ''}
                </div>
            </div>
            <span class="text-yellow-400 font-mono font-bold">${player.score}</span>
        `;
        els.playerList.appendChild(li);
    });
});

// --- OYUN AKIŞI & ANİMASYONLAR ---
els.startGameBtn.addEventListener('click', () => { socket.emit('startGame', currentRoomId); });
els.nextRoundBtn.addEventListener('click', () => { socket.emit('startGame', currentRoomId); });

socket.on('roundStarted', ({ letter, time }) => {
    switchGameView('playing');
    els.roomStatusBadge.innerText = "OYUNDA";
    els.roomStatusBadge.className = "bg-red-500/30 text-red-200 px-4 py-1 rounded-full text-sm font-semibold border border-red-500/50 animate-pulse";
    
    els.currentLetter.innerText = '?';
    els.timer.innerText = time;
    els.timer.classList.remove('text-red-500', 'animate-pulse');
    
    const overlay = document.getElementById('letter-reveal-overlay');
    const box = document.getElementById('letter-reveal-box');
    const bigLetter = document.getElementById('big-letter');
    
    bigLetter.innerText = letter;
    overlay.classList.remove('hidden');
    playSound('drumroll');
    
    setTimeout(() => box.classList.replace('scale-0', 'scale-100'), 50);

    setTimeout(() => {
        box.classList.replace('scale-100', 'scale-0'); 
        setTimeout(() => {
            overlay.classList.add('hidden'); 
            els.currentLetter.innerText = letter; 
            playSound('ding');
            
            document.querySelectorAll('.game-input-glass').forEach(input => {
                input.value = '';
                input.disabled = false;
            });
            els.submitAnswersBtn.disabled = false;
            els.submitAnswersBtn.innerText = "CEVAPLARI GÖNDER";
            els.submitAnswersBtn.classList.remove('opacity-50');
            document.getElementById('ans-isim').focus();
        }, 500); 
    }, 2500); 
});

socket.on('timerUpdate', (time) => {
    els.timer.innerText = time;
    if (time <= 10) els.timer.classList.add('text-red-500', 'animate-pulse');
    if (time === 10) playSound('tick'); // Son 10 saniye efekti
});

els.submitAnswersBtn.addEventListener('click', () => {
    const answers = {
        isim: document.getElementById('ans-isim').value, sehir: document.getElementById('ans-sehir').value,
        ulke: document.getElementById('ans-ulke').value, hayvan: document.getElementById('ans-hayvan').value,
        bitki: document.getElementById('ans-bitki').value, esya: document.getElementById('ans-esya').value,
        meslek: document.getElementById('ans-meslek').value, yemek: document.getElementById('ans-yemek').value,
        film: document.getElementById('ans-film').value
    };
    
    socket.emit('submitAnswers', { roomId: currentRoomId, answers });
    
    document.querySelectorAll('.game-input-glass').forEach(input => input.disabled = true);
    els.submitAnswersBtn.disabled = true;
    els.submitAnswersBtn.innerText = "BEKLENİYOR...";
    els.submitAnswersBtn.classList.add('opacity-50');
    playSound('submit');
});

socket.on('roundEnded', ({ players, details }) => {
    switchGameView('results');
    els.roomStatusBadge.innerText = "SONUÇLAR";
    els.roomStatusBadge.className = "bg-green-500/30 text-green-200 px-4 py-1 rounded-full text-sm font-semibold border border-green-500/50";
    els.leaderboardBody.innerHTML = '';
    playSound('applause');
    
    players.forEach((player, index) => {
        let badge = '';
        if(index === 0) badge = '<i class="fa-solid fa-trophy text-yellow-400 mr-2 text-xl drop-shadow-md"></i>';
        else if(index === 1) badge = '<i class="fa-solid fa-medal text-gray-400 mr-2 text-xl"></i>';
        else if(index === 2) badge = '<i class="fa-solid fa-medal text-amber-700 mr-2 text-xl"></i>';

        const tr = document.createElement('tr');
        tr.className = "border-b border-white/5 hover:bg-white/5 transition";
        tr.innerHTML = `
            <td class="p-4 font-black text-white/30 text-xl">#${index + 1}</td>
            <td class="p-4 flex items-center gap-3">
                ${badge}
                <span class="text-2xl">${player.avatar}</span>
                <span class="font-bold ${player.id === socket.id ? 'text-cyan-400' : 'text-white'}">${player.username}</span>
            </td>
            <td class="p-4 text-right text-2xl font-mono text-green-400 score-bump">${player.score}</td>
        `;
        els.leaderboardBody.appendChild(tr);
    });
});

// --- SOHBET ---
els.sendChat.addEventListener('click', sendMessage);
els.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const msg = els.chatInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', { roomId: currentRoomId, message: msg, username: myUsername });
        els.chatInput.value = '';
    }
}

socket.on('newChatMessage', ({ username, text }) => {
    const div = document.createElement('div');
    const isMe = username === myUsername;
    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `
        <div class="max-w-[85%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-white rounded-bl-none'}">
            ${!isMe ? `<span class="block text-[10px] text-fuchsia-300 font-bold mb-1">${username}</span>` : ''}
            <span class="break-words">${text}</span>
        </div>
    `;
    els.chatMessages.appendChild(div);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    if(!isMe) playSound('pop');
});

// Yardımcı
function switchGameView(view) {
    els.lobbyView.classList.add('hidden');
    els.playingView.classList.add('hidden');
    els.resultsView.classList.add('hidden');
    if (view === 'lobby') els.lobbyView.classList.remove('hidden');
    if (view === 'playing') els.playingView.classList.remove('hidden', 'flex');
    if (view === 'results') els.resultsView.classList.remove('hidden', 'flex');
}