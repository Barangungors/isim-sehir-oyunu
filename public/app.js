const socket = io();

const els = {
    authScreen: document.getElementById('auth-screen'), browserScreen: document.getElementById('browser-screen'), gameScreen: document.getElementById('game-screen'),
    usernameInput: document.getElementById('username'), loginBtn: document.getElementById('login-btn'), displayUsername: document.getElementById('display-username'), displayAvatar: document.getElementById('display-avatar'),
    roomList: document.getElementById('room-list'), createRoomName: document.getElementById('create-room-name'), createRoomMax: document.getElementById('create-room-max'), createRoomPass: document.getElementById('create-room-pass'), createRoomBtn: document.getElementById('create-room-btn'), refreshRoomsBtn: document.getElementById('refresh-rooms-btn'),
    currentRoomTitle: document.getElementById('current-room-title'), roomStatusBadge: document.getElementById('room-status-badge'), leaveRoomBtn: document.getElementById('leave-room-btn'),
    lobbyView: document.getElementById('lobby-view'), playingView: document.getElementById('playing-view'), votingView: document.getElementById('voting-view'), resultsView: document.getElementById('results-view'),
    startGameBtn: document.getElementById('start-game-btn'), nextRoundBtn: document.getElementById('next-round-btn'), submitAnswersBtn: document.getElementById('submit-answers-btn'),
    currentLetter: document.getElementById('current-letter'), timer: document.getElementById('timer'), playerList: document.getElementById('player-list'), playerCount: document.getElementById('player-count'), leaderboardBody: document.getElementById('leaderboard-body'),
    chatMessages: document.getElementById('chat-messages'), chatInput: document.getElementById('chat-input'), sendChat: document.getElementById('send-chat'),
    voteStatusList: document.getElementById('vote-status-list'), votingTimer: document.getElementById('voting-timer'), voteCategory: document.getElementById('vote-category'), voteAvatar: document.getElementById('vote-avatar'), votePlayerName: document.getElementById('vote-player-name'), voteAnswer: document.getElementById('vote-answer'), btnVoteYes: document.getElementById('btn-vote-yes'), btnVoteNo: document.getElementById('btn-vote-no'), voteResultOverlay: document.getElementById('vote-result-overlay'), voteResultText: document.getElementById('vote-result-text'), resultsDetailsContainer: document.getElementById('results-details-container')
};

let myUsername = '', selectedAvatar = '😎', currentRoomId = null, amIHost = false, roomPlayers = [];

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    const colors = { success: 'bg-emerald-500/90 border-emerald-400', error: 'bg-rose-500/90 border-rose-400', info: 'bg-blue-500/90 border-blue-400' };
    t.className = `flex items-center gap-3 p-4 rounded-xl border-l-4 shadow-2xl toast-enter text-white ${colors[type]}`;
    let icon = type==='success'?'check-circle':(type==='error'?'circle-exclamation':'info-circle');
    t.innerHTML = `<i class="fa-solid fa-${icon} text-xl"></i> <span class="font-bold tracking-wide">${msg}</span>`; 
    c.appendChild(t); setTimeout(() => { t.style.opacity = '0'; t.style.transform='translateX(100%)'; t.style.transition='all 0.4s'; setTimeout(() => t.remove(), 400); }, 3000);
}

document.querySelectorAll('.avatar-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.avatar-btn').forEach(b => { b.classList.remove('active-avatar'); b.classList.add('grayscale'); }); 
    e.currentTarget.classList.add('active-avatar'); e.currentTarget.classList.remove('grayscale'); selectedAvatar = e.currentTarget.dataset.avatar;
}));

els.loginBtn.addEventListener('click', () => {
    myUsername = els.usernameInput.value.trim(); if(myUsername.length < 3) return showToast("Ad en az 3 harf olmalı", "error");
    els.displayUsername.innerText = myUsername; els.displayAvatar.innerText = selectedAvatar;
    els.authScreen.classList.add('hidden'); els.browserScreen.classList.remove('hidden'); els.browserScreen.classList.add('flex');
    socket.emit('requestRooms'); showToast(`Hoş geldin, ${myUsername}!`, "success");
});

