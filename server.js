var express = require('express');
var https = require('https');
var path = require('path');
var fs = require('fs');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;
const socketIo = require('socket.io');

var privateKey = fs.readFileSync(path.join(__dirname, 'ssl', 'server.key'));
var certificate = fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt'));

var options = {
  debug: true
}

var server = https.createServer({
  key: privateKey,
  cert: certificate
}, app);

const peerServer = ExpressPeerServer(server, options);

app.use(express.static(path.join(__dirname, 'public')), peerServer);
server.listen(9000);

const io = socketIo(server);

var users = [];
var caller = [];

peerServer.on('connection', client => {
  console.log('Connected:' + client.id);
});
peerServer.on('disconnect', client => {
  console.log('Disconnected: ' + client.id);
});

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