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
const modal = `
<div class="modal fade" role="dialog" data-backdrop="static" aria-hidden="true" id="modal-login">
  <div class="modal-dialog modal-sm" role="document">
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
$("body").append(modal);

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
    talking = false;
    calls.forEach(v => {
      v.close();
    });
  }
  if (streamDest.length > 0) {
    talking = true;
    const stream = await getMedia();
    streamDest.forEach(v => {
      const call = peer.call(v, stream);
      calls.push(call);
    });
  }
}

function allCall(btn) {
  streamDest = [];
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
      _user.addClass('btn-danger');
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
    _btn.addClass('btn-danger');
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
    $("#all").prop('disabled', false);
  });
  socket.on('disconnect', () => {
    $("#users").empty();
    $("#status").html(`<div class="p-1 bg-danger text-center">OFFLINE</div>`);
    $("#all").prop('disabled', true);
  });
  socket.on('yourID', ID => {
    $("#status").html(`<div class="p-1 bg-olive text-center">ONLINE: <span class="badge badge-warning" style="font-size: 1em">` + yourName + `</span></div>`);
    peer = new Peer(ID);
    peer.on('call', call => {
      call.answer(null);
      call.on('stream', remoteStream => {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = remoteStream;
      });
    });
    socket.emit('regdata', { id: ID, name: yourName });
    yourID = ID;
  });
  socket.on('users', users => {
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
}

if (yourName == '' || yourName == undefined || yourName == null) {
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