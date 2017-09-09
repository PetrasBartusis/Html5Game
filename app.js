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
var PLAYER_LIST = {};

var Player = function(id){
	//Player objet value fields
	var self = {
		x:250,
		y:250,
		id:id,
		number:"" + Math.floor(10 * Math.random()),
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		maxSpd:10,
	}
	//method for updating player position
	self.updatePosition = function(){
		if(self.pressingRight)
			self.x += self.maxSpd;
		if(self.pressingLeft)
			self.x -= self.maxSpd;
		if(self.pressingUp)
			self.y -= self.maxSpd;
		if(self.pressingDown)
			self.y += self.maxSpd;
	}
	return self;
}
//create a socket connection
var io = require('socket.io')(serv,{});
//set the socket to listen to the client connection
io.sockets.on('connection', function(socket){
	//when a user connects, we hive him an id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	//we need to create a player and give him an id
	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;

	socket.on('disconnect', function(){
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});
	
	//set player state to start moving
	socket.on('keyPress', function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
	
});

setInterval(function(){
	//create package to hold info about all players
	var pack = [];
	//go through every user(player) in a loop
	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		player.updatePosition();
		//have a packet for each user
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
	}
	//send all users new position
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack);
	}
	
	
},1000/25); // fps = 25
