/*****
* DB Schemas and Models
*
* probably should have each class define its own schema and model but.. eh. would screw up frontend compatibility
*/
var mongoose = require('mongoose');
var CONFIG = require('../../cnf/Config');
var fs = require('fs');
var Item = require('../../client/Item');

function Models() {
	
	this.equipSchema = new mongoose.Schema({
		type 		: String,
		name 		: String,
		slot 		: String,
		x 			: Number,
		y 			: Number,
		weight 		: Number,
		baseValue 	: Number,
		meta 		: {}
	});

	this.profileSchema = new mongoose.Schema({
		username 	: String,
		name 		: String,
		health		: Number,
		vel 		: { x:Number, y:Number },
		equip 		: [this.equipSchema],
		bag 		: [this.equipSchema],
		speed		: Number,
		modifiers 	: [],
		id_world 	: String,
		x 			: Number,
		y 			: Number
	});


	this.playerSchema = new mongoose.Schema({
		username	: String,
		pwdE 		: String,
		id_world 	: String, //current world
		x 			: Number,
		y 			: Number,
		kills		: Number,
		attack		: Number,
		attack_range : Number,
		facing      : String,
		homeworld   : String, //id of home world,
		home_pos	: [Number], //2d coordinates to warp to home
		dt_create 	: {type:Date, default: Date.now },
		last_login 	: {type:Date, default: Date.now },
		characer_json : String, //full character profile
		profile 	: [this.profileSchema], //Mixed js object
		character_name : String
	});
	this.Player = mongoose.model('Player',this.playerSchema);

	this.npcSchema = new mongoose.Schema({
		json 		: String,
		type 		: String,
		x 			: Number,
		y 			: Number,
		name 		: String
	});

	
	this.worldSchema = mongoose.Schema({
		is_primary   : Boolean, //if is the primary home world for given player
		id_player 	: String, //optional if player owned world
		dt_create 	: {type: Date, default: Date.now },
		npcs 		: [ this.npcSchema ],
		portals     : [ { json: String, name: String, is_explored:Boolean, x: Number, y: Number, id_world: String, remote_id: Number}],
		last_activity : {type: Date, default: Date.now },
		current_players: Number,
		mapItems    : [ this.equipSchema],
		width 		: Number,
		height 		: Number,
		name 		: String
	});
	this.World = mongoose.model('World',this.worldSchema);
	
};

//update db reference with Player stats and save
Models.prototype.savePlayer = function( player, cb ) {
	player._model.username = player._username;
	player._model.pwdE = player._password;
	player._model.id_world = player._world;
	player._model.homeworld = player._homeworld;
	player._model.home_pos = player._home_pos;
	player._model.x = player._pos[0];
	player._model.y = player._pos[1];
	player._model.kills = player._kills;
	player._model.attack = player._attack;
	player._model.attack_range = player._attack_range;
	player._model.facing = player._facing ;
	player._model.last_login = Date.now();
	var profile = player.getProfile();
	player._model.character_json = JSON.stringify(profile);
	player._model.character_name = player._username;
	var p = null;
	if(!player._model.profile || player._model.profile.length < 1 ) {
		console.log("Missing user profile"); console.log(player._model.profile);
		p = mongoose.model('Profile',this.profileSchema);
	} else {
		p = player._model.profile[0];
	}
	p.username = player._username;
	p.name = player._username;
	p.health = player._health;
	p.vel = { x: player._vel[0], y: player._vel[1] };
	p.equip = []; //TODO:: load equipment
	for(var i=0;i<player._equip.length;i++){
		p.equip.push({
			type: player._equip[i]._type,
			x: player._equip[i]._x,
			y: player._equip[i]._y,
			weight: player._equip[i]._weight,
			slot: player._equip[i]._slot,
			baseValue: player._equip[i]._baseValue,
			name: player._equip[i]._name,
			meta: player._equip[i]._meta
		})
	}
	p.bag = [];
	for(var i=0;i<player._bag.length;i++){
		p.bag.push({
			type: player._bag[i]._type,
			x: player._bag[i]._x,
			y: player._bag[i]._y,
			weight: player._bag[i]._weight,
			slot: player._bag[i]._slot,
			baseValue: player._bag[i]._baseValue,
			name: player._bag[i]._name,
			meta: player._bag[i]._meta
		})
	}
	p.speed = 1; //TODO:: have speed set in Player
	p.modifiers = []; //TODO: load modifiers
	p.id_world = (typeof(player._world)=="string") ? player._world : player._model.id_world;
	p.x = player._pos[0];
	p.y = player._pos[1];



	player._model.profile = [p];
	player._model.save(function(err, pl){
		if(err) {
			console.log("Unable to save player: "+player._username+": "+err.message);
		} else {
			console.log("Player "+pl.username+" saved");
			if(cb){ cb(pl); }
		}
		
	});

};
//update Player object with db values
Models.prototype.loadPlayer = function( player, pModel, cb ) {
	player._username = pModel.username;
	player._pos = [ pModel.x, pModel.y ];
	var pro = pModel.profile[0];
	player._health = pro.health;
	player._vel = [0,0];
	player._zone = pModel.id_world;
	player._created = pModel.dt_create;
	player._homeworld = pModel.homeworld;
	player._home_pos = pModel.home_pos;
	player._world = pModel.id_world;
	player._model = pModel;
	player._attack = pModel.attack;
	player._attack_range = pModel.attack_range;
	player._facing = pModel.facing;
	player._bag = [];
	player._kills = pModel.kills;
	player._equip = [];
	var i=0; var item=null;
	if(!pModel.bag) pModel.bag = [];
	for( i=0;i<pModel.bag.length;i++){
		item = new Item(pModel.bag[i].type, pModel.bag[i].x, pModel.bag[y]);
		item._name = pModel.bag[i].name;
		item._properties = pModel.bag[i].meta;
		item._weight = pModel.bag[i].weight;
		item._slot = pModel.bag[i].slot;
		item._baseValue = pModel.bag[i].baseValue;
		player._bag.push(item);
	}
	if(!pModel.equip) pModel.equip = [];
	for( i=0;i<pModel.equip.length;i++){
		item = new Item(pModel.equip[i].type, pModel.equip[i].x, pModel.equip[y]);
		item._name = pModel.equip[i].name;
		item._properties = pModel.equip[i].meta;
		item._weight = pModel.equip[i].weight;
		item._slot = pModel.equip[i].slot;
		item._aseValue = pModel.equip[i].baseValue;
		player._equip.push(item);
	}

	if(cb) cb(player);
};


