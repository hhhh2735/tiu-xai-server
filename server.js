const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "*", // Cho phép file index.html từ máy bạn kết nối tới
        methods: ["GET", "POST"]
    }
});

// 1. Khởi tạo trạng thái game
let gameState = {
    timer: 45,
    phase: 'BET',
    sessionId: "#" + Math.floor(Math.random() * 1000000),
    history: []
};

// 2. Định nghĩa trang chủ (để hết lỗi Cannot GET /)
app.get('/', (req, res) => {
    res.send("Server Bùi Hải Casino đang chạy...");
});

// 3. Vòng lặp đếm ngược (Timer) - QUAN TRỌNG ĐỂ ĐỒNG HỒ CHẠY
setInterval(() => {
    if (gameState.timer > 0) {
        gameState.timer--;
    } else {
        // Hết 45 giây cược thì chuyển sang nặn/kết quả rồi reset
        if (gameState.phase === 'BET') {
            gameState.phase = 'RESULT';
            gameState.timer = 15; // 15 giây chờ phiên mới

            // Tạo xúc xắc ngẫu nhiên
            const dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
            const sum = dice.reduce((a,b) => a+b, 0);
            const side = sum > 10 ? 'TAI' : 'XIU';
            
            // Gửi kết quả cho người chơi
            io.emit('result_event', { dice, sum, side });
            gameState.history.push({ sum, side });
        } else {
            gameState.phase = 'BET';
            gameState.timer = 45;
            gameState.sessionId = "#" + Math.floor(Math.random() * 1000000);
        }
    }
    // Gửi thời gian thực xuống client
    io.emit('update_game', gameState);
}, 1000);

io.on('connection', (socket) => {
    console.log('Có người chơi kết nối:', socket.id);
    socket.emit('update_game', gameState);

    socket.on('place_bet', (data) => {
        console.log(`${data.name} cược ${data.amount} vào ${data.side}`);
    });
});

// 4. Lắng nghe cổng của Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER LIVE TẠI PORT ${PORT}`);
});
