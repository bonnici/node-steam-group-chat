var sys = require('sys');
var fs = require('fs');
var events = require('events');
var steam = require('steam');
var winston = require('winston');
var _ = require('underscore');

var statuses = {
	Offline: 0,
	NotInChat: 1,
	InChatMuted: 2,
	InChatUnmuted: 3
};
exports.statuses = statuses;

var SteamChat = function(username, password, guardCode, groupId, client) {
	events.EventEmitter.call(this);

	this.groupId = groupId;
	this._updateStatus(statuses.Offline);
	this._muted = false; // Store mute state so it can be restored on login
	this._connected = false;

	this.client = client || new steam.SteamClient();

	this.connect(username, password, guardCode);

	var that = this;

	// Try to reconnect when disconnected
	setInterval(function() { that.connect(username, password, guardCode); }, 5*60*1000);

	this.client.on('loggedOn', function() { that._onLoggedOn.apply(that, arguments); });
	this.client.on('chatMsg', function() { that._onChatMessage.apply(that, arguments); });
	this.client.on('chatStateChange', function() { that._onChatStateChange.apply(that, arguments); });
	this.client.on('personaState', function() { that._onPersonaState.apply(that, arguments); });
	this.client.on('disconnected', function() { that._onDisconnected.apply(that, arguments); });
	
	this.client.on('error', function(error) { 
		winston.error("Caught steam error", error);
	});
};

sys.inherits(SteamChat, events.EventEmitter);

SteamChat.prototype.connect = function(username, password, guardCode) {
	if (!this._connected) {
		winston.info("Trying to connect chat bot " + username + " password " + password + " guardCode " + guardCode);
		try {
			this.client.logOn(username, password, guardCode);
		}
		catch (err) {
			winston.error("Exception trying to connect chat bot " + this._username, err);
		}
	}
}

SteamChat.prototype.sendProxyMessage = function(steamId, username, message) {
	if (steamId && username && message && this.status == statuses.InChatUnmuted) {
		this.client.sendMessage(this.groupId, username + ': ' + message);
	}
};

SteamChat.prototype.sendMessage = function(message) {
	if (this.status == statuses.InChatUnmuted || this.status == statuses.InChatMuted) {
		this.client.sendMessage(this.groupId, message);
	}
};

SteamChat.prototype.sendJoinedStatusMessage = function(steamId, username) {
	if (steamId && username && this.status == statuses.InChatUnmuted 
		&& !this.isUserInChat(steamId)) {

		this.client.sendMessage(this.groupId, '* ' + username + ' (' + steamId + ') joined from website *');
	}
};

SteamChat.prototype.sendLeftStatusMessage = function(steamId, username) {
	if (steamId && username && this.status == statuses.InChatUnmuted 
		&& !this.isUserInChat(steamId)) {

		this.client.sendMessage(this.groupId, '* ' + username + ' (' + steamId + ') left website *');
	}
};

SteamChat.prototype.getChatMembers = function(includeUser, excludeUser) {
	var data = {};

	var client = this.client;

	if (includeUser && includeUser in client.users) {
		data[includeUser] = client.users[includeUser]
	}

	_.each(this.client.chatRooms[this.groupId], function(value, key) {
		if (key in client.users && key != excludeUser) {
			data[key] = client.users[key];
		}
	});

	return data;
};

SteamChat.prototype.isUserInChat = function(steamId) {
	return this.client.chatRooms[this.groupId] && this.client.chatRooms[this.groupId][steamId];
}

SteamChat.prototype.isUserInChatAsMember = function(steamId) {
	if (this.isUserInChat(steamId)) {
		var rank = this.client.chatRooms[this.groupId][steamId].rank;
		var okPermissions = steam.EClanPermission.Owner | steam.EClanPermission.Officer | 
			steam.EClanPermission.Member | steam.EClanPermission.Moderator;
		return (rank & okPermissions) > 0;
	}
	return false;
};

SteamChat.prototype.joinChat = function(callback, maxWait) {
	if (this.status != statuses.NotInChat) {
		return callback(null, "Already in chat or offline");
	}
	// Check to see if we are in chat but the wrong status is set
	if (this._proxyUserIsInChat()) {
		this._updateStatus(this._muted ? statuses.InChatMuted : statuses.InChatUnmuted);
		return callback(null, "Already in chat but status was wrong");
	}

	// Otherwise attempt join and callback when we've joined
	this.client.joinChat(this.groupId);

	var timeWaited = 0;
	var intervalTime = 100;
	maxWait = maxWait || 5000;
	callback = callback || function() {};
	var that = this;
	var waitInterval = setInterval(function() {
		if (timeWaited > maxWait) {
			clearInterval(waitInterval);
			return callback("Chat was not joined after " + maxWait + " ms", null);
		}
		if (that._proxyUserIsInChat()) {
			clearInterval(waitInterval);
			that._updateStatus(that._muted ? statuses.InChatMuted : statuses.InChatUnmuted);
			return callback(null, "Successfully joined chat");
		}
		timeWaited += intervalTime;
	}, intervalTime);
};

