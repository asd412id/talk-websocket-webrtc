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
var yourChannel = params.channel;
var listUser = [];
var talking = false;
var peer = null;
var streamDest = [];
var calls = {};
const context = new AudioContext();
const analyserNode = new AnalyserNode(context, { fftsize: 256 });
var connecting = new Audio('tone/connecting.ogg');
connecting = Object.assign(connecting, {
  volume: 0.1,
  loop: true
});
connecting.play();
connecting.pause();
connecting.duration = 0;
const modal = `
<div class="modal fade" role="dialog" data-backdrop="static" aria-hidden="true" id="modal-login">
  <div class="modal-dialog modal-dialog-centered modal-sm" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title text-center">Masukkan Informasi Login</h5>
      </div>
      <form class="form" id="form-login">
      <div class="modal-body">
        <div class="form-group">
          <input type="text" id="name" class="form-control" placeholder="Nama Anda">
        </div>
        <div class="form-group">
          <input type="text" id="channel" class="form-control" placeholder="Nama Channel/Grup">
        </div>
        <div class="form-group text-center">
          <button type="submit" class="btn btn-primary bg-olive">LOGIN</button>
        </div>
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
  if (Object.keys(calls).length > 0) {
    talking = false;
    connecting.pause();
    connecting.duration = 0;
    Object.keys(calls).forEach(v => {
      try {
        calls[v].close();
      } catch (error) {
        console.log(error);
        delete calls[v];
      }
    });
  }
  if (streamDest.length > 0) {
    talking = true;
    connecting.play();
    streamDest.forEach(v => {
      calls[v] = peer.call(v, connecting.captureStream());
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
    btnClick($(this));
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
    _btn.addClass('bg-secondary');
    socket.emit('call', { from: yourID, to: _btn.data('id') });
  } else {
    streamDest.splice(streamDest.indexOf(_btn.data('id')), 1);
    _btn.removeClass('bg-secondary');
    _btn.removeClass('btn-danger');
    socket.emit('end', { from: yourID, to: _btn.data('id') });
  }
  _btn.blur();
  sendStream();
  populateUsers();
}

$("#status").html(`<div class="p-1 bg-danger text-center">SILAHKAN LOGIN</div>`);
const startApp = async () => {
  socket = await io();
  socket.on('connect', () => {
    $("#status").html(`<div class="p-1 bg-purple text-center">MENYAMBUNGKAN</div>`);
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
      path: '/peerserver/connect',
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
          if (dataArray.some(el => el > 0)) {
            socket.emit('answered', { from: call.peer, to: yourID });
            clearInterval(checkInt);
          }
        }, 150);
      });
    });
    socket.emit('regdata', { id: srv.uid, name: yourName, channel: yourChannel });
    yourID = srv.uid;
  });
  socket.on('users', users => {
    $("#status").html(`<div class="p-1 bg-olive text-center"><span class="badge badge-warning" style="font-size: 1em">` + yourName + `</span>&nbsp;<span class="badge bg-maroon" style="font-size: 1em">` + yourChannel + ` (` + users.length + `)</span></div>`);
    $("#all").prop('disabled', true);
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
  socket.on('answered', async (data) => {
    if (data.from == yourID) {
      connecting.pause();
      connecting.duration = 0;
      const mmedia = await getMedia();
      const mstream = mmedia.getAudioTracks()[0];
      calls[data.to].peerConnection.getSenders()[0].replaceTrack(mstream);
      $("#" + data.to).removeClass('bg-secondary');
      $("#" + data.to).addClass('btn-danger');
    }
  });
}

if (yourName == '' || yourName == undefined || yourName == null || yourChannel == '' || yourChannel == undefined || yourChannel == null) {
  $("body").append(modal);
  $("#name").val(yourName);
  $("#channel").val(yourChannel);
  $("#modal-login").on("shown.bs.modal", function () {
    $("#modal-login").find("input:text").each(function () {
      if ($(this).val() == '') {
        $(this).focus();
        return false;
      }
    });
  });
  $("#modal-login").modal("show");
  $("#form-login").off().submit(async function (e) {
    e.preventDefault();
    if ($("#name").val() != '' && $("#channel").val() != '') {
      yourName = $("#name").val();
      yourName = yourName.replace(/<(.|\n)*?>/g, '').trim()
      yourChannel = $("#channel").val();
      yourChannel = yourChannel.replace(/<(.|\n)*?>/g, '').trim()
      $("#modal-login").modal("hide");
      $("#status").html(`<div class="p-1 bg-purple text-center">MENYAMBUNGKAN</div>`);
      startApp();
    } else {
      alert('Anda harus memasukkan nama Anda serta nama channel/grup!');
      $("#modal-login").find("input:text").each(function () {
        if ($(this).val() == '') {
          $(this).focus();
          return false;
        }
      });
    }
  });
} else {
  startApp();
}