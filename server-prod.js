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

var users = {};
var caller = [];
var channel = {};

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
    users[channel[socket.id]].forEach((v, i) => {
      if (v.id == socket.id) {
        users[channel[socket.id]].splice(i, 1);
      }
    });
    socket.to(channel[socket.id]).emit('users', users[channel[socket.id]]);
  });

  socket.on('regdata', data => {
    socket.join(data.channel);
    channel[socket.id] = data.channel;
    if (!(data.channel in users)) {
      users[data.channel] = [];
    }
    users[data.channel].push(data);
  });

  socket.on('call', id => {
    caller.push(id)
    socket.to(channel[socket.id]).emit('caller', caller);
  });
  socket.on('answered', data => {
    socket.to(channel[socket.id]).emit('answered', data);
  });
  socket.on('end', id => {
    caller.forEach((v, i) => {
      if (v.from == id.from) {
        caller.splice(i, 1);
      }
    });
    socket.to(channel[socket.id]).emit('caller', caller);
  });

  peerServer.on('connection', client => {
    socket.to(channel[socket.id]).emit('users', users[channel[socket.id]]);
    socket.emit('users', users[channel[socket.id]]);
  });
  peerServer.on('disconnect', client => {
    socket.to(channel[socket.id]).emit('users', users[channel[socket.id]]);
  });
});