SteamChat.prototype.leaveChat = function() {
	if (this.status == statuses.InChatMuted || this.status == statuses.InChatUnmuted) {
		// No "real" leave chat function exists right now
		this.client.setPersonaState(steam.EPersonaState.Offline);
		var that = this;
		setTimeout(function() { that.client.setPersonaState(steam.EPersonaState.Online); }, 5000);

		// Need to clear this manually so we know we aren't in the room anymore
		this.client.chatRooms[this.groupId] = {};

		this._updateStatus(statuses.NotInChat);
	}
};

SteamChat.prototype.mute = function() {
	if (this.status == statuses.InChatUnmuted) {
		this._updateStatus(statuses.InChatMuted);
	}
};

SteamChat.prototype.unmute = function() {
	if (this.status == statuses.InChatMuted) {
		this._updateStatus(statuses.InChatUnmuted);
	}
};

SteamChat.prototype.loginIfOffline = function(callback, maxWait) {
	if (this.status != statuses.Offline) {
		return callback(null, "Already connected");
	}

	this.client.logOn(this._username, this._password);

	// Could make this somehow callback in _onLoggedOn but we'll just wait until it's done	
	var timeWaited = 0;
	var intervalTime = 100;
	maxWait = maxWait || 5000
	callback = callback || function() {};
	var that = this;
	var waitInterval = setInterval(function() {
		if (timeWaited > maxWait) {
			clearInterval(waitInterval);
			return callback("Status did not change after " + maxWait + " ms", null);
		}
		if (that.status != statuses.Offline) {
			clearInterval(waitInterval);
			return callback(null, "Successfully connected");
		}
		timeWaited += intervalTime;
	}, intervalTime);
};

SteamChat.prototype._proxyUserIsInChat = function() {
	return this.groupId in this.client.chatRooms && this.client.steamID in this.client.chatRooms[this.groupId];
};

SteamChat.prototype._onLoggedOn = function() {
	winston.info("Steam user logged on");
	this._connected = true;
	this.client.setPersonaState(steam.EPersonaState.Online);
	this._updateStatus(statuses.NotInChat);
};

SteamChat.prototype._onChatMessage = function(roomId, message, type, chatterId) {
	if (roomId != this.groupId || type != steam.EChatEntryType.ChatMsg) {
		return;
	}

	if (this.client.users && chatterId in this.client.users) {
		var username = this.client.users[chatterId].playerName;
		this.emit('chatMessage', { 
			steamId: chatterId, 
			message: message 
		});
	}

	if (message.toLowerCase() == '!proxymute') {
		this.mute();
	}
	else if (message.toLowerCase() == '!proxyunmute') {
		this.unmute();
	}
	else if (message.toLowerCase() == '!proxyusers') {
		this.emit('proxyUsers');
	}
};

SteamChat.prototype._onChatStateChange = function(stateChange, chatterActedOn, steamChatId, actedOnBy) {
	if (steamChatId == this.groupId && chatterActedOn == this.client.steamID 
		&& stateChange == steam.EChatMemberStateChange.Kicked) {

		this._updateStatus(statuses.NotInChat);
	}

	if (steamChatId != this.groupId || !(chatterActedOn in this.client.users)) {
		return;
	}

	this.emit('stateChange', {
		stateChange: stateChange,
		user: this.client.users[chatterActedOn],
		actedOnBy: this.client.users[actedOnBy]
	});
};

SteamChat.prototype._onPersonaState = function(userData) {
	if (this.groupId in this.client.chatRooms && userData.friendid in this.client.chatRooms[this.groupId]) {
		this.emit('personaState', userData);
	}
};

SteamChat.prototype._updateStatus = function(newStatus) {
	this.emit('statusChange', { oldStatus: this.status, newStatus: newStatus });
	this.status = newStatus;

	if (newStatus == statuses.InChatUnmuted) {
		this._muted = false;
	}
	else if (newStatus == statuses.InChatMuted) {
		this._muted = true;
	}
};

SteamChat.prototype._onDisconnected = function() {
	this._updateStatus(statuses.Offline);
};

exports.SteamChat = SteamChat;
