var express = require('express');
var https = require('https');
var path = require('path');
var fs = require('fs');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;
const socketIo = require('socket.io');

var privateKey = fs.readFileSync(path.join(__dirname, 'ssl', 'server.key'));
var certificate = fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt'));

var server = https.createServer({
  key: privateKey,
  cert: certificate
}, app);

var options = {
  debug: true,
  path: '/connect'
}
const peerServer = ExpressPeerServer(server, options);

app.use('/peerserver', peerServer);
app.use(express.static(path.join(__dirname, 'public')));
server.listen(3000);

const io = socketIo(server);
io.eio.pingTimeout = 5000;
io.eio.pingInterval = 1000;

var users = {};
var caller = [];
var channel = {};

io.on('connection', (socket) => {
  var srv = {};
  srv.config = {};
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
    socket.to(channel[socket.id]).emit('users', users[channel[socket.id]]);
    socket.emit('users', users[channel[socket.id]]);
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
});