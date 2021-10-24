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
server.listen();

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
  });

  socket.on('regdata', data => {
    users.push(data);
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
  
  peerServer.on('connection', client => {
    console.log('Connected:' + client.id);
	socket.broadcast.emit('users', users);
    socket.emit('users', users);
  });
  peerServer.on('disconnect', client => {
	socket.broadcast.emit('users', users);
    console.log('Disconnected: ' + client.id);
  });
});