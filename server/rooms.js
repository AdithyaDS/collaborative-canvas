// server/rooms.js - minimal room/user management
class Rooms {
  constructor(){ this.rooms = new Map(); }

  createRoom(id){
    if (!this.rooms.has(id)) this.rooms.set(id, { users: new Map(), state: null });
  }

  setState(id, state){
    this.createRoom(id);
    this.rooms.get(id).state = state;
  }

  addUser(roomId, socketId, user){
    this.createRoom(roomId);
    this.rooms.get(roomId).users.set(socketId, user);
  }

  removeUser(roomId, socketId){
    this.createRoom(roomId);
    this.rooms.get(roomId).users.delete(socketId);
  }

  getUsers(roomId){
    const r = this.rooms.get(roomId);
    return Array.from((r && r.users) || []).map(([sid,u]) => ({ socketId: sid, ...u }));
  }
}

module.exports = Rooms;
