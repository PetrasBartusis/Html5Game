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

var Entity = function(){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	//function to update objects position
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	return self;
}
//Player class
var Player = function(id){
	//Player object value fields
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10;
	
	var super_update = self.update;
	//update speed and use parent update method
	self.update = function(){
		self.updateSpeed();
		super_update();
	}
	
	//method for updating player speed by keyPresses
	self.updateSpeed = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else 
			self.spdX = 0;
		
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
	}
	//add playter to the list
	Player.list[id] = self;
	return self;
}
Player.list = {};
Player.onConnect = function(socket){
	//we need to create a player and give him an id
	var player = Player(socket.id);
	//set player state to moving
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
}
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
}
Player.update = function(){
	//create package to hold info about all players
	var pack = [];
	//go through every user(player) in a loop
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		//have a packet for each user
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
	}
	return pack;
}
//Bullet class
var Bullet = function(angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
	
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++>100)
			self.toRemove = true;
		super_update();
	}
	Bullet.list[self.id] = self;
	return self;
}
Bullet.list = {};
Bullet.update = function(){
	if(Math.random()<0.1){
		Bullet(Math.random()*360);
	}
	
	var pack = [];
	//go through every user(bullet) in a loop
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		//have a packet for each bullet
		pack.push({
			x:bullet.x,
			y:bullet.y,
		});
	}
	return pack;
}

//set debug to false for release versions
var DEBUG = true;

//create a socket connection
var io = require('socket.io')(serv,{});
//set the socket to listen to the client connection
io.sockets.on('connection', function(socket){
	//when a user connects, we hive him an id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	Player.onConnect(socket);
	
	//listen to the user disconnect and delete socket and player
	socket.on('disconnect', function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	
	//listen to the user text messages
	socket.on('sendMsgToServer', function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
		}
	});
	
	socket.on('evalServer', function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer', res);
	});
});

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}
	
	//send all users new position
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions', pack);
	}
	
},1000/25); // fps = 25
