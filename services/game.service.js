function rollDice() {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

function calcResult(dices) {
  const sum = dices.reduce((a, b) => a + b, 0);

  const isTriple = dices[0] === dices[1] && dices[1] === dices[2];

  if (isTriple) {
    return { type: "triple", sum };
  }

  if (sum >= 11) return { type: "TAI", sum };
  return { type: "XIU", sum };
}

module.exports = { rollDice, calcResult };
