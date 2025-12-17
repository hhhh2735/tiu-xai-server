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

let gameHistory = []; // Lưu danh sách kết quả (1: Tài, 0: Xỉu)
let currentBets = []; // Danh sách cược phiên hiện tại

let gameState = {
    timer: 45,
    phase: 'BET', 
    totalTai: 0,
    totalXiu: 0,
    session: 1001,
    dice: [1, 1, 1],
    result: '',
    history: [] // Gửi kèm lịch sử về cho client
};

// --- VÒNG LẶP GAME 24/24 ---
setInterval(async () => {
    gameState.timer--;
    
    if (gameState.timer <= 0) {
        if (gameState.phase === 'BET') {
            // --- KẾT THÚC PHIÊN CƯỢC -> RA KẾT QUẢ ---
            gameState.phase = 'RESULT';
            gameState.timer = 15; // Thời gian nặn
            
            const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
            gameState.dice = dice;
            const sum = dice.reduce((a, b) => a + b);
            gameState.result = (sum > 10) ? 'TAI' : 'XIU';
            
            // Cập nhật mảng lịch sử cầu
            const resultBit = (gameState.result === 'TAI') ? 1 : 0;
            gameHistory.push(resultBit);
            if (gameHistory.length > 20) gameHistory.shift(); 
            gameState.history = gameHistory;

            io.emit('finish-bet', gameState);

            // Tự động trả thưởng sau 10 giây (khi người chơi nặn xong)
            setTimeout(() => {
                handlePayout(gameState.result);
            }, 10000);

        } else {
            // --- BẮT ĐẦU PHIÊN MỚI ---
            gameState.phase = 'BET';
            gameState.timer = 45;
            gameState.totalTai = 0;
            gameState.totalXiu = 0;
            gameState.session++;
            currentBets = []; 
            io.emit('new-session', gameState);
        }
    }
    // Gửi tick để đồng bộ thời gian
    io.emit('tick', { timer: gameState.timer, phase: gameState.phase });
}, 1000);

// --- HÀM XỬ LÝ TRẢ THƯỞNG ---
async function handlePayout(winSide) {
    for (let bet of currentBets) {
        if (bet.side === winSide) {
            const winAmount = bet.amount * 1.95;
            let { data: p } = await supabase.from('players').select('balance').eq('username', bet.username).single();
            if (p) {
                const newBalance = p.balance + winAmount;
                await supabase.from('players').update({ balance: newBalance }).eq('username', bet.username);
                io.emit('update-balance-win', { username: bet.username, newBalance: newBalance });
            }
        }
    }
}

// --- KẾT NỐI NGƯỜI CHƠI ---
io.on('connection', (socket) => {
    socket.on('join-game', async (username) => {
        if(!username) return;
        let { data: player } = await supabase.from('players').select('*').eq('username', username).single();
        if (!player) {
            const { data } = await supabase.from('players').insert([{ username: username, balance: 100000 }]).select().single();
            player = data;
        }
        socket.emit('update-balance', player.balance);
        
        // QUAN TRỌNG: Gửi toàn bộ gameState (gồm cả history) để Client vẽ bảng cầu
        socket.emit('init-game', gameState);
    });

    socket.on('place-bet', async (data) => {
        const { username, amount, side } = data;
        if (gameState.phase !== 'BET' || gameState.timer <= 2) return;

        let { data: player } = await supabase.from('players').select('balance').eq('username', username).single();
        
        if (player && player.balance >= amount) {
            const newBalance = player.balance - amount;
            await supabase.from('players').update({ balance: newBalance }).eq('username', username);
            
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
