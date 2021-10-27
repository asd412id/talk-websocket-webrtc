String.prototype.format = function () {
  var formatted = this;
  for (var i = 0; i < arguments.length; i++) {
    var regexp = new RegExp('\\{' + i + '\\}', 'gi');
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};
const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

var socket;
var yourID = null;
var yourName = params.name;
var listUser = [];
var talking = false;
var peer = null;
var streamDest = [];
var calls = [];
const context = new AudioContext();
const analyserNode = new AnalyserNode(context, { fftsize: 256 });
const connecting = new Audio('tone/connecting.ogg');
connecting.loop = true;
connecting.duration = 0;
const modal = `
<div class="modal fade" role="dialog" data-backdrop="static" aria-hidden="true" id="modal-login">
  <div class="modal-dialog modal-dialog-centered modal-sm" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title text-center">Masukkan Nama Anda</h5>
      </div>
      <form class="form" id="form-name">
      <div class="modal-body">
        <div class="form-group">
          <input type="text" id="name" class="form-control">
        </div>
      </div>
      <div class="modal-footer text-center">
        <button type="submit" class="btn btn-primary bg-olive">LOGIN</button>
      </div>
      </form>
    </div>
  </div>
</div>`;

function getMedia() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      autoGainControl: false,
      noiseSupperssion: true,
      latency: 0
    },
    video: false
  });
}

function populateUsers() {
  if (!talking) {
    var userw = `<button class="m-1 col-md-4 self-align-center btn btn-lg btn-info user" id="{0}" data-id="{0}" data-active="false" onclick="btnClick(this)">{1}</button>`;
    $("#users").empty();
    listUser.forEach(v => {
      $("#users").append(userw.format(v.id, v.name));
    });
  }
}

async function sendStream() {
  if (calls.length > 0) {
    connecting.pause();
    connecting.duration = 0;
    talking = false;
    calls.forEach(v => {
      v.close();
    });
  }
  if (streamDest.length > 0) {
    connecting.play();
    talking = true;
    const stream = await getMedia();
    streamDest.forEach(v => {
      const call = peer.call(v, stream);
      calls.push(call);
    });
  }
}

function allCall(btn) {
  const _btn = $(btn);
  const status = _btn.data('active');
  _btn.data('active', !status);
  _btn.removeClass('bg-maroon');
  if (!status == true) {
    _btn.addClass('bg-maroon');
  }
  $(".user").each(function () {
    const _user = $(this)
    if (!status == true) {
      streamDest.push(_user.data('id'));
      _user.prop('disabled', true);
      socket.emit('call', { from: yourID, to: _user.data('id') });
    } else {
      streamDest.splice(streamDest.indexOf(_user.data('id')), 1);
      _user.removeClass('btn-danger');
      socket.emit('end', { from: yourID, to: _user.data('id') });
    }
    _user.blur();
  });
  sendStream();
  populateUsers();
}

function btnClick(btn) {
  const _btn = $(btn);
  const status = _btn.data('active');
  _btn.data('active', !status);
  if (!status == true) {
    streamDest.push(_btn.data('id'));
    _btn.prop('disabled', true);
    socket.emit('call', { from: yourID, to: _btn.data('id') });
  } else {
    streamDest.splice(streamDest.indexOf(_btn.data('id')), 1);
    _btn.removeClass('btn-danger');
    socket.emit('end', { from: yourID, to: _btn.data('id') });
  }
  _btn.blur();
  sendStream();
  populateUsers();
}

$("#status").html(`<div class="p-1 bg-danger text-center">OFFLINE</div>`);
const startApp = () => {
  socket.on('connect', () => {
    $("#status").html(`<div class="p-1 bg-olive text-center">ONLINE</div>`);
  });
  socket.on('disconnect', () => {
    peer = null;
    $("#users").empty();
    $("#status").html(`<div class="p-1 bg-danger text-center">OFFLINE</div>`);
    $("#all").prop('disabled', true);
    $(".user").removeClass('btn-warning');
  });
  socket.on('yourID', async (srv) => {
    peer = await new Peer(srv.uid, {
      host: window.location.hostname,
      port: window.location.port,
      config: srv.config
    });
    peer.on('call', call => {
      call.answer();
      call.on('stream', (remoteStream) => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        context.createMediaStreamSource(remoteStream)
          .connect(analyserNode);
        var checkInt = setInterval(() => {
          const bufferLength = analyserNode.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserNode.getByteFrequencyData(dataArray);
          if (dataArray[0] > 0) {
            socket.emit('answered', { from: call.peer, to: yourID });
            clearInterval(checkInt);
          }
        }, 150);
      });
    });
    socket.emit('regdata', { id: srv.uid, name: yourName });
    yourID = srv.uid;
  });
  socket.on('users', users => {
    $("#status").html(`<div class="p-1 bg-olive text-center">ONLINE: <span class="badge badge-warning" style="font-size: 1em">` + yourName + `</span></div>`);
    if (users.length > 1) {
      $("#all").prop('disabled', false);
    }
    listUser = users;
    listUser.forEach((v, i) => {
      if (v.id == yourID) {
        listUser.splice(i, 1);
      }
    });
    populateUsers();
  });
  socket.on('caller', ids => {
    $(".user").removeClass('btn-warning');
    ids.forEach(id => {
      if (id.to == yourID) {
        $("#" + id.from).addClass('btn-warning');
      }
    });
  });
  socket.on('answered', data => {
    if (data.from == yourID) {
      connecting.pause();
      connecting.duration = 0;
      $("#" + data.to).prop('disabled', false);
      $("#" + data.to).addClass('btn-danger');
    }
  });
}

if (yourName == '' || yourName == undefined || yourName == null) {
  $("body").append(modal);
  $("#modal-login").modal("show");
  $("#form-name").off().submit(async function (e) {
    e.preventDefault();
    if ($("#name").val() != '') {
      yourName = $("#name").val();
      yourName = yourName.replace(/<(.|\n)*?>/g, '').trim()
      $("#modal-login").modal("hide");
      socket = await io();
      startApp();
    } else {
      alert('Anda harus memasukkan nama!');
    }
  });
} else {
  socket = io();
  startApp();
}