var nome = "";
var icon = "";

var playerObj;
var playerConfig;
var socket = {};
var latency = 0;

var state = "idle";
var time = {"position": 0, "duration": 0};
var nameSent = false;
var playerReady = false;
var userdataSent = false;
var curRoom = "";
var called = {'stateChanged': false, 'seek': false};
var lastSeek = -1;
var lastTime = 0;
var rooms = {};
var volume = 100;
var extaudio = false;
var audiotime = {"currentTime": 0, "msec": 0};
var curSource = 0;

if(storageAvailable('localStorage')) {
    var v = localStorage.getItem('volume');
    if(v != null) {
        volume = parseInt(v);
    } else {
        localStorage.setItem('volume', volume);
    }
    var n = localStorage.getItem('nome');
    if(n != null && n != "") {
        nome = n;
    }
    var i = localStorage.getItem('icon');
    if(i != null && i != "") {
        icon = i;
    }
}

$(document).ready(function() {
    configPlayer();
    initPlayer();
    $(".nano").nanoScroller({});
    $("#chat-text").inputhistory();
    new MeteorEmoji();
    $("#chat-text").parent().children("a").css("top", "6px");
    $("#chat-text").parent().children("a").css("right", "8px");
    if(nome != null && nome != "" && icon != null && icon != "") {
        $("#nome").text(nome);
        $("#icon").attr("src", icon);
        $("#overlayheader").html('Logado como: <img src="' + icon + '" width="20" height="20"> ' + nome + ' <button class="button button-small" type="button" onclick="trocarConta();">Trocar conta</button>');
        initSockets();
    } else {
        carregarContaTS();
    }
});

function trocarConta() {
    $("#overlayheader").text("");
    $("#overlaytitle").text("");
    $("#overlaycontent").text("Carregando...");
    nome = "";
    icon = "";
    localStorage.setItem('nome', nome);
    localStorage.setItem('icon', icon);
    socket.disconnect();
    socket.destroy();
    carregarContaTS();
}

function carregarContaTS() {
    $("#overlaytitle").text("Digite seu nome para entrar:");
    $("#overlaycontent").html('<div class="input-group center" style="max-width: 500px;"><div class="input-group-prepend"><span class="input-group-text">Nome:</span></div><input class="form-control" id="nomeuser" type="text" placeholder="Digite aqui..."><div class="input-group-append"><button class="btn btn-outline-secondary" type="button" onclick="setNome($(\'#nomeuser\').val(), \'./static/steamdefault.jpg\');">Entrar</button></div></div>');
    /*
    $.ajax({
        type: "GET",
        url: "https://teste.ultimatez.xyz:8443/ts3name.php",
        data: "",
        success: function(result, status, jqxhr) {
            if(result == "") {
                $("#overlaytitle").text("Digite seu nome para entrar:");
                $("#overlaycontent").html('<div class="input-group center" style="max-width: 500px;"><div class="input-group-prepend"><span class="input-group-text">Nome:</span></div><input class="form-control" id="nomeuser" type="text" placeholder="Digite aqui..."><div class="input-group-append"><button class="btn btn-outline-secondary" type="button" onclick="setNome($(\'#nomeuser\').val(), \'./static/steamdefault.jpg\');">Entrar</button></div></div>');
            } else {
                var arr = result.split('\n');
                var users = [];
                var userselect = "";
                $.each(arr, function(key, value) {
                    var userid = (key - (key % 4)) / 4;
                    switch(key % 4) {
                        case 0:
                            if(value != "") {
                                users[userid] = {};
                                users[userid].nome = value;
                            }
                            break;
                        case 1:
                            users[userid].mime = value;
                            break;
                        case 2:
                            users[userid].image = value;
                            break;
                    }
                });
                $.each(users, function(key, value) {
                    var image = "";
                    if(value.image == "") {
                        image = './static/steamdefault.jpg';
                    } else {
                        image = 'data:' + value.mime + ';base64,' + value.image;
                    }
                    userselect += '<div class="center inline-block p-2"><div class="p-2"><button class="button" type="button" onclick="setNome(\'' + value.nome + '\', getIcon(this));"><img class="outline userimage" src="' + image + '"><br>' + value.nome + '</button></div></div>';
                });
                $("#overlaytitle").text("Quem está assistindo?");
                $("#overlaycontent").html(userselect);
            }
        }
    });
    */
}

