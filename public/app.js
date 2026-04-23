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
    votingTableBody: document.getElementById('voting-table-body'), votingTimer: document.getElementById('voting-timer'), submitMyVotesBtn: document.getElementById('submit-my-votes-btn'), resultsDetailsContainer: document.getElementById('results-details-container')
};

let myUsername = '', selectedAvatar = '😎', currentRoomId = null, amIHost = false;
let myVotes = {}; // Format: { targetPlayerId: { category: 1 or -1 } }
let currentAnswersCache = {};

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div');
    const colors = { success: 'bg-green-500/20 border-green-500/50 text-green-300', error: 'bg-red-500/20 border-red-500/50 text-red-300', warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300', info: 'bg-blue-500/20 border-blue-500/50 text-blue-300' };
    t.className = `flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg toast-enter ${colors[type]} min-w-[250px]`;
    t.innerHTML = `<span class="font-medium">${msg}</span>`; c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 4000);
}

// GİRİŞ & ODA LİSTESİ (Öncekiyle aynı)
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active-avatar'));
        e.currentTarget.classList.add('active-avatar'); selectedAvatar = e.currentTarget.dataset.avatar;
    });
});

els.loginBtn.addEventListener('click', () => {
    myUsername = els.usernameInput.value.trim();
    if (myUsername.length < 3) return showToast("Ad en az 3 harf olmalı", "error");
    els.displayUsername.innerText = myUsername; els.displayAvatar.innerText = selectedAvatar;
    els.authScreen.classList.add('hidden'); els.browserScreen.classList.remove('hidden'); els.browserScreen.classList.add('flex');
    socket.emit('requestRooms'); showToast(`Hoş geldin, ${myUsername}!`, "success");
});

els.refreshRoomsBtn.addEventListener('click', () => socket.emit('requestRooms'));
socket.on('roomListUpdated', (rooms) => {
    els.roomList.innerHTML = rooms.length ? '' : `<p class="text-center text-white/50 mt-10">Oda yok. Kendin kur!</p>`;
    rooms.forEach(r => {
        const div = document.createElement('div'); div.className = `flex justify-between items-center p-4 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10`;
        div.innerHTML = `<div><h4 class="font-bold">${r.name} ${r.isPrivate?'🔒':''}</h4><span class="text-xs text-white/50">${r.currentPlayers}/${r.maxPlayers} - ${r.status}</span></div><button class="join-room-btn px-4 py-2 bg-cyan-500/20 rounded-lg" data-id="${r.id}">Katıl</button>`;
        els.roomList.appendChild(div);
    });
    document.querySelectorAll('.join-room-btn').forEach(b => b.addEventListener('click', (e) => socket.emit('joinRoom', { username: myUsername, avatar: selectedAvatar, roomId: e.target.dataset.id })));
});

