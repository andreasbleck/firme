const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {cookie: false, pingInterval: 1000});
const child_process = require("child_process");
const YTDlpWrap = require('yt-dlp-wrap').default;
YTDlpWrap.downloadFromGithub();
const ytDlpWrap = new YTDlpWrap();

app.use(express.static('www'));

app.get('/api/info', (req, res) => {
  ytDlpWrap.getVideoInfo(req.query.url).then(result => {
    res.json(result);
  })
})

function secondsToHms(d) {
    var ms = (""+d).split(".")[1] || "0";
    d = Number(d);
    if(isNaN(d)) {
      d = 0;
    }

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    return (h == 0 ? "" : ('0' + h).slice(-2) + ":") + ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2) + "." + ms.slice(0,2);
}

var connectedUsers = {};
var rooms = {};

io.on('connection', function(socket) {
  var address = socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
  var nome = "";
  var icon = "";
  var userdata = {};
  var state = "idle";
  var time = {"position": 0, "duration": 0};
  var room = "";
  var hidden = false;
  console.log(socket.id + ' - Nova conexão de ' + address);
  connectedUsers[socket.id] = {"nome": nome, "userdata": userdata, "state": state, "time": time};
  socket.emit('rooms', io.sockets.adapter.rooms);
  socket.on('disconnect', function() {
    delete connectedUsers[socket.id];
    console.log(socket.id + ' - Conexão fechada de ' + address);
    if(room != "") {
      socket.broadcast.to(room).emit('userleave', socket.id);
    }
    io.emit('rooms', io.sockets.adapter.rooms);
  });
  socket.on('nome', function(msg) {
    nome = msg;
    if(Object.keys(userdata).length != 0 && icon != "") {
      connectedUsers[socket.id] = {"nome": nome, "icon": icon, "userdata": userdata, "state": state, "time": time, hidden: false};
      if(room != "") {
        socket.broadcast.to(room).emit('newuser', socket.id, nome, icon, userdata, state, time);
      }
      console.log(socket.id + ' - Nome: ' + nome + ' (tela ' + userdata.screen + ' usando ' + userdata.browser + ' ' + userdata.browserVersion + ' no ' + userdata.os + ' ' + userdata.osVersion + ') (n)');
    }
  });
  socket.on('icon', function(msg) {
    icon = msg;
    if(Object.keys(userdata).length != 0 && nome != "") {
      connectedUsers[socket.id] = {"nome": nome, "icon": icon, "userdata": userdata, "state": state, "time": time, hidden: false};
      if(room != "") {
        socket.broadcast.to(room).emit('newuser', socket.id, nome, icon, userdata, state, time);
      }
      console.log(socket.id + ' - Nome: ' + nome + ' (tela ' + userdata.screen + ' usando ' + userdata.browser + ' ' + userdata.browserVersion + ' no ' + userdata.os + ' ' + userdata.osVersion + ') (i)');
    }
  });
  socket.on('userdata', function(msg) {
    userdata = msg;
    if(nome != "" && icon != "") {
      connectedUsers[socket.id] = {"nome": nome, "icon": icon, "userdata": userdata, "state": state, "time": time, hidden: false};
      if(room != "") {
        socket.broadcast.to(room).emit('newuser', socket.id, nome, icon, userdata, state, time);
      }
      console.log(socket.id + ' - Nome: ' + nome + ' (tela ' + userdata.screen + ' usando ' + userdata.browser + ' ' + userdata.browserVersion + ' no ' + userdata.os + ' ' + userdata.osVersion + ') (u)');
    }
  });
  socket.on('seek', function(msg, called) {
    connectedUsers[socket.id].time.position = msg;
    if(room != "") {
      rooms[room].time.position = msg;
      socket.broadcast.to(room).emit('seek', socket.id, msg, called);
      if(!called) {
        socket.broadcast.to(room).emit('message', nome + " mudou o tempo do vídeo pra " + secondsToHms(msg), icon, null, "gray");
      }
    }
    console.log(socket.id + ' - ' + nome + ': seek ' + msg);
  });
  socket.on('seeked', function() {
    if(room != "") {
      socket.broadcast.to(room).emit('seeked', socket.id);
    }
    console.log(socket.id + ' - ' + nome + ': seeked');
  });
  socket.on('stateChanged', function(msg, called) {
    state = msg;
    connectedUsers[socket.id].state = msg;
    if(room != "") {
      rooms[room].state = msg;
      socket.broadcast.to(room).emit('stateChanged', socket.id, msg, called);
      if(!called) {
        if(msg == "playing") {
          socket.broadcast.to(room).emit('message', nome + " deu play no vídeo.", icon, null, "gray");
        } else if(msg == "paused") {
          socket.broadcast.to(room).emit('message', nome + " pausou o vídeo.", icon, null, "gray");
        } else if(msg == "stalled") {
          socket.broadcast.to(room).emit('message', nome + " parou pra carregar.", icon, null, "gray");
        }
      }
    }
    console.log(socket.id + ' - ' + nome + ': new state ' + msg);
  });
  socket.on('sourceChanged', function(msg, label) {
    if(room != "") {
      socket.broadcast.to(room).emit('message', nome + " mudou a qualidade para " + label + ".", icon, null, "gray");
    }
  });
  socket.on('time', function(msg) {
    time = msg;
    connectedUsers[socket.id].time = msg;
    if(room != "") {
      rooms[room].time = msg;
      socket.broadcast.to(room).emit('time', socket.id, msg);
    }
    //console.log(socket.id + ' - ' + nome + ': time ' + msg.position + ' / ' + msg.duration);
  });
  socket.on('joinRoom', function(msg) {
    room = msg;
    if(!rooms[room]) {
        rooms[room] = {"link": ['mp4', './dummy.mp4', 'Firme'], "state": state, "time": time};
    } else {
        socket.emit('roomlink', rooms[room].link);
        socket.emit('seek', room, rooms[room].time.position);
        socket.emit('stateChanged', room, rooms[room].state);
    }
    socket.join(msg);
    var roomUsers = {};
    Object.keys(io.sockets.adapter.rooms[room].sockets).forEach(key => {
      if(socket.id != key) {
        roomUsers[key] = connectedUsers[key];
      }
    }); 
    socket.emit('connectedUsers', roomUsers);
    socket.broadcast.to(room).emit('newuser', socket.id, nome, icon, userdata, state, time);
    console.log(socket.id + ' - ' + nome + ': join room ' + msg);
    io.emit('rooms', io.sockets.adapter.rooms);
  });
  socket.on('setRoomLink', function(msg) {
    if(room != "") {
      rooms[room].link = msg;
      socket.broadcast.to(room).emit('roomlink', msg);
      socket.broadcast.to(room).emit('message', nome + " mudou o link da sala.", icon, null, "gray");
    }
  });
  socket.on('hidden', function(msg) {
    hidden = msg;
    connectedUsers[socket.id].hidden = msg;
    if(room != "") {
      if(msg) {
        socket.broadcast.to(room).emit('message', nome + " minimizou ou mudou de aba.", icon, null, "red");
      } else {
        socket.broadcast.to(room).emit('message', nome + " maximizou ou voltou pra aba.", icon, null, "lime");
      }
      socket.broadcast.to(room).emit('hidden', socket.id, msg);
    }
  });
  socket.on('chat', function(msg) {
    if(room != "") {
      socket.broadcast.to(room).emit('chat', socket.id, msg);
    }
    console.log(socket.id + ' - ' + nome + ': chat ' + msg);
  });
});

http.listen(process.env.PORT || 3002, function() {
  console.log('Servidor rodando na porta ' + ( process.env.PORT || 3002 ));
});