function voltarListaSalas() {
    socket.disconnect();
    socket.destroy();
    playerObj.remove();
    playerReady = false;
    curSource = 0;
    curRoom = "";
    configPlayer();
    initPlayer();
    initSockets();
    $(".overlay").show();
}

function setNome(n, e) {
    nome = n;
    icon = e;
    localStorage.setItem('nome', nome);
    localStorage.setItem('icon', icon);
    $("#nome").text(nome);
    $("#icon").attr("src", icon);
    $("#overlayheader").html('Logado como: <img src="' + icon + '" width="20" height="20"> ' + nome + ' <button class="button button-small" type="button" onclick="trocarConta();">Trocar conta</button>');
    initSockets();
}

function getIcon(e) {
    return imageToDataUri($(e).parent().find("img")[0], 20, 20);
}

function criarSala() {
    $("#overlaytitle").text("Criar sala:");
    $("#overlaycontent").html('<div class="input-group center" style="max-width: 500px;"><div class="input-group-prepend"><span class="input-group-text">Nome da sala:</span></div><input class="form-control" id="nomesala" type="text" placeholder="Digite aqui..."><div class="input-group-append"><button class="btn btn-outline-secondary" type="button" onclick="sendCriarSala();">Criar</button></div></div>');
}

function sendCriarSala() {
    entrarSala($('#nomesala').val());
}

function entrarSala(sala) {
    if(sala != "") {
        curRoom = sala;
        socket.emit('joinRoom', sala);
        $("#roomname").text(curRoom);
        $("#roomusers").text($("#syncdata div").length+1);
        $(".overlay").hide();
    }
}

function entrarSalaId(salaid) {
    entrarSala(rooms[salaid]);
}

function setLink(link, bypass = false) {
    //console.log("setLink link = " + link + " bypass = " + bypass)
    if(link != "") {
        $.ajax({
            type: "GET",
            url: (bypass?link:"./api/info?url="+link),
            data: "",
            success: function(result,status,jqxhr){
                //console.log(result);
                var arr = {};
                if(!bypass) {
                    arr = result;
                } else {
                    arr.title = link
                }
                //console.log(arr);
                if(arr.title != null) {
                    $("#videoname").text(arr.title);
                } else {
                    $("#videoname").text("");
                }
                var sources = [];
                var audios = [];
                var videos = [];
                var image = "";
                $.each(arr.formats, function(key, value) {
                    if(value.acodec != 'none' && value.vcodec != 'none') {
                        var url = value.url;
                        var type = value.ext;
                        if(value.protocol == "m3u8_native") {
                            type = "hls";
                        }
                        if(value.protocol == "http_dash_segments") {
                            type = "dash";
                        }
                        var label = value.format;
                        if(arr.extractor.startsWith("youtube")) {
                            label = getYoutubeLabel(value);
                            image = arr.thumbnail;
                        }
                        if(arr.extractor == "facebook") {
                            label = getFacebookLabel(value);
                        }
                        sources.push({
                            file: url,
                            type: type,
                            label: label
                        });
                    }
                    if(value.acodec != 'none' && value.vcodec == 'none') {
                        var type = value.ext;
                        if(value.ext == "m4a") {
                            type = "mp4";
                        }
                        audios.push({
                            url: value.url,
                            ext: type
                        });
                    }
                });
                audios = audios.reverse();
                $("#syncaudio").empty();
                var audio = $('<audio preload="auto">');
                $("#syncaudio").append(audio);
                audio.bind('timeupdate', function() {
                    audiotime.msec = window.performance.now();
                    audiotime.currentTime = audio[0].currentTime;
                });
                $.each(audios, function(key, value) {
                    audio.append($('<source src="' + value.url + '" type="audio/' + value.ext + '">'));
                });
                sources = sources.reverse();
                $.each(arr.formats, function(key, value) {
                    if(value.acodec == 'none' && value.vcodec != 'none') {
                        var url = value.url;
                        var type = value.ext;
                        if(value.protocol == "m3u8_native") {
                            type = "hls";
                        }
                        if(value.protocol == "http_dash_segments") {
                            type = "dash";
                        }
                        var label = value.format;
                        if(arr.extractor.startsWith("youtube")) {
                            if(webm && value.ext != "webm") {
                                return;
                            }
                            if(!webm && value.ext == "webm") {
                                return;
                            }
                            if(value.format_note == "DASH video") {
                                return;
                            }
                            label = getYoutubeLabel(value);
                        }
                        if(arr.extractor == "facebook") {
                            label = getFacebookLabel(value);
                        }
                        videos.push({
                            file: url,
                            type: type,
                            label: label + ""
                        });
                    }
                });
                if(!bypass) {
                    if(arr.extractor.startsWith("youtube")) {
                        sources = videos.reverse().concat(sources);
                    } else {
                        sources = sources.concat(videos.reverse());
                    }
                } else {
                    videos.push({
                        file: link,
                        type: "http",
                        label: link
                    });
                    sources = videos;
                }
                socket.emit('setRoomLink', {sources: sources, title: arr.title, audios: audios});
                chatMessage(nome + " mudou o link da sala.", icon, null, "gray");
                playerObj.remove();
                playerReady = false;
                curSource = 0;
                configPlayer(sources, arr.title, image);
                initPlayer();
                if(sources[0].label.endsWith('')) {
                    extaudio = true;
                } else {
                    extaudio = false;
                }
            },
            error: function(jqxhr,status,error){
                chatMessage(jqxhr.responseJSON.error);
            }
        });
    }
}

