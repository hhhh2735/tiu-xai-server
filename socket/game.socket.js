const { rollDice, calcResult } = require("../services/game.service");
const { updateBalance } = require("../services/balance.service");

/* ================= GAME STATE ================= */

let gameState = {
  phase: "BET",        // BET | RESULT
  timer: 30,
  session: 1,
  dices: [],
  result: null,
};

let bets = [];
let payoutDone = false;

/* ================= GAME LOOP ================= */

setInterval(async () => {
  gameState.timer--;

  /* ===== HẾT GIỜ ĐẶT CƯỢC ===== */
  if (gameState.phase === "BET" && gameState.timer <= 0) {
    gameState.phase = "RESULT";
    gameState.timer = 10;
    payoutDone = false;

    gameState.dices = rollDice();
    gameState.result = calcResult(gameState.dices);
    // result.type: "TAI" | "XIU" | "TRIPLE"

    global.io.emit("open-result", {
      session: gameState.session,
      dices: gameState.dices,
      result: gameState.result,
    });

    // Trả thưởng sau khi mở bát
    setTimeout(handlePayout, 2000);
  }

  /* ===== BẮT ĐẦU PHIÊN MỚI ===== */
  if (gameState.phase === "RESULT" && gameState.timer <= 0) {
    gameState.phase = "BET";
    gameState.timer = 30;
    gameState.session++;
    bets = [];

    global.io.emit("new-session", {
      session: gameState.session,
    });
  }

  /* ===== ĐỒNG HỒ CHẠY ===== */
  global.io.emit("tick", {
    phase: gameState.phase,
    timer: gameState.timer,
    session: gameState.session,
  });

}, 1000);

/* ================= PAYOUT ================= */

async function handlePayout() {
  if (payoutDone) return;
  payoutDone = true;

  // TRIPLE → nhà ăn hết
  if (gameState.result.type === "TRIPLE") return;

  for (const bet of bets) {
    if (bet.side === gameState.result.type) {
      const winAmount = Math.floor(bet.amount * 1.95);
      await updateBalance(bet.userId, winAmount);
    }
  }
}

/* ================= SOCKET ================= */

module.exports = function gameSocket(io) {
  global.io = io;

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    /* ===== JOIN GAME ===== */
    socket.on("join", (user) => {
      // user: { id, username }
      socket.user = user;

      // GỬI STATE HIỆN TẠI CHO USER MỚI
      socket.emit("init", {
        phase: gameState.phase,
        timer: gameState.timer,
        session: gameState.session,
      });
    });

    /* ===== ĐẶT CƯỢC ===== */
    socket.on("bet", async ({ side, amount }) => {
      if (!socket.user) return;
      if (gameState.phase !== "BET") return;
      if (gameState.timer <= 2) return;
      if (amount <= 0) return;
      if (!["TAI", "XIU"].includes(side)) return;

      try {
        // Trừ tiền trước
        await updateBalance(socket.user.id, -amount);

        bets.push({
          userId: socket.user.id,
          side,
          amount,
        });

        socket.emit("bet-ok");
      } catch (err) {
        socket.emit("error", "Không đủ số dư");
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
