const supabase = require("../config/supabase");

async function updateBalance(userId, amount) {
  const { data, error } = await supabase.rpc("update_balance", {
    uid: userId,
    delta: amount,
  });

  if (error) throw error;
  return data;
}

module.exports = { updateBalance };