function getYoutubeLabel(value) {
    var label;
    label = value.format_note;
    var _hdr = "";
    if(value.format_note.endsWith(" HDR")) {
        if(!hdr) {
            return;
        }
        _hdr = " HDR"
        label = label.replace(" HDR", "")
    }
    if(value.fps != 60 && value.fps != null) {
        label += value.fps
    }
    label += _hdr;
    return label;
}

function getFacebookLabel(value) {
    var label;
    if(value.format == "dash_hd_src - unknown") {
        label = "HD (Source)"
    } else if(value.format == "dash_sd_src_no_ratelimit - unknown") {
        label = "SD-NoRateLimit";
    } else if(value.format == "dash_sd_src - unknown") {
        label = "SD";
    } else {
        label = value.height + "p";
        if(value.fps != null) {
            label += value.fps;
        }
    }
    return label;
}

function chatMessage(message, msgicon, msgnome, msgcolor) {
    var msgdiv = $("<div class='chat-message'>");
    $(".chat-messages").append(msgdiv.text(message));
    var formattedmessage = "";
    if(msgicon != null) {
        formattedmessage += '<img class="usericon" src="' + msgicon + '"> ';
    }
    if(msgnome != null) {
        //formattedmessage += '<span class="username" style="color: ' + getRandomColor().next().value + '">' + msgnome + '</span>: ';
        formattedmessage += '<span class="username">' + msgnome + '</span>: ';
    }
    formattedmessage += anchorme( { input: msgdiv.html(), options: { attributes: { target: "_blank" } } } );
    msgdiv.html(formattedmessage);
    if(msgcolor != null) {
        msgdiv.css("color", msgcolor);
    }
    $(".nano-chat").nanoScroller({});
    $(".nano-chat").nanoScroller({ scroll: 'bottom' });
}

function sendChat() {
    var message = $("#chat-text").val();
    if(message.slice(0, 1) == "/") {
        var words = message.split(" ");
        if(words[0] == "/link") {
            if(typeof words[1] == 'undefined' || words[1].length < 1) {
                chatMessage("Faltou colocar o link depois do comando.");
                $("#chat-text").val("");
            } else {
                setLink(encodeURIComponent(message.slice(6)));
                $("#chat-text").val("");
            }
        } else if(words[0] == "/youtube") {
            if(typeof words[1] == 'undefined' || words[1].length < 1) {
                chatMessage("Digite um texto para pesquisar.");
                $("#chat-text").val("");
            } else {
                setLink('ytsearch:' + encodeURIComponent(message.slice(9)));
                $("#chat-text").val("");
            }
        } else if(words[0] == "/volume") {
            if(typeof words[1] == 'undefined' || words[1].length < 1 || !$.isNumeric(words[1]) || words[1] < 0 || words[1] > 100) {
                chatMessage("Digite um número entre 0 e 100.");
                $("#chat-text").val("");
            } else {
                playerObj.setVolume(words[1]);
                $("#chat-text").val("");
                return false;
            }
        } else {
            chatMessage("Comando inválido.");
            $("#chat-text").val("");
        }
    }
    if(message != "") {
        socket.emit('chat', message);
        chatMessage(message, icon, nome);
        $("#chat-text").val("");
    }
    return false;
}

