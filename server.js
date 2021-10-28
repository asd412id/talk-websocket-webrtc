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
server.listen(3000);

const io = socketIo(server);

var users = {};
var caller = [];
var channel = {};

io.on('connection', (socket) => {
  var srv = {};
  srv.config = null;
  srv.uid = socket.id;
  socket.emit('yourID', srv);

  socket.on('disconnect', () => {
    const chn = channel[socket.id];
    users[channel[socket.id]].forEach((v, i) => {
      if (v.id == socket.id) {
        users[channel[socket.id]].splice(i, 1);
        if (users[channel[socket.id]].length == 0) {
          delete users[channel[socket.id]];
        }
        delete channel[socket.id];
      }
    });
    socket.to(chn).emit('users', users[chn]);
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

  peerServer.on('connection', () => {
    socket.to(channel[socket.id]).emit('users', users[channel[socket.id]]);
    socket.emit('users', users[channel[socket.id]]);
  });
});