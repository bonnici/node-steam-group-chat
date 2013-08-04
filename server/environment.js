// Container for all global state

var express = require('express');
var http = require('http');
var _ = require('underscore');
var MongoStore = require('connect-mongo')(express);

var SteamWebApi = require('./steamWebApi.js').SteamWebApi;
var SteamChat = require('./steamChat.js').SteamChat;
var Authenticator = require('./authenticator.js').Authenticator;


var Environment = function(init) {
	// Keep track of all users connected using the website
	this.websiteUsers = {};

	if (init) {

		this.app = express();
		this.server = http.createServer(this.app);

		if (this.app.settings.env == 'development') {
			require('./config.js').init();
		}

		this.steamWebApi = new SteamWebApi(process.env.SteamWebApiKey);

		this.steamChat = new SteamChat(
			process.env.SteamChatProxyUserName,
			process.env.SteamChatProxyUserPassword,
			process.env.SteamChatProxyUserGuardCode,
			process.env.SteamGroupId
		);

		//this.authenticator = new Authenticator(process.env.SteamOpenIdVerifyUrl, process.env.MongoUrl);
		this.authenticator = new Authenticator(process.env.SteamOpenIdVerifyUrl, process.env.SteamGroupId);

		this.sessionStore = new MongoStore({ url: process.env.MongoUrl });
		this.cookieParser = express.cookieParser(process.env.ExpressCookieSecret);

		var that = this;
		this.steamChat.on('proxyUsers', function() { that.steamChat.sendMessage(that.getWebsiteUsersString()); });
	}

	this.getWebsiteUsersString = function() {
		var numUsers = _.size(this.websiteUsers);
		if (numUsers == 0) {
			return 'No users currently on the chat proxy website.';
		}

		var message = numUsers + ' users currently on the chat proxy website:';

		_.each(this.websiteUsers, function(val, key) {
			message += '\n' + val.username + ' (http://steamcommunity.com/profiles/' + key + ')';
		});

		return message;
	};

	this.getWebsiteUserDetails = function() {
		var data = {};
		_.each(this.websiteUsers, function(val, key) {
			data[key] = { 
				friendid: key, 
				playerName: val.username, 
				avatarUrl: val.avatarUrl
			};
		});

		return data;
	};

	// returns true if the user was not already connected with a different socket
	this.websiteUserJoined = function (steamId, socket, username, avatarUrl) {
		if (steamId in this.websiteUsers) {
			this.websiteUsers[steamId].username = username;
			this.websiteUsers[steamId].avatarUrl = avatarUrl;
			this.websiteUsers[steamId].sockets[socket.id] = socket;

			return false;
		}
		else {
			this.websiteUsers[steamId] = { 
				username: username,
				avatarUrl: avatarUrl,
				sockets: { }
			};
			this.websiteUsers[steamId].sockets[socket.id] = socket;

			this.steamChat.sendJoinedStatusMessage(steamId, username);

			return true;
		}
	};	

	// returns username if the user has left for good (no more connections)
	this.websiteUserLeft = function (steamId, socket) {
		if (steamId in this.websiteUsers) {
			if (socket.id in this.websiteUsers[steamId].sockets) {
				delete this.websiteUsers[steamId].sockets[socket.id];
			}

			if (_.size(this.websiteUsers[steamId].sockets) == 0) {
				var username = this.websiteUsers[steamId].username;
				delete this.websiteUsers[steamId];

				this.steamChat.sendLeftStatusMessage(steamId, username);

				if (_.size(this.websiteUsers) == 0) {
					this.steamChat.leaveChat();
				}

				return username;
			}
		}

		return false;
	};

	// returns true if the user details changed
	this.updateWebsiteUser = function(steamId, username, avatarUrl) {
		if (steamId in this.websiteUsers) {
			if (this.websiteUsers[steamId].username != username || this.websiteUsers[steamId].avatarUrl != avatarUrl) {
				this.websiteUsers[steamId].username = username;
				this.websiteUsers[steamId].avatarUrl = avatarUrl
				return true;
			}
		}
		return false;
	};
};

exports.Environment = Environment;