function setOffset(id, position, time) {
    var useroffset = $("#useroffset-" + id);
    var timeoffset = toFixed(toFixed(time, 2) - toFixed(position, 2), 2);
    if(timeoffset == 0) {
        useroffset.text("+0.00");
    } else if(timeoffset > 0) {
        useroffset.text("+" + toFixed(timeoffset + 0.001, 2));
    } else {
        useroffset.text(toFixed(timeoffset + 0.001, 2));
    }
    if(timeoffset > 1) {
        useroffset.css("color", "lime");
    } else if(timeoffset < -1) {
        useroffset.css("color", "red");
    } else {
        useroffset.css("color", "");  
    }
}

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

function configPlayer(sources, title, image) {
    if(sources == null) {
        sources = [
            {
                file: "./static/dummy.mp4",
                type: "mp4",
                label: "Firme"
            }
        ];
    }
    playerConfig = {
        title: title,
        sources: sources,
        image: image,
        //legacyUI: true,
        volume: volume
    };
    
    /*if(legenda != "") {
        playerConfig.tracks = [
            {
                kind : "captions",
                file : legenda,
                label : "Legenda"
            }
        ];
    }*/
}

function initPlayer() {
    //OvenPlayer.debug(true);
    playerObj = OvenPlayer.create("player", playerConfig);
    
    playerObj.on('ready', function(data){
        //console.log("playerReady");
        playerReady = true;
        var userdata = playerObj.getBrowser();
        $("#userdata").html('<span id="userinfo" data-placement="top" title="tela ' + userdata.screen + ' usando ' + userdata.browser + ' ' + userdata.browserVersion + ' no ' + userdata.os + ' ' + userdata.osVersion + '"><img class="usericon" id="icon" src="' + icon + '"> <span id=nome>...</span></span> - <span id="curstate">...</span> - <span id="curtime">...</span>');
        $('#userinfo').tooltip();
        if(socket.connected) {
            if(!userdataSent) {
              socket.emit('userdata', userdata, playerObj.getPosition(), playerObj.getDuration());
              userdataSent = true;
            }
        }
        if(nome != "") {
            $("#nome").text(nome);
        }
        if(icon != "") {
            $("#icon").attr("src", icon);
        }
        $("#curstate").text(playerObj.getState());
        $("#curtime").text(secondsToHms(playerObj.getPosition()) + " / " + secondsToHms(playerObj.getDuration()));
        playerObj.setVolume(100);
        playerObj.setVolume(volume);
    });
    
    playerObj.on('stateChanged', function(data){
        //console.log("stateChanged");
        state = data.newstate;
        $("#curstate").text(data.newstate);
        if(socket.connected) {
            socket.emit('stateChanged', data.newstate, called.stateChanged);
        }
        if(!called.stateChanged) {
            if(state == "playing") {
                chatMessage(nome + " deu play no vídeo.", icon, null, "gray");
            } else if(state == "paused") {
                chatMessage(nome + " pausou o vídeo.", icon, null, "gray");
            } else if(state == "stalled") {
                chatMessage(nome + " parou pra carregar.", icon, null, "gray");
            }
        }
        if(playerObj.getSources()[playerObj.getCurrentSource()].label.endsWith('')) {
            extaudio = true;
            if(state == "playing") {
                $("#syncaudio audio")[0].currentTime = time.position;
                $("#syncaudio audio")[0].play()
            } else {
                if(!document[hidden]) {
                    $("#syncaudio audio")[0].pause()
                }
            }
        } else {
            extaudio = false;
            if($("#syncaudio audio").length != 0) {
                $("#syncaudio audio")[0].pause()
            }
        }
        if((state == "playing" || state == "paused") && called.stateChanged) {
            called.stateChanged = false;
        }
    });
    
    playerObj.on('time', function(data){
        //console.log("time");
        var now = window.performance.now();
        if(lastTime != data.position) {
          var usersoffset = $("span[id^='useroffset-");
          $.each(usersoffset, function(key, value) {
            var id = $(value).attr("id").split(/-(.+)/)[1];
            setOffset(id, data.position, $("#time-" + id).data("curTime"));
          });
        }
        lastTime = data.position;
        if(extaudio) {
            var offset = Math.abs(audiotime.currentTime - ((audiotime.msec - now)/1000) - data.position);
            if(offset > 0.25) {
                $("#syncaudio audio")[0].currentTime = data.position;
                //console.log("audio resynced");
            }
            //console.log("audio: " + audiotime.currentTime + " video: " + data.position + " diff: " + (audiotime.currentTime - data.position));
            //console.log("offset: " + offset + " drift: " + ((audiotime.msec - now)/1000));
        }
        if(data.position != time.position || data.duration != time.duration) {
            if(socket.connected) {
                socket.emit('time', data);
            }
            time = data;
            $("#curtime").text(secondsToHms(data.position) + " / " + secondsToHms(data.duration));
        }
    });
    
    playerObj.on('sourceChanged', function(data){
        if(curSource !== data.currentSource) {
            curSource = data.currentSource;
            //console.log('sourceChanged');
            //console.log(data);
            var label = playerConfig.sources[data.currentSource].label;
            socket.emit("sourceChanged", data, label);
            chatMessage(nome + " mudou a qualidade para " + label + ".", icon, null, "gray");
            if(label.endsWith('')) {
                extaudio = true;
                $("#syncaudio audio")[0].volume = volume/100;
            } else {
                extaudio = false;
                if($("#syncaudio audio").length != 0) {
                    $("#syncaudio audio")[0].pause()
                }
            }
            playerObj.setVolume(volume);
        }
    });
    
    playerObj.on('bufferChanged', function(data){
        //console.log("bufferChanged");
        $("#curstate").text(playerObj.getState());
        if(!isNaN(data.bufferPercent)) {
            if(data.position != time.position || data.duration != time.duration) {
                time = data;
                $("#curtime").text(secondsToHms(data.position) + " / " + secondsToHms(data.duration));
                if(socket.connected) {
                    socket.emit('time', data);
                }
                //var videoProgress = data.position/data.duration*100;
                //var bufferTime = data.bufferPercent/100*data.duration; // not reliable when seeking
                //console.log('videoProgress: ' + videoProgress + ' - bufferPercent: ' + data.bufferPercent);
                //console.log('videoTime: ' + data.position + ' - bufferTime: ' + bufferTime);
            }
            //console.log('bufferChanged ' + data.position + ' / ' + data.duration + ' - buffer: ' + data.bufferPercent);
        }
    });
    
    playerObj.on('seek', function(data){
        //console.log("seek");
        if(lastSeek != data.position) {
            if(socket.connected) {
                socket.emit('seek', data.position, called.seek);
            }
            if(!called.seek) {
                chatMessage(nome + " mudou o tempo do vídeo pra " + secondsToHms(data.position), icon, null, "gray");
            }
            if(called.seek) {
                called.seek = false;
            }
        }
        if(playerObj.getState() == 'playing') {
            called.stateChanged = true;
        }
        lastSeek = data.position;
    });
    
    playerObj.on('seeked', function(){
        //console.log("seeked");
        if(socket.connected) {
            socket.emit('seeked');
        }
    });
    
    playerObj.on('volumeChanged', function(data){
        //console.log("volumeChanged");
        volume = data.volume;
        if(storageAvailable('localStorage')) {
            localStorage.setItem('volume', volume);
        }
        if(extaudio) {
            $("#syncaudio audio")[0].volume = volume/100;
            $("#syncaudio audio")[0].muted = data.mute;
        }
    });
    
    playerObj.on('playbackRateChanged', function(data){
        //console.log("playbackRateChanged");
        if(extaudio) {
            $("#syncaudio audio")[0].playbackRate = data.playbackRate;
        }
    });
}