els.refreshRoomsBtn.addEventListener('click', () => {
    els.refreshRoomsBtn.classList.add('animate-spin'); setTimeout(()=>els.refreshRoomsBtn.classList.remove('animate-spin'), 500);
    socket.emit('requestRooms');
});

socket.on('roomListUpdated', (rooms) => {
    els.roomList.innerHTML = rooms.length ? '' : `<div class="text-center mt-10 text-white/30"><i class="fa-solid fa-ghost text-5xl mb-4"></i><p class="text-lg">Buralar çok ıssız. Bir oda kur!</p></div>`;
    rooms.forEach(r => {
        const div = document.createElement('div'); div.className = `flex justify-between items-center p-5 rounded-2xl border bg-black/40 border-white/5 hover:border-white/20 transition-all group`;
        div.innerHTML = `<div><h4 class="font-bold text-xl text-white group-hover:text-purple-400 transition">${r.name} ${r.isPrivate?'<i class="fa-solid fa-lock text-rose-400 text-sm ml-2"></i>':''}</h4><span class="text-sm text-white/50"><i class="fa-solid fa-users mr-1"></i> ${r.currentPlayers}/${r.maxPlayers} &nbsp;|&nbsp; ${r.status.toUpperCase()}</span></div><button class="join-room-btn btn-3d px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold" data-id="${r.id}" data-private="${r.isPrivate}">KATIL</button>`;
        els.roomList.appendChild(div);
    });
    document.querySelectorAll('.join-room-btn').forEach(b => b.addEventListener('click', (e) => {
        let p = e.currentTarget.dataset.private === 'true' ? prompt("Şifre:") : null; if(e.currentTarget.dataset.private === 'true' && p===null) return;
        socket.emit('joinRoom', { username: myUsername, avatar: selectedAvatar, roomId: e.currentTarget.dataset.id, password: p });
    }));
});

els.createRoomBtn.addEventListener('click', () => socket.emit('createRoom', { username: myUsername, avatar: selectedAvatar, roomName: els.createRoomName.value || `${myUsername}'in Odası`, password: els.createRoomPass.value, maxPlayers: els.createRoomMax.value }));
socket.on('roomJoined', ({ roomId, room }) => { currentRoomId = roomId; els.browserScreen.classList.replace('flex','hidden'); els.gameScreen.classList.replace('hidden','flex'); els.currentRoomTitle.innerText = room.name; switchGameView('lobby'); });
socket.on('roomError', (msg) => showToast(msg, "error"));
socket.on('systemNotification', (data) => showToast(data.message, data.type));
els.leaveRoomBtn.addEventListener('click', () => window.location.reload());

socket.on('updatePlayers', (players) => {
    roomPlayers = players; els.playerList.innerHTML = '';
    const me = players.find(p => p.id === socket.id); if (me) { amIHost = me.isHost; els.startGameBtn.classList.toggle('hidden', !amIHost); els.nextRoundBtn.classList.toggle('hidden', !amIHost); }
    els.playerCount.innerText = `${players.length}/${els.playerCount.innerText.split('/')[1] || 8}`;
    players.forEach(p => els.playerList.innerHTML += `<li class="flex justify-between items-center p-3 rounded-xl border ${p.id===socket.id?'bg-blue-500/20 border-blue-500/30':'bg-black/30 border-white/5'}"><div class="flex items-center gap-3"><span class="text-2xl bg-black/40 p-1 rounded-full">${p.avatar}</span><span class="font-bold text-white">${p.username}</span> ${p.isHost?'<i class="fa-solid fa-crown text-yellow-400 text-xs"></i>':''}</div><span class="text-yellow-400 font-mono font-bold text-lg">${p.score}</span></li>`);
});

