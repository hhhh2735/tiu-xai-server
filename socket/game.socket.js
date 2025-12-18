const { rollDice, calcResult } = require("../services/game.service");
const { updateBalance } = require("../services/balance.service");

module.exports = function gameSocket(io) {
  io.on("connection", (socket) => {
    console.log("User connected", socket.id);

    socket.on("bet", async ({ userId, side, amount }) => {
      try {
        await updateBalance(userId, -amount);

        const dices = rollDice();
        const result = calcResult(dices);

        let win = false;
        if (!result.type.includes("triple") && result.type === side) {
          win = true;
          await updateBalance(userId, amount * 2);
        }

        socket.emit("result", { dices, result, win });
      } catch (e) {
        socket.emit("error", e.message);
      }
    });
  });
};

