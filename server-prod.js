var express = require('express');
var http = require('http');
var path = require('path');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;
const socketIo = require('socket.io');

var options = {
  debug: true
}

var server = http.createServer(app);

const peerServer = ExpressPeerServer(server, options);

app.use(express.static(path.join(__dirname, 'public')), peerServer);
server.listen(9000);

const io = socketIo(server);

var users = [];
var caller = [];

io.on('connection', (socket) => {
  socket.emit('yourID', socket.id);

  socket.on('disconnect', () => {
    users.forEach((v, i) => {
      if (v.id == socket.id) {
        users.splice(i, 1);
      }
    });
    socket.broadcast.emit('users', users);
  });

  socket.on('regdata', data => {
    users.push(data);
    socket.broadcast.emit('users', users);
    socket.emit('users', users);
  });

  socket.on('call', id => {
    caller.push(id)
    socket.broadcast.emit('caller', caller);
  });
  socket.on('end', id => {
    caller.forEach((v, i) => {
      if (v.from == id.from) {
        caller.splice(i, 1);
      }
    });
    socket.broadcast.emit('caller', caller);
  });
});