els.createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom', { username: myUsername, avatar: selectedAvatar, roomName: els.createRoomName.value || `${myUsername}'in Odası`, password: els.createRoomPass.value, maxPlayers: els.createRoomMax.value });
});

socket.on('roomJoined', ({ roomId, room }) => {
    currentRoomId = roomId; els.browserScreen.classList.replace('flex','hidden'); els.gameScreen.classList.replace('hidden','flex');
    els.currentRoomTitle.innerText = room.name; switchGameView('lobby');
});

socket.on('systemNotification', (data) => showToast(data.message, data.type));
els.leaveRoomBtn.addEventListener('click', () => window.location.reload());

socket.on('updatePlayers', (players) => {
    els.playerList.innerHTML = '';
    const me = players.find(p => p.id === socket.id); if (me) { amIHost = me.isHost; els.startGameBtn.classList.toggle('hidden', !amIHost); els.nextRoundBtn.classList.toggle('hidden', !amIHost); }
    els.playerCount.innerText = `${players.length}/${els.playerCount.innerText.split('/')[1] || 8}`;
    players.forEach(p => {
        els.playerList.innerHTML += `<li class="flex justify-between p-2 rounded-lg ${p.id===socket.id?'bg-cyan-500/20':'bg-white/5'}"><div class="flex gap-2"><span>${p.avatar}</span><span class="font-bold">${p.username}</span></div><span class="text-yellow-400 font-mono">${p.score}</span></li>`;
    });
});

// OYUN AKIŞI
els.startGameBtn.addEventListener('click', () => socket.emit('startGame', currentRoomId));
els.nextRoundBtn.addEventListener('click', () => socket.emit('startGame', currentRoomId));

socket.on('roundStarted', ({ letter, time }) => {
    switchGameView('playing'); els.roomStatusBadge.innerText = "YAZILIYOR"; els.roomStatusBadge.className = "bg-red-500/30 text-red-200 px-4 py-1 rounded-full text-sm";
    els.currentLetter.innerText = '?'; els.timer.innerText = time;
    document.getElementById('letter-reveal-overlay').classList.remove('hidden'); document.getElementById('big-letter').innerText = letter;
    setTimeout(() => document.getElementById('letter-reveal-box').classList.replace('scale-0', 'scale-100'), 50);
    setTimeout(() => {
        document.getElementById('letter-reveal-box').classList.replace('scale-100', 'scale-0'); 
        setTimeout(() => {
            document.getElementById('letter-reveal-overlay').classList.add('hidden'); els.currentLetter.innerText = letter;
            document.querySelectorAll('.game-input-glass').forEach(i => { i.value = ''; i.disabled = false; });
            els.submitAnswersBtn.disabled = false; els.submitAnswersBtn.innerText = "GÖNDER"; els.submitAnswersBtn.classList.remove('opacity-50');
            document.getElementById('ans-isim').focus();
        }, 500); 
    }, 2000); 
});

socket.on('timerUpdate', t => els.timer.innerText = t);

els.submitAnswersBtn.addEventListener('click', () => {
    const cats = ['isim','sehir','ulke','hayvan','bitki','esya','meslek','yemek','film'];
    const ans = {}; cats.forEach(c => ans[c] = document.getElementById(`ans-${c}`).value);
    socket.emit('submitAnswers', { roomId: currentRoomId, answers: ans });
    document.querySelectorAll('.game-input-glass').forEach(i => i.disabled = true);
    els.submitAnswersBtn.disabled = true; els.submitAnswersBtn.innerText = "BEKLENİYOR..."; els.submitAnswersBtn.classList.add('opacity-50');
});

// YENİ: OYLAMA EKRANI YÖNETİMİ
socket.on('votingStarted', ({ timer, letter, players, answers }) => {
    switchGameView('voting'); myVotes = {}; currentAnswersCache = answers;
    els.roomStatusBadge.innerText = "MAHKEME"; els.roomStatusBadge.className = "bg-fuchsia-500/30 text-fuchsia-200 px-4 py-1 rounded-full text-sm animate-pulse";
    els.votingTimer.innerText = timer; els.votingTableBody.innerHTML = '';
    els.submitMyVotesBtn.disabled = false; els.submitMyVotesBtn.classList.remove('opacity-50'); els.submitMyVotesBtn.innerHTML = '<i class="fa-solid fa-gavel mr-2"></i> KARARLARI ONAYLA';

    const categories = ['isim','sehir','ulke','hayvan','bitki','esya','meslek','yemek','film'];
    
    players.forEach(p => {
        myVotes[p.id] = {}; // Oyları sıfırla
        const tr = document.createElement('tr'); tr.id = `row-${p.id}`; tr.className = `hover:bg-white/5 transition border-b border-white/5 ${p.id === socket.id ? 'bg-cyan-900/20' : ''}`;
        
        let rowHtml = `<td class="p-4 border-r border-white/10 font-bold flex items-center justify-between w-48">
            <span class="truncate pr-2" title="${p.username}">${p.avatar} ${p.username}</span>
            ${p.id === socket.id ? `<button id="reveal-my-btn" class="bg-fuchsia-600 hover:bg-fuchsia-500 text-xs px-2 py-1 rounded shadow"><i class="fa-solid fa-eye"></i> Aç</button>` : ''}
        </td>`;

        categories.forEach(cat => {
            rowHtml += `<td class="p-4 border-r border-white/5" id="cell-${p.id}-${cat}">
                <div class="flex items-center justify-center text-white/30 italic text-xs"><i class="fa-solid fa-lock mr-1"></i> Gizli</div>
            </td>`;
        });
        tr.innerHTML = rowHtml; els.votingTableBody.appendChild(tr);
    });

    // Kendi açma butonuma dinleyici ekle
    const revealBtn = document.getElementById('reveal-my-btn');
    if(revealBtn) revealBtn.addEventListener('click', () => {
        socket.emit('revealMyAnswers', currentRoomId);
        revealBtn.disabled = true; revealBtn.innerText = "Açık"; revealBtn.classList.replace('bg-fuchsia-600', 'bg-gray-600');
    });
});

socket.on('votingTimerUpdate', t => els.votingTimer.innerText = t);

socket.on('playerRevealed', ({ playerId, answers }) => {
    const categories = ['isim','sehir','ulke','hayvan','bitki','esya','meslek','yemek','film'];
    categories.forEach(cat => {
        const cell = document.getElementById(`cell-${playerId}-${cat}`);
        if (!cell) return;
        
        const ansText = (answers[cat] || '').trim().toUpperCase();
        if (ansText === '') {
            cell.innerHTML = `<span class="text-white/20 text-xs">Boş</span>`;
        } else {
            // Eğer açan kişi bensem oy butonları gösterme, değilsem göster
            const voteControls = playerId !== socket.id ? `
                <div class="flex gap-1 ml-2">
                    <button class="vote-btn upvote w-6 h-6 rounded bg-white/10 hover:bg-green-500/50 hover:text-white text-gray-400 transition flex items-center justify-center" data-target="${playerId}" data-cat="${cat}"><i class="fa-solid fa-check text-[10px]"></i></button>
                    <button class="vote-btn downvote w-6 h-6 rounded bg-white/10 hover:bg-red-500/50 hover:text-white text-gray-400 transition flex items-center justify-center" data-target="${playerId}" data-cat="${cat}"><i class="fa-solid fa-xmark text-[10px]"></i></button>
                </div>
            ` : '';
            
            cell.innerHTML = `
                <div class="flex items-center justify-between gap-1 w-full">
                    <span class="font-bold text-cyan-100 truncate flex-grow" title="${ansText}">${ansText}</span>
                    ${voteControls}
                </div>
            `;
        }
    });

    // Oy butonlarına tıklama eventleri
    if (playerId !== socket.id) {
        document.querySelectorAll(`#row-${playerId} .vote-btn`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget; const tId = target.dataset.target; const tCat = target.dataset.cat;
                const parent = target.parentElement;
                const upBtn = parent.querySelector('.upvote'); const downBtn = parent.querySelector('.downvote');
                
                upBtn.classList.remove('bg-green-500', 'text-white'); upBtn.classList.add('bg-white/10', 'text-gray-400');
                downBtn.classList.remove('bg-red-500', 'text-white'); downBtn.classList.add('bg-white/10', 'text-gray-400');

                if (target.classList.contains('upvote')) {
                    target.classList.replace('bg-white/10', 'bg-green-500'); target.classList.replace('text-gray-400', 'text-white');
                    myVotes[tId][tCat] = 1;
                } else {
                    target.classList.replace('bg-white/10', 'bg-red-500'); target.classList.replace('text-gray-400', 'text-white');
                    myVotes[tId][tCat] = -1;
                }
            });
        });
    }
});

