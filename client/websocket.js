// websocket.js - wrapper for socket events
const WS = (() => {
let socket;
function connect() {
socket = io();
return socket;
}
function on(evt, cb) { if (!socket) connect(); socket.on(evt, cb); }
function emit(evt, data) { if (!socket) connect(); socket.emit(evt, data); }
return { connect, on, emit };
})();