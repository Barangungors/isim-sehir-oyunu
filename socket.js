module.exports = function(io) {
    const rooms = {};
    const ALPHABET = "ABCÇDEFGHİIJKLMNOÖPRSŞTUÜVYZ";

    // Tüm odaların özetini istemcilere gönderen yardımcı fonksiyon
    function broadcastRoomList() {
        const publicRooms = Object.values(rooms).map(room => ({
            id: room.id,
            name: room.name,
            isPrivate: !!room.password,
            maxPlayers: room.maxPlayers,
            currentPlayers: Object.keys(room.players).length,
            status: room.status
        }));
        io.emit('roomListUpdated', publicRooms);
    }

    io.on('connection', (socket) => {
        console.log(`🟢 Yeni bağlantı: ${socket.id}`);
        
        // Kullanıcı giriş yaptığında ona mevcut odaları gönder
        socket.on('requestRooms', () => {
            broadcastRoomList();
        });

        // Yeni Oda Kurma
        socket.on('createRoom', ({ username, avatar, roomName, password, maxPlayers }) => {
            const cleanUsername = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
            
            socket.join(roomId);
            
            rooms[roomId] = {
                id: roomId,
                name: roomName.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
                password: password || null,
                maxPlayers: parseInt(maxPlayers) || 8,
                players: {},
                host: socket.id,
                status: 'lobby',
                currentLetter: '',
                timer: 60,
                interval: null,
                answers: {}
            };

            rooms[roomId].players[socket.id] = {
                id: socket.id,
                username: cleanUsername,
                avatar: avatar || '😎',
                score: 0,
                isHost: true
            };

            socket.emit('roomJoined', { roomId, room: rooms[roomId] });
            io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
            io.to(roomId).emit('systemNotification', { type: 'success', message: `${cleanUsername} odayı kurdu.` });
            broadcastRoomList();
        });

        // Mevcut Odaya Katılma
        socket.on('joinRoom', ({ username, avatar, roomId, password }) => {
            const room = rooms[roomId];
            
            if (!room) return socket.emit('roomError', 'Oda bulunamadı!');
            if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('roomError', 'Oda kapasitesi dolu!');
            if (room.status !== 'lobby') return socket.emit('roomError', 'Bu odada şu an oyun oynanıyor!');
            if (room.password && room.password !== password) return socket.emit('roomError', 'Yanlış şifre!');

            const cleanUsername = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            socket.join(roomId);

            room.players[socket.id] = {
                id: socket.id,
                username: cleanUsername,
                avatar: avatar || '😎',
                score: 0,
                isHost: false
            };

            socket.emit('roomJoined', { roomId, room });
            io.to(roomId).emit('updatePlayers', Object.values(room.players));
            io.to(roomId).emit('systemNotification', { type: 'info', message: `${cleanUsername} odaya katıldı.` });
            broadcastRoomList();
        });

        socket.on('startGame', (roomId) => {
            const room = rooms[roomId];
            if (room && room.host === socket.id) {
                startRound(io, roomId, room);
                broadcastRoomList(); // Durumu güncelleyip lobiye bildir
            }
        });

        socket.on('submitAnswers', ({ roomId, answers }) => {
            const room = rooms[roomId];
            if (room && room.status === 'playing') {
                room.answers[socket.id] = answers;
                io.to(roomId).emit('systemNotification', { type: 'info', message: `${room.players[socket.id].username} cevaplarını gönderdi.` });
                
                if (Object.keys(room.answers).length === Object.keys(room.players).length) {
                    endRound(io, roomId, room);
                }
            }
        });

        socket.on('chatMessage', ({ roomId, message, username }) => {
            const cleanMsg = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            io.to(roomId).emit('newChatMessage', { username, text: cleanMsg });
        });

        socket.on('disconnect', () => {
            for (const roomId in rooms) {
                if (rooms[roomId].players[socket.id]) {
                    const playerName = rooms[roomId].players[socket.id].username;
                    delete rooms[roomId].players[socket.id];
                    
                    if (Object.keys(rooms[roomId].players).length === 0) {
                        clearInterval(rooms[roomId].interval);
                        delete rooms[roomId];
                    } else {
                        if (rooms[roomId].host === socket.id) {
                            const newHostId = Object.keys(rooms[roomId].players)[0];
                            rooms[roomId].host = newHostId;
                            rooms[roomId].players[newHostId].isHost = true;
                            io.to(roomId).emit('systemNotification', { type: 'warning', message: `${rooms[roomId].players[newHostId].username} yeni host oldu.` });
                        }
                        io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
                        io.to(roomId).emit('systemNotification', { type: 'error', message: `${playerName} odadan ayrıldı.` });
                    }
                    broadcastRoomList();
                }
            }
        });
    });

    function startRound(io, roomId, room) {
        room.status = 'playing';
        room.answers = {};
        room.currentLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        room.timer = 60;

        io.to(roomId).emit('roundStarted', { letter: room.currentLetter, time: room.timer });

        clearInterval(room.interval);
        room.interval = setInterval(() => {
            room.timer--;
            io.to(roomId).emit('timerUpdate', room.timer);

            if (room.timer <= 0) endRound(io, roomId, room);
        }, 1000);
    }

    function endRound(io, roomId, room) {
        clearInterval(room.interval);
        room.status = 'results';
        
        const roundResults = calculateScores(room);
        for (const playerId in roundResults.scores) {
            if (room.players[playerId]) room.players[playerId].score += roundResults.scores[playerId];
        }

        io.to(roomId).emit('roundEnded', {
            players: Object.values(room.players).sort((a, b) => b.score - a.score),
            details: roundResults.details
        });
        broadcastRoomList();
    }

    function calculateScores(room) {
        const categories = ['isim', 'sehir', 'ulke', 'hayvan', 'bitki', 'esya', 'meslek', 'yemek', 'film'];
        const letter = room.currentLetter.toLowerCase();
        let scores = {};
        let details = {};

        for (const playerId in room.players) {
            scores[playerId] = 0;
            details[playerId] = {};
        }

        categories.forEach(category => {
            const allAnswersForCategory = [];
            for (const playerId in room.answers) {
                let ans = (room.answers[playerId][category] || "").trim().toUpperCase();
                const isValid = ans.startsWith(letter.toUpperCase());
                if (!isValid) ans = ""; 
                details[playerId][category] = ans;
                if (ans !== "") allAnswersForCategory.push(ans);
            }

            for (const playerId in room.players) {
                const ans = details[playerId][category];
                if (ans !== "") {
                    const count = allAnswersForCategory.filter(x => x === ans).length;
                    scores[playerId] += (count === 1) ? 10 : 5; 
                }
            }
        });
        return { scores, details };
    }
}