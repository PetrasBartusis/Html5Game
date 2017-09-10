
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);

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
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y-pt.y,2));
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
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.hp = 10;
	self.hpMax = 10;
	self.score = 0;
	
	var super_update = self.update;
	//update speed and use parent update method
	self.update = function(){
		self.updateSpeed();
		super_update();
		if(self.pressingAttack){
			self.shootBullet(self.mouseAngle);
		}
	}
	
	//method for the player to shoot the bullet
	self.shootBullet = function(angle){
		var b = Bullet(self.id, angle);
		b.x = self.x;
		b.y = self.y;
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
	//create an init package for player
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			hp:self.hp,
			hpMax:self.hpMax,
			score:self.score,
		};
	}
	//create an update package for player
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			hp:self.hp,
			score:self.score,
		};
	}
	
	//add player to the list
	Player.list[id] = self;
	initPack.player.push(self.getInitPack());
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
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	
	
	
	socket.emit('init', {
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	});
}
Player.getAllInitPack = function(){
	//put every player in a package
	var players = [];
	for(var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	//create package to hold info about all players
	var pack = [];
	//go through every user(player) in a loop
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		//have a packet for each user
		pack.push(player.getUpdatePack());
	}
	return pack;
}
//Bullet class
var Bullet = function(parent, angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++>100)
			self.toRemove = true;
		super_update();
		
		for(var i in Player.list){
			var p = Player.list[i];
			//check if bullet is not at the player (shot the player)
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				p.hp -= 1;
				//self.parent is the parent id, so we need to get it
				var shooter = Player.list[self.parent];
				
				if(p.hp <= 0){
					if(shooter){
						shooter.score += 1;
					}
					p.hp = p.hpMax;
					p.x = Math.random()*500;
					p.y = Math.random()*500;
				}
				
				self.toRemove = true;
			}
		}
	}
	//create an init package for bullet
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}
	//create an update package for bullet
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}
	
	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}
Bullet.list = {};
Bullet.update = function(){
	var pack = [];
	//go through every user(bullet) in a loop
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		//if bullet should be removed, remove it
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else { //have a packet for each bullet
			pack.push(bullet.getUpdatePack());
		}
	}
	return pack;
}
Bullet.getAllInitPack = function(){
	//put every bullet in a package
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}
 
//set debug to false for release versions
var DEBUG = true;

var USERS = {
	//username:password
	"bob":"asd",
	"bob2":"bob",
	"bob3":"ttt",
}
//check if the user should be logged in
var isValidPassword = function(data, callback){
	db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0){
			callback(true);
		} else {
			callback(false);
		}
	});
}
//check username is taken
var isUsernameTaken = function(data, callback){
	db.account.find({username:data.username},function(err,res){
		if(res.length > 0){
			callback(true);
		} else {
			callback(false);
		}
	});
}
//adds user to the users map
var addUser = function(data, callback){
	db.account.insert({username:data.username,password:data.password},function(err){
		callback();
	});
}

//create a socket connection
var io = require('socket.io')(serv,{});
//set the socket to listen to the client connection
io.sockets.on('connection', function(socket){
	//when a user connects, we hive him an id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	//listen to the user trying to sign in
	socket.on('signIn', function(data){
		isValidPassword(data, function(res) {//set the method to have the callback
			if(res){
				Player.onConnect(socket);
				socket.emit('signInResponse', {success:true});
			} else {
				socket.emit('signInResponse', {success:false});
			}
		});
	});
	//listen to the user trying to sign up
	socket.on('signUp', function(data){
		isUsernameTaken(data, function(res){
			if(res){
				socket.emit('signUpResponse', {success:false});
			} else {
				addUser(data, function(){
					socket.emit('signUpResponse', {success:true});
				});
			}
		});
		
	});
	
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

var initPack = {player:[], bullet:[]};
var removePack = {player:[], bullet:[]};

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}
	
	//send all users new position
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack)
	}
	
	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];
	
},1000/25); // fps = 25
