// server.js - Express + Socket.IO server
const express = require('express');
const http = require('http');
const path = require('path');
const { createServer } = http;
const socketio = require('socket.io');
const Rooms = require('./rooms');
const DrawingState = require('./drawing-state');


const app = express();
const server = createServer(app);
const io = socketio(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'client')));

// single-room simple demo
const roomId = 'main';
const rooms = new Rooms();
rooms.createRoom(roomId);
const state = new DrawingState();
rooms.setState(roomId, state);

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.join(roomId);

  socket.on('join', (payload) => {
    socket.data.user = payload || {};
    socket.data.user.color = payload.color || randomColor();
    rooms.addUser(roomId, socket.id, socket.data.user);
    io.to(roomId).emit('users', rooms.getUsers(roomId));
  });

  socket.on('request-state', () => {
    socket.emit('init-state', { operations: state.getOps() });
  });

  socket.on('operation', (op) => {
    state.pushOperation(op);
    io.to(roomId).emit('remote-operation', op);
  });

  socket.on('pointer', (p) => {
    p.userId = socket.data.user.userId || p.userId || socket.id;
    io.to(roomId).emit('pointer', p);
  });

  socket.on('undo', ({ userId }) => {
    const res = state.undo();
    if (res) io.to(roomId).emit('undo-redo', { opId: res.id, active: res.active });
  });

  socket.on('redo', ({ userId }) => {
    const res = state.redo();
    if (res) io.to(roomId).emit('undo-redo', { opId: res.id, active: res.active });
  });

  socket.on('disconnect', () => {
    rooms.removeUser(roomId, socket.id);
    io.to(roomId).emit('users', rooms.getUsers(roomId));
  });
});

server.listen(PORT, () => console.log('Server running on port', PORT));

function randomColor() {
  const r = Math.floor(Math.random() * 200) + 30;
  const g = Math.floor(Math.random() * 200) + 30;
  const b = Math.floor(Math.random() * 200) + 30;
  return `rgb(${r},${g},${b})`;
}