Models.prototype.saveWorld = function( world, cb ) {
	var npcs = [];
	for (var i=0;i<world._npcs.length;i++ ) {
		if(!world._npcs[i]){
			world._model.npcs.push({json:null,type:null,x:null,y:null,name:null} );
			continue;
		}
		npcs.push({ 
			json 	: JSON.stringify(world._npcs[i]),
			type 	: world._npcs[i]._type,
			x		: world._npcs[i]._x,
			y 		: world._npcs[i]._y,
			name 	: world._npcs[i]._name
		 });
	}
	world._model.npcs = npcs;
	//portals     : [ { json: String, name: String, x: Number, y: Number, id_world: String, remote_portal: Number}],
	var portals = [];
	for( i=0;i<world._portals.length;i++) {
		portals.push({
			json : JSON.stringify(world._portals[i]),
			name : world._portals[i]._name,
			x : world._portals[i]._x,
			y : world._portals[i]._y,
			is_explored : (world._portals[i]._properties.is_explored?world._portals[i]._properties.is_explored:null),
			id_world : (world._portals[i]._properties.id_world?world._portals[i]._properties.id_world:null),
			remote_portal : (world._portals[i]._properties.remote_id?world._portals[i]._properties.remote_id:null)
		});
	}
	world._model.portals = portals;
	world._model.name = world._name;
	world._model.last_activity = Date.now();
	//world._model.mapData = JSON.stringify(world._mapData);
	world._model.width = world._width;
	world._model.height = world._height;
	world._model.mapData = "";
	world._model.map = "";
	world._model.current_players = world._current_players;
	world._model.save(function(err,w){
		if(err){
			console.log("Unable to save world model: "+err.message);
			if(cb) cb(err, w);
			return;
		}
		var world_id = world._model._id;
		var world_path = CONFIG.MAP_FILES+'/'+world_id+".map";
		//TODO:: save mapObject and items in the file as well 
		fs.writeFile(world_path, JSON.stringify(world._mapData), function(err){
			if(err){
				console.log("Unable to write map file! "+err.message);
				if(cb) cb(err, world);
			} else {
				console.log("Wrote to map file");
				if(cb) cb(null, world);
			}
		});
	});
	
};

//load world data from file and return to send it to player
Models.prototype.loadWorld = function( player, wModel, world, cb) {
	console.log("Called loadWorld for "+wModel._id);
	world._model = wModel;
	world._name = wModel.name;
	world._id_player = wModel.id_player;
	world._height = wModel.height;
	world._width = wModel.width;
	world._is_primary = wModel.is_primary;
	world._npcs = []; 
	world.occupiedTiles = {};
	world._players = {};
	for(var i =0;i<wModel.npcs.length;i++) {
		if(!wModel.npcs[i].json) {
			world._npcs.push(null);
			continue;
		}
		var npc = JSON.parse(wModel.npcs[i].json);
		world._npcs.push(npc);
		world.occupiedTiles[npc._x+','+npc._y] = ['npc', world._npcs.length-1];
	}
	world._portals = []; 
	for(i =0;i<wModel.portals.length;i++) {
		var portal = JSON.parse(wModel.portals[i].json);
		world._portals.push(portal);
		world.occupiedTiles[portal._x+','+portal._y] = ['portal', world._portals.length-1];
	}
	world._current_players = 1;
	world._player_list = {};
	world._items = []; //TODO:: load map items
	var world_path = CONFIG.MAP_FILES+'/'+wModel._id+".map";
	fs.readFile(world_path, {}, function(err, data){
		if(err){
			console.log("Problem reading map file "+world_path+": "+err.message);
			if(cb) cb(err, world);
			return;
		}
		world._mapData = JSON.parse(data);
		if(cb) cb(null, world);
	});
};

if(typeof(module)!=="undefined") module.exports = Models;