els.startGameBtn.addEventListener('click', () => socket.emit('startGame', currentRoomId));
els.nextRoundBtn.addEventListener('click', () => socket.emit('startGame', currentRoomId));

socket.on('roundStarted', ({ letter, time }) => {
    switchGameView('playing'); els.roomStatusBadge.innerText = "YAZILIYOR"; els.roomStatusBadge.className = "bg-rose-500/20 text-rose-400 px-6 py-2 rounded-full text-sm font-bold border border-rose-500/30 uppercase tracking-widest animate-pulse";
    els.currentLetter.innerText = "?"; els.timer.innerText = time;
    
    // Geri sayım animasyonu (3..2..1..HARF)
    const overlay = document.getElementById('letter-reveal-overlay'); const box = document.getElementById('letter-reveal-box'); const bigLetter = document.getElementById('big-letter'); const getReady = document.getElementById('get-ready-text');
    overlay.classList.remove('hidden'); box.classList.remove('animate-slam');
    
    let cnt = 3; bigLetter.innerText = cnt; getReady.innerText = "HAZIRLAN";
    let intv = setInterval(() => {
        cnt--; if(cnt > 0) { bigLetter.innerText = cnt; } 
        else { clearInterval(intv); getReady.innerText = "BAŞLA!"; bigLetter.innerText = letter; box.classList.add('animate-slam');
            setTimeout(() => {
                overlay.classList.add('hidden'); els.currentLetter.innerText = letter;
                document.querySelectorAll('.game-input-ultra').forEach(i => { i.value = ''; i.disabled = false; });
                els.submitAnswersBtn.disabled = false; els.submitAnswersBtn.innerHTML = "<i class='fa-solid fa-paper-plane mr-2'></i> CEVAPLARI GÖNDER"; els.submitAnswersBtn.className = "btn-3d mt-6 w-full bg-blue-600 hover:bg-blue-500 font-black text-2xl py-5 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] flex-shrink-0 transition-all text-white";
                document.getElementById('ans-isim').focus();
            }, 1000);
        }
    }, 800);
});
socket.on('timerUpdate', t => { els.timer.innerText = t; if(t<=10) els.timer.classList.add('text-rose-500', 'animate-pulse'); else els.timer.classList.remove('text-rose-500', 'animate-pulse'); });

els.submitAnswersBtn.addEventListener('click', () => {
    const cats = ['isim','sehir','ulke','hayvan','bitki','esya','meslek','yemek','film']; const ans = {}; cats.forEach(c => ans[c] = document.getElementById(`ans-${c}`).value);
    socket.emit('submitAnswers', { roomId: currentRoomId, answers: ans });
    document.querySelectorAll('.game-input-ultra').forEach(i => i.disabled = true); els.submitAnswersBtn.disabled = true; els.submitAnswersBtn.innerHTML = "<i class='fa-solid fa-clock mr-2'></i> BEKLENİYOR..."; els.submitAnswersBtn.className = "mt-6 w-full bg-gray-700 text-white/50 font-black text-2xl py-5 rounded-2xl flex-shrink-0 cursor-not-allowed";
});

// PARTİ MODU OYLAMA
socket.on('votingPhaseStarted', () => { switchGameView('voting'); els.roomStatusBadge.innerText = "MAHKEME"; els.roomStatusBadge.className = "bg-purple-500/20 text-purple-400 px-6 py-2 rounded-full text-sm font-bold border border-purple-500/30 uppercase tracking-widest"; });

