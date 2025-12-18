// services/game.service.js
const balanceService = require('./balance.service');

class GameService {
    constructor() {
        this.phase = 'BET'; // BET, RESULT, NEW_SESSION
        this.timer = 30;
        this.currentResult = null;
        this.bets = []; // { userId, side, amount }
    }

    startLoop(io) {
        setInterval(async () => {
            this.timer--;
            if (this.timer <= 0) {
                if (this.phase === 'BET') await this.processResult(io);
                else if (this.phase === 'RESULT') this.startNewSession(io);
            }
            io.emit('tick', { timer: this.timer, phase: this.phase });
        }, 1000);
    }

    async processResult(io) {
        this.phase = 'RESULT';
        this.timer = 10; // Thời gian xem kết quả
        const dices = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
        const total = dices.reduce((a,b) => a+b, 0);
        const winSide = total >= 11 ? 'TAI' : 'XIU';

        io.emit('open-result', { dices, total, winSide });

        // Trả thưởng cho những người thắng
        for (const bet of this.bets) {
            if (bet.side === winSide) {
                const winAmount = bet.amount * 2;
                await balanceService.updateBalance(bet.userId, winAmount);
                io.to(bet.userId).emit('update-balance', await balanceService.getBalance(bet.userId));
            }
        }
        this.bets = []; 
    }

    startNewSession(io) {
        this.phase = 'BET';
        this.timer = 30;
        io.emit('new-session', { session: Date.now() });
    }
}
module.exports = new GameService();
