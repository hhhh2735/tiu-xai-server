require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(express.static('public'));

/* ================== GAME STATE ================== */

let gameHistory = [];
let currentBets = [];
let payoutDone = false;

let gameState = {
  timer: 45,
  phase: 'BET',
  totalTai: 0,
  totalXiu: 0,
  session: 1001,
  dice: [1, 1, 1],
  result: '',
  history: []
};

/* ================== GAME LOOP ================== */

setInterval(async () => {
  gameState.timer--;

  if (gameState.timer <= 0) {
    if (gameState.phase === 'BET') {
      gameState.phase = 'RESULT';
      gameState.timer = 15;
      payoutDone = false;

      const dice = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * 6) + 1
      );

      gameState.dice = dice;

      const sum = dice.reduce((a, b) => a + b);
      const [a, b, c] = dice;

      if (a === b && b === c) {
        gameState.result = 'TRIPLE';
      } else if (sum >= 11) {
        gameState.result = 'TAI';
      } else {
        gameState.result = 'XIU';
      }

      const historyItem = {
        dice,
        sum,
        result: gameState.result
      };

      gameHistory.push(historyItem);
      if (gameHistory.length > 30) gameHistory.shift();
      gameState.history = gameHistory;

      io.emit('finish-bet', {
        dice,
        result: gameState.result,
        session: gameState.session,
        history: gameState.history
      });

      setTimeout(handlePayout, 5000);

    } else {
      gameState.phase = 'BET';
      gameState.timer = 45;
      gameState.totalTai = 0;
      gameState.totalXiu = 0;
      gameState.session++;
      currentBets = [];

      io.emit('new-session', {
        session: gameState.session,
        history: gameState.history
      });
    }
  }

  io.emit('tick', {
    timer: gameState.timer,
    phase: gameState.phase,
    totalTai: gameState.totalTai,
    totalXiu: gameState.totalXiu
  });

}, 1000);

/* ================== PAYOUT ================== */

async function handlePayout() {
  if (payoutDone) return;
  payoutDone = true;

  if (gameState.result === 'TRIPLE') return;

  for (const bet of currentBets) {
    if (bet.side === gameState.result) {
      const winAmount = Math.floor(bet.amount * 1.95);

      await supabase.rpc('update_balance', {
        uid: bet.playerId,
        delta: winAmount
      });

      io.emit('player-win', {
        username: bet.username,
        amount: winAmount
      });
    }
  }
}

/* ================== SOCKET ================== */

io.on('connection', (socket) => {

  socket.on('join-game', async (username) => {
    if (!username) return;

    let { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (!player) {
      const { data } = await supabase
        .from('players')
        .insert([{ username, balance: 100000 }])
        .select()
        .single();
      player = data;
    }

    socket.player = player;

    socket.emit('init-game', gameState);
    socket.emit('update-balance', player.balance);
  });

  socket.on('place-bet', async ({ amount, side }) => {
    if (!socket.player) return;
    if (gameState.phase !== 'BET' || gameState.timer <= 2) return;

    const player = socket.player;

    const { data: fresh } = await supabase
      .from('players')
      .select('balance')
      .eq('id', player.id)
      .single();

    if (!fresh || fresh.balance < amount) return;

    await supabase.rpc('update_balance', {
      uid: player.id,
      delta: -amount
    });

    currentBets.push({
      playerId: player.id,
      username: player.username,
      amount,
      side
    });

    if (side === 'TAI') gameState.totalTai += amount;
    else gameState.totalXiu += amount;

    socket.emit('update-balance', fresh.balance - amount);

    io.emit('update-pools', {
      tai: gameState.totalTai,
      xiu: gameState.totalXiu
    });
  });

});

/* ================== START ================== */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log('Server running on port ' + PORT)
);
