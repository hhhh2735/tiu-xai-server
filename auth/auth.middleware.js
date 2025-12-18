const supabase = require("../config/supabase");

module.exports = async function authSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("NO_TOKEN"));

    const { data, error } = await supabase.auth.getUser(token);
    if (error) return next(new Error("INVALID_TOKEN"));

    socket.user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch (e) {
    next(new Error("AUTH_FAILED"));
  }
};
