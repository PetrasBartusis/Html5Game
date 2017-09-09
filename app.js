var express = require('express');
var app = express();
var serv = require('http').Server(app);
app.get('/', function(req, res){
	res.sendFile(__dirname + '/client/index.html')
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started");

var SOCKET_LIST = {};

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 0;
	socket.number = "" + Math.floor(10 * Math.random());
	SOCKET_LIST[socket.id] = socket;

	socket.on('disconnect', function(){
		delete SOCKET_LIST[socket.id];
	});
	
});

setInterval(function(){
	//create package to hold info about all players
	var pack = [];
	//go through every user(player) in a loop
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.x++;
		socket.y++;
		//have a packet for each user
		pack.push({
			x:socket.x,
			y:socket.y,
			number:socket.number
		});
	}
	//send all users new position
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack);
	}
	
	
},1000/25); // fps = 25
