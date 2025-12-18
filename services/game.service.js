function rollDice() {
  return [
    Math.ceil(Math.random() * 6),
    Math.ceil(Math.random() * 6),
    Math.ceil(Math.random() * 6),
  ];
}

function calcResult(dices) {
  const sum = dices.reduce((a, b) => a + b, 0);
  const isTriple = dices[0] === dices[1] && dices[1] === dices[2];

  if (isTriple) return { type: "triple", sum };
  if (sum >= 4 && sum <= 10) return { type: "xiu", sum };
  return { type: "tai", sum };
}

module.exports = { rollDice, calcResult };
