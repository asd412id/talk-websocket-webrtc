var express = require('express');
var http = require('http');
var path = require('path');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;
const socketIo = require('socket.io');

var server = http.createServer(app);

var options = {
  debug: true
}

const peerServer = ExpressPeerServer(server, options);

app.use(express.static(path.join(__dirname, 'public')), peerServer);
server.listen();

const io = socketIo(server);

var users = [];
var caller = [];

io.on('connection', (socket) => {
  var srv = {};
  srv.config = {
    iceServers: [
      { urls: 'stun:st.webteknoid.com:5349' },
      { urls: 'turn:st.webteknoid.com:5349', username: 'asd412id', credential: 'password' }
    ]
  };
  srv.uid = socket.id;
  socket.emit('yourID', srv);

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
  socket.on('answered', data => {
    socket.broadcast.emit('answered', data);
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