function initSockets() {
    socket = io();
    
    socket.on('connect', function(){
      if(!nameSent) {
        if(nome != "") {
          socket.emit('nome', nome);
          socket.emit('icon', icon);
          nameSent = true;
          if(playerReady) {
            if(!userdataSent) {
              socket.emit('userdata', playerObj.getBrowser());
              userdataSent = true;
            }
            if(curRoom != "") {
              entrarSala(curRoom);
            }
          }
        }
      }
    });
    socket.on('disconnect', function(){
      connected = false;
      nameSent = false;
      userdataSent = false;
      timeSent = false;
      $("#syncdata").empty();
    });
    socket.on('rooms', function(msg){
      var roomcount = 0;
      var roomlist = '<table class="center"><tr><th>Nome da sala</th><th>Pessoas</th><th>Link</th></tr>';
      $.each(msg, function(key, value) {
        if(!value.sockets[key]) {
            rooms[roomcount] = key;
            roomlist += '<tr><td id="room-'+roomcount+'">'+$("<p>").text(key).html()+'</td><td>'+value.length+'</td><td><button class="button" type="button" onclick="entrarSalaId('+roomcount+');">Entrar</button></td></tr>';
            roomcount++;
        }
      });
      roomlist += "</table>";
      $("#overlaytitle").text("Lista de salas:");
      if(roomcount == 0) {
          roomlist = "<h4>Nenhuma sala criada.</h4>"
      }
      roomlist += '<br><br><div><button class="button" type="button" onclick="criarSala();">Criar sala</button></div>';
      $("#overlaycontent").html(roomlist);
    });
    socket.on('roomlink', function(msg){
      if(msg.title != null) {
        $("#videoname").text(msg.title);
      } else {
        $("#videoname").text("");
      }
      $("#syncaudio").empty();
      if(msg.audios != null) {
        var audio = $('<audio preload="auto">');
        $("#syncaudio").append(audio);
        audio.bind('timeupdate', function() {
            audiotime.msec = window.performance.now();
            audiotime.currentTime = audio[0].currentTime;
        });
        $.each(msg.audios, function(key, value) {
            audio.append($('<source src="' + value.url + '" type="audio/' + value.ext + '">'));
        });
      }
      playerObj.remove();
      playerReady = false;
      curSource = 0;
      configPlayer(msg.sources, msg.title);
      initPlayer();
      if(typeof msg.sources !== 'undefined' && msg.sources.length > 0 && msg.sources[0].label.endsWith('')) {
          extaudio = true;
      } else {
          extaudio = false;
      }
    });
    socket.on('time', function(id, msg){
      setOffset(id, lastTime, msg.position);
      $("#time-" + id).text(secondsToHms(msg.position));
      $("#time-" + id).data("curTime", msg.position);
    });
    socket.on('seek', function(id, msg, apicall){
      if(!apicall) {
        setOffset(id, lastTime, msg);
        called.seek = true;
        playerObj.seek(msg);
      }
    });
    socket.on('seeked', function(id){
    });
    socket.on('stateChanged', function(id, msg, apicall){
      if(!apicall) {
        if(msg == 'playing' && playerObj.getState() != 'playing') {
          called.stateChanged = true;
          playerObj.play();
        } else if((msg == 'paused' || msg == 'stalled') && playerObj.getState() == 'playing') {
          called.stateChanged = true;
          playerObj.pause();
        }
      }
      $("#state-" + id).text(msg);
    });
    socket.on('newuser', function(id, username, usericon, userdata, userstate, usertime){
      $("#syncdata").append('<div id="user-' + id + '"><span id="userinfo-' + id + '" data-placement="top" title="tela ' + userdata.screen + ' usando ' + userdata.browser + ' ' + userdata.browserVersion + ' no ' + userdata.os + ' ' + userdata.osVersion + '"><img class="usericon" id="icon-' + id + '" src="' + usericon + '"> <span id="nome-' + id + '">' + username + '</span></span> - <span id="state-' + id + '">' + userstate + '</span> - <span id="time-' + id + '">' + secondsToHms(usertime.position) + '</span> <span class="text-white">(<span id="useroffset-' + id + '">+0.00</span>)</span></div>');
      $("#time-" + id).data("curTime", usertime.position);
      $('#userinfo-' + id).tooltip();
      $("#roomusers").text($("#syncdata div").length+1);
      $(".nano-custom").nanoScroller({});
      chatMessage(username + ' entrou na sala.', usericon, null, "lime");
    });
    socket.on('userleave', function(msg){
      chatMessage($("#nome-"+msg).text() + ' saiu da sala.', $("#icon-"+msg).attr("src"), null, "red");
      $("#user-" + msg).remove();
      $("#roomusers").text($("#syncdata div").length+1);
      $(".nano-custom").nanoScroller({});
    });
    socket.on('connectedUsers', function(msg){
      $.each(msg, function(key, value){
        $("#syncdata").append('<div id="user-' + key + '"><span id="userinfo-' + key + '" data-placement="top" title="tela ' + value.userdata.screen + ' usando ' + value.userdata.browser + ' ' + value.userdata.browserVersion + ' no ' + value.userdata.os + ' ' + value.userdata.osVersion + '"><img class="usericon" id="icon-' + key + '" src="' + value.icon + '"> <span id="nome-' + key + '">' + value.nome + '</span></span> - <span id="state-' + key + '">' + value.state + '</span> - <span id="time-' + key + '">' + secondsToHms(value.time.position) + '</span> <span class="text-white">(<span id="useroffset-' + key + '">+0.00</span>)</span></div>');
        $("#time-" + key).data("curTime", value.time.position);
        $('#userinfo-' + key).tooltip();
        $("#roomusers").text($("#syncdata div").length+1);
        $(".nano-custom").nanoScroller({});
        $("#user-" + key).data("hidden", value.hidden);
        if(value.hidden) {
          $("#user-" + key).css("color", "red");
        } else {
          $("#user-" + key).css("color", "");
        }
      });
    });
    socket.on('hidden', function(id, msg){
      $("#user-" + id).data("hidden", msg);
      if(msg) {
        $("#user-" + id).css("color", "red");
      } else {
        $("#user-" + id).css("color", "");
      }
    });
    socket.on('chat', function(id, msg){
      chatMessage(msg, $("#icon-" + id).attr("src"), $("#nome-" + id).text());
    });
    socket.on('message', function(msg, msgicon, msgnome, msgcolor){
      chatMessage(msg, msgicon, msgnome, msgcolor);
    });
    socket.on('pong', function(ms) {
      latency = ms;
      $("#latency").text(ms + " ms");
    });
}

