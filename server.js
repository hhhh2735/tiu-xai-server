const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- KẾT NỐI SUPABASE (Lấy ở phần Project Settings -> API) ---
const supabase = createClient('https://qimyjctcipdgkfhudunv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXlqY3RjaXBkZ2tmaHVkdW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5OTk4NzIsImV4cCI6MjA4MTU3NTg3Mn0.Y_1Wr3DT11KDk_PmPoOoNETB-nBvYM79wrc7KyIN4vE');

app.use(express.static('public'));

let gameState = {
    timer: 45,
    phase: 'BET', 
    totalTai: 0,
    totalXiu: 0,
    session: 1001
};

// Vòng lặp game
setInterval(async () => {
    gameState.timer--;
    if (gameState.timer <= 0) {
        if (gameState.phase === 'BET') {
            gameState.phase = 'RESULT';
            gameState.timer = 15;
            const dice = [1,2,3].map(() => Math.floor(Math.random() * 6) + 1);
            gameState.dice = dice;
            gameState.result = (dice.reduce((a,b) => a+b) > 10) ? 'TAI' : 'XIU';
            io.emit('finish-bet', gameState);
        } else {
            gameState.phase = 'BET';
            gameState.timer = 45;
            gameState.totalTai = 0;
            gameState.totalXiu = 0;
            gameState.session++;
            io.emit('new-session', gameState);
        }
    }
    io.emit('tick', { timer: gameState.timer, phase: gameState.phase });
}, 1000);

io.on('connection', (socket) => {
    // Khi người chơi đăng nhập/vào game
    socket.on('join-game', async (username) => {
        let { data: player } = await supabase.from('players').select('*').eq('username', username).single();
        if (!player) {
            const { data } = await supabase.from('players').insert([{ username: username, balance: 100000 }]).select().single();
            player = data;
        }
        socket.emit('update-balance', player.balance);
    });

    // Xử lý đặt cược và trừ tiền trong DB
    socket.on('place-bet', async (data) => {
        const { username, amount, side } = data;
        let { data: player } = await supabase.from('players').select('balance').eq(username, username).single();
        
        if (player && player.balance >= amount) {
            const newBalance = player.balance - amount;
            await supabase.from('players').update({ balance: newBalance }).eq('username', username);
            
            if (side === 'TAI') gameState.totalTai += amount;
            else gameState.totalXiu += amount;
            
            io.emit('update-pools', { tai: gameState.totalTai, xiu: gameState.totalXiu });
            socket.emit('update-balance', newBalance);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server is running...'));

