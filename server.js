const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const path = require('path');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Production'da sadece kendi domaininize izin verin
});

// Güvenlik ve performans middleware'leri
app.use(helmet({
    contentSecurityPolicy: false, // CDN'ler (Tailwind vb.) için dev modunda kapalı
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Socket mantığını ayrı modülden çağırıyoruz
socketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Oyun sunucusu ${PORT} portunda çalışıyor.`);
});