function storageAvailable(type) {
    var storage;
    try {
        storage = window[type];
        var x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            (storage && storage.length !== 0);
    }
}

function imageToDataUri(img, width, height) {

    // create an off-screen canvas
    var canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');

    // set its dimension to target size
    canvas.width = width;
    canvas.height = height;

    // draw source image into the off-screen canvas:
    ctx.drawImage(img, 0, 0, width, height);

    // encode image to data-uri with base64 version of compressed image
    return canvas.toDataURL();
}

function * getRandomColor() {
    var letters = '0123456789ABCDEF';
    while(true) {
      var color = '#';
      for (var i = 0; i < 6; i++ ) {
          color += letters[Math.floor(Math.random() * 16)];
      }
      yield color;
      
    }
}

function toFixed(num, fixed) {
    var re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
    return num.toString().match(re)[0];
}

var testEl = document.createElement( "video" ),
    mpeg4, h264, ogg, webm;
if ( testEl.canPlayType ) {
    // Check for MPEG-4 support
    mpeg4 = "" !== testEl.canPlayType( 'video/mp4; codecs="mp4v.20.8"' );

    // Check for h264 support
    h264 = "" !== ( testEl.canPlayType( 'video/mp4; codecs="avc1.42E01E"' )
        || testEl.canPlayType( 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' ) );

    // Check for Ogg support
    ogg = "" !== testEl.canPlayType( 'video/ogg; codecs="theora"' );

    // Check for Webm support
    webm = "" !== testEl.canPlayType( 'video/webm; codecs="vp8, vorbis"' );
}
var hdr;
if (screen.colorDepth >= 48 && window.matchMedia('(color-gamut: p3)').matches) {
    hdr = true;
} else {
    hdr = false;
}

var hidden, visibilityChange; 
if (typeof document.hidden !== "undefined") {  
  hidden = "hidden";
  visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
  hidden = "msHidden";
  visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
  hidden = "webkitHidden";
  visibilityChange = "webkitvisibilitychange";
}

function handleVisibilityChange() {
  socket.emit("hidden", document[hidden]);
  if(document[hidden]) {
    chatMessage(nome + " minimizou ou mudou de aba.", icon, null, "red");
  } else {
    chatMessage(nome + " maximizou ou voltou pra aba.", icon, null, "lime");
  }
}

if (typeof document.addEventListener === "undefined" || hidden === undefined) {
  console.log("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
} else {
  // Handle page visibility change   
  document.addEventListener(visibilityChange, handleVisibilityChange, false);
}