socket.on('newVotingItem', ({ item, timer, autoVoteId }) => {
    els.voteResultOverlay.classList.add('hidden'); els.voteResultText.classList.replace('scale-100', 'scale-0');
    
    // Kelimeyi ekrana vurarak getir
    els.voteAnswer.classList.remove('animate-slam');
    void els.voteAnswer.offsetWidth; // trigger reflow
    els.voteAnswer.classList.add('animate-slam');

    els.voteCategory.innerText = item.category; els.voteAvatar.innerText = item.avatar; els.votePlayerName.innerText = item.playerName; 
    els.voteAnswer.innerText = item.answer;
    
    if(item.isEmpty) els.voteAnswer.className = "text-[5rem] font-black text-gray-500 drop-shadow-md text-center break-words leading-none w-full animate-slam";
    else els.voteAnswer.className = "text-[5rem] font-black text-yellow-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] text-center break-words leading-none w-full animate-slam";

    els.votingTimer.innerText = timer;
    els.btnVoteYes.disabled = false; els.btnVoteNo.disabled = false;
    els.btnVoteYes.className = "btn-3d w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl text-2xl shadow-[0_0_30px_rgba(16,185,129,0.3)]";
    els.btnVoteNo.className = "btn-3d w-1/2 bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-2xl text-2xl shadow-[0_0_30px_rgba(244,63,94,0.3)]";

    els.voteStatusList.innerHTML = '';
    roomPlayers.forEach(p => {
        let statusIcon = p.id === autoVoteId ? '<i class="fa-solid fa-check text-emerald-400 text-xl"></i>' : '<i class="fa-solid fa-spinner fa-spin text-white/30 text-xl"></i>';
        els.voteStatusList.innerHTML += `<li id="status-${p.id}" class="flex justify-between items-center bg-black/40 p-4 rounded-xl border ${p.id===autoVoteId ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-white/5'} transition-all"><div class="flex items-center gap-3"><span class="bg-black/50 p-1 rounded-full text-xl">${p.avatar}</span><span class="font-bold text-gray-200">${p.username}</span></div><div class="status-icon">${statusIcon}</div></li>`;
    });

    if (item.playerId === socket.id) lockButtons('bg-emerald-800 text-white/50', 'bg-rose-900 text-white/50');
});

socket.on('votingTimerUpdate', t => els.votingTimer.innerText = t);

els.btnVoteYes.addEventListener('click', () => { socket.emit('castVote', { roomId: currentRoomId, vote: 1 }); lockButtons('bg-emerald-600 text-white border-emerald-400', 'bg-rose-900 text-white/30'); });
els.btnVoteNo.addEventListener('click', () => { socket.emit('castVote', { roomId: currentRoomId, vote: -1 }); lockButtons('bg-emerald-900 text-white/30', 'bg-rose-600 text-white border-rose-400'); });

function lockButtons(yesClass, noClass) {
    els.btnVoteYes.disabled = true; els.btnVoteNo.disabled = true;
    els.btnVoteYes.className = `w-1/2 font-black py-5 rounded-2xl text-2xl transition-all border-4 border-transparent ${yesClass}`;
    els.btnVoteNo.className = `w-1/2 font-black py-5 rounded-2xl text-2xl transition-all border-4 border-transparent ${noClass}`;
}

socket.on('voteUpdate', ({ playerId, vote }) => {
    const li = document.getElementById(`status-${playerId}`);
    if (li) {
        li.classList.remove('border-white/5', 'shadow-[0_0_15px_rgba(16,185,129,0.2)]');
        if (vote === 1) { li.classList.add('border-emerald-500/50', 'bg-emerald-500/10'); li.querySelector('.status-icon').innerHTML = '<i class="fa-solid fa-check text-emerald-400 text-xl animate-bounce"></i>'; } 
        else { li.classList.add('border-rose-500/50', 'bg-rose-500/10'); li.querySelector('.status-icon').innerHTML = '<i class="fa-solid fa-xmark text-rose-400 text-xl animate-bounce"></i>'; }
    }
});

socket.on('voteResolved', ({ isAccepted, item }) => {
    els.voteResultOverlay.classList.remove('hidden');
    els.voteResultText.innerText = isAccepted ? "KABUL EDİLDİ!" : "REDDEDİLDİ!";
    els.voteResultText.className = `text-[6rem] font-black uppercase tracking-widest transform scale-0 transition-transform duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-center leading-none ${isAccepted ? 'text-emerald-400' : 'text-rose-500'}`;
    setTimeout(() => els.voteResultText.classList.replace('scale-0', 'scale-100'), 10);
});

