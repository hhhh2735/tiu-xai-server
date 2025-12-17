const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let timer = 45;
let phase = 'BETTING'; 
let sessionId = Math.floor(Math.random() * 9999);
let lastResult = { dice: [1,1,1], sum: 3, side: 'XIU' };

setInterval(() => {
    timer--;
    if (timer <= 0) {
        if (phase === 'BETTING') {
            phase = 'NAN'; timer = 15;
            const d = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
            const s = d[0]+d[1]+d[2];
            lastResult = { dice: d, sum: s, side: s > 10 ? 'TAI' : 'XIU' };
            io.emit('finish-betting', lastResult);
        } else {
            phase = 'BETTING'; timer = 45; sessionId++;
            io.emit('new-session', { sessionId });
        }
    }
    io.emit('timer-update', { timer, phase });
}, 1000);

io.on('connection', (socket) => {
    socket.emit('init-game', { timer, phase, sessionId });
    socket.on('send-chat', (data) => io.emit('receive-chat', data));
    socket.on('place-bet', (data) => socket.broadcast.emit('someone-bet', data));
});

server.listen(3000, () => console.log("--- SERVER TAI XIU DANG CHAY TAI PORT 3000 ---"));