els.submitMyVotesBtn.addEventListener('click', () => {
    socket.emit('submitVotes', { roomId: currentRoomId, votes: myVotes });
    els.submitMyVotesBtn.disabled = true; els.submitMyVotesBtn.classList.add('opacity-50'); els.submitMyVotesBtn.innerText = "OYLAR GÖNDERİLDİ, BEKLENİYOR...";
});

// SONUÇLAR
socket.on('roundEnded', ({ players, details }) => {
    switchGameView('results'); els.roomStatusBadge.innerText = "SONUÇLAR"; els.roomStatusBadge.className = "bg-green-500/30 text-green-200 px-4 py-1 rounded-full text-sm";
    els.leaderboardBody.innerHTML = ''; els.resultsDetailsContainer.innerHTML = '';
    
    // Skor Tablosu
    players.forEach((p, i) => {
        els.leaderboardBody.innerHTML += `<tr class="border-b border-white/5"><td class="p-4 text-white/30">#${i+1}</td><td class="p-4 font-bold ${p.id===socket.id?'text-cyan-400':''}">${p.avatar} ${p.username}</td><td class="p-4 text-right text-green-400 font-mono text-xl">${p.score}</td></tr>`;
    });

    // Detaylı Kelime Dökümü (Kim nede reddedildi görmek için)
    let detailsHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    players.forEach(p => {
        let pDetails = `<div class="bg-black/40 p-3 rounded border border-white/5"><h4 class="font-bold text-cyan-300 mb-2 border-b border-white/10 pb-1">${p.username}</h4><ul class="space-y-1">`;
        const categories = ['isim','sehir','ulke','hayvan','bitki','esya','meslek','yemek','film'];
        categories.forEach(cat => {
            let result = details[p.id][cat] || '';
            let color = result.includes('✅') ? 'text-green-400' : (result.includes('❌') ? 'text-red-400' : 'text-gray-500');
            pDetails += `<li class="flex justify-between"><span class="text-white/50 capitalize">${cat}:</span> <span class="${color} truncate max-w-[150px]" title="${result}">${result}</span></li>`;
        });
        detailsHtml += pDetails + '</ul></div>';
    });
    els.resultsDetailsContainer.innerHTML = detailsHtml + '</div>';
});

// SOHBET (Aynı)
els.sendChat.addEventListener('click', () => {
    if (els.chatInput.value.trim()) { socket.emit('chatMessage', { roomId: currentRoomId, message: els.chatInput.value.trim(), username: myUsername }); els.chatInput.value = ''; }
});
els.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') els.sendChat.click(); });
socket.on('newChatMessage', ({ username, text }) => {
    const isMe = username === myUsername;
    els.chatMessages.innerHTML += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-white rounded-bl-none'}">${!isMe ? `<span class="block text-[10px] text-fuchsia-300 font-bold">${username}</span>` : ''}<span class="break-words">${text}</span></div></div>`;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
});

function switchGameView(v) {
    els.lobbyView.classList.add('hidden'); els.playingView.classList.add('hidden'); els.votingView.classList.add('hidden'); els.resultsView.classList.add('hidden');
    document.getElementById(`${v}-view`).classList.remove('hidden'); document.getElementById(`${v}-view`).classList.add('flex');
}