socket.on('roundEnded', ({ players, details }) => {
    switchGameView('results'); els.roomStatusBadge.innerText = "SONUÇLAR"; els.roomStatusBadge.className = "bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-full text-sm font-bold border border-emerald-500/30 uppercase tracking-widest";
    els.leaderboardBody.innerHTML = ''; els.resultsDetailsContainer.innerHTML = '';
    
    players.forEach((p, i) => {
        let medal = i===0 ? '<i class="fa-solid fa-crown text-yellow-400 text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]"></i>' : (i===1 ? '<i class="fa-solid fa-medal text-gray-300 text-xl"></i>' : (i===2 ? '<i class="fa-solid fa-medal text-amber-600 text-xl"></i>' : `#${i+1}`));
        els.leaderboardBody.innerHTML += `<tr class="border-b border-white/5 hover:bg-white/5 transition"><td class="py-4 text-white/50 font-black w-12 text-center">${medal}</td><td class="py-4 font-bold text-lg ${p.id===socket.id?'text-emerald-400':'text-gray-200'}"><span class="bg-black/30 p-1 rounded-full mr-2">${p.avatar}</span> ${p.username}</td><td class="py-4 text-right text-emerald-400 font-mono text-3xl font-black">${p.score}</td></tr>`;
    });

    for (let pId in details) {
        let pName = players.find(x => x.id === pId)?.username || "Bilinmiyor";
        let html = `<div class="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-lg"><h4 class="font-bold text-yellow-400 mb-4 border-b border-white/10 pb-2 text-lg uppercase tracking-wide">${pName}</h4><ul class="space-y-3">`;
        for (let cat in details[pId]) {
            let res = details[pId][cat]; 
            let isAcc = res.includes('✅'); let isRej = res.includes('❌');
            let color = isAcc ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' : (isRej ? 'text-rose-400 bg-rose-400/10 border-rose-500/20 opacity-70 line-through' : 'text-gray-500 bg-white/5');
            let icon = isAcc ? '<i class="fa-solid fa-check"></i>' : (isRej ? '<i class="fa-solid fa-xmark"></i>' : '');
            let cleanRes = res.replace('✅ ', '').replace('❌ ', '');
            html += `<li class="flex justify-between items-center text-sm"><span class="text-white/40 uppercase tracking-widest text-xs font-bold w-20">${cat}</span> <span class="${color} border px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 max-w-[200px] truncate">${cleanRes} ${icon}</span></li>`;
        }
        els.resultsDetailsContainer.innerHTML += html + '</ul></div>';
    }
});

els.sendChat.addEventListener('click', () => { 
    if (els.chatInput.value.trim()) { 
        socket.emit('chatMessage', { roomId: currentRoomId, message: els.chatInput.value.trim(), username: myUsername }); 
        els.chatInput.value = ''; 
    } 
});

els.chatInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') els.sendChat.click(); 
});
socket.on('newChatMessage', ({ username, text }) => {
    const isMe = username === myUsername; 
    els.chatMessages.innerHTML += `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up">
            <div class="max-w-[85%] rounded-2xl px-4 py-3 ${isMe ? 'bg-indigo-600 text-white rounded-br-sm shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-black/60 border border-white/10 text-gray-200 rounded-bl-sm'}">
                ${!isMe ? `<span class="block text-[10px] text-yellow-400 font-bold mb-1 tracking-wider uppercase">${username}</span>` : ''}
                <span class="break-words font-medium">${text}</span>
            </div>
        </div>`; 
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
});
function switchGameView(v) { els.lobbyView.classList.add('hidden'); els.playingView.classList.add('hidden'); els.votingView.classList.add('hidden'); els.resultsView.classList.add('hidden'); document.getElementById(`${v}-view`).classList.remove('hidden'); document.getElementById(`${v}-view`).classList.add('flex'); }