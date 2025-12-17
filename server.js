const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- KẾT NỐI SUPABASE ---
const supabase = createClient('https://qimyjctcipdgkfhudunv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXlqY3RjaXBkZ2tmaHVkdW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5OTk4NzIsImV4cCI6MjA4MTU3NTg3Mn0.Y_1Wr3DT11KDk_PmPoOoNETB-nBvYM79wrc7KyIN4vE');

app.use(express.static('public'));

let gameState = {
    timer: 45,
    phase: 'BET', 
    totalTai: 0,
    totalXiu: 0,
    session: 1001,
    dice: [1, 1, 1],
    result: ''
};

// Danh sách lưu cược của phiên hiện tại để tính thưởng
let currentBets = []; 

setInterval(async () => {
    gameState.timer--;
    
    if (gameState.timer <= 0) {
        if (gameState.phase === 'BET') {
            // Hết giờ cược -> Chốt kết quả
            gameState.phase = 'RESULT';
            gameState.timer = 15; // Thời gian nặn bát
            
            const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
            gameState.dice = dice;
            const sum = dice.reduce((a, b) => a + b);
            gameState.result = (sum > 10) ? 'TAI' : 'XIU';
            
            io.emit('finish-bet', gameState);

            // Tự động xử lý trả thưởng sau khi nặn xong (sau 10s)
            setTimeout(() => {
                handlePayout(gameState.result);
            }, 10000);

        } else {
            // Bắt đầu phiên mới
            gameState.phase = 'BET';
            gameState.timer = 45;
            gameState.totalTai = 0;
            gameState.totalXiu = 0;
            gameState.session++;
            currentBets = []; // Xóa danh sách cược cũ
            io.emit('new-session', gameState);
        }
    }
    io.emit('tick', { timer: gameState.timer, phase: gameState.phase });
}, 1000);

// Hàm tính tiền thắng và cập nhật Supabase
async function handlePayout(winSide) {
    for (let bet of currentBets) {
        if (bet.side === winSide) {
            const winAmount = bet.amount * 1.95;
            // Lấy số dư hiện tại
            let { data: p } = await supabase.from('players').select('balance').eq('username', bet.username).single();
            if (p) {
                const newBalance = p.balance + winAmount;
                await supabase.from('players').update({ balance: newBalance }).eq('username', bet.username);
                // Gửi thông báo về cho người chơi đó cập nhật lại tiền
                io.emit('update-balance-win', { username: bet.username, newBalance: newBalance });
            }
        }
    }
}

io.on('connection', (socket) => {
    socket.on('join-game', async (username) => {
        let { data: player } = await supabase.from('players').select('*').eq('username', username).single();
        if (!player) {
            const { data } = await supabase.from('players').insert([{ username: username, balance: 100000 }]).select().single();
            player = data;
        }
        socket.emit('update-balance', player.balance);
        socket.emit('init-game', gameState);
    });

    socket.on('place-bet', async (data) => {
        const { username, amount, side } = data;
        if (gameState.phase !== 'BET' || gameState.timer <= 5) return;

        let { data: player } = await supabase.from('players').select('balance').eq('username', username).single();
        
        if (player && player.balance >= amount) {
            const newBalance = player.balance - amount;
            await supabase.from('players').update({ balance: newBalance }).eq('username', username);
            
            // Lưu vào danh sách để lát nữa tính thưởng
            currentBets.push({ username, amount, side });

            if (side === 'TAI') gameState.totalTai += amount;
            else gameState.totalXiu += amount;
            
            io.emit('update-pools', { tai: gameState.totalTai, xiu: gameState.totalXiu });
            socket.emit('update-balance', newBalance);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server is running on port ' + PORT));
