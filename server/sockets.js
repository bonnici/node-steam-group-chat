var socketio = require('socket.io');
var winston = require('winston');
var _ = require('underscore');

var userAuthentications = require('./authenticator.js').userAuthentications;
var proxyUserStatuses = require('./steamChat.js').statuses;

var env;
var io;

var connectionStatuses = {
	Error: 0,
	NoSession: 1,
	NoUser: 2,
	UserNotAllowedToChat: 3,
	UserCanChat: 4
};
exports.connectionStatuses = connectionStatuses;

exports.init = function(environment, sio) {
	env = environment;

	if (sio) {
		io = sio;
	}
	else {
		io = socketio.listen(env.server);
		io.configure(function(){
			io.set('log level', 2);

			// Settings for heroku (doesn't support web sockets)
			io.set("transports", ["xhr-polling"]); 
			io.set("polling duration", 10); 
		});
	}

	io.set('authorization', exports.authorization);
	io.sockets.on('connection', exports.connection);

	env.steamChat.on('chatMessage', exports.emitChatMessage);
	env.steamChat.on('stateChange', exports.emitStateChange);
	env.steamChat.on('personaState', exports.emitPersonaState);
	env.steamChat.on('statusChange', exports.emitStatusChange);
};

exports.emitChatMessage = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('message from chat', data);
};

exports.emitStateChange = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('user state change', data);
};

exports.emitPersonaState = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('persona state change', data);
};

exports.emitJoinedFromWebsite = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('user joined from website', data);
};

exports.emitLeftWebsite = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('user left website', data);
};

exports.emitWebsiteUserDetails = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('website user details', data);
};

exports.emitStatusChange = function(data) {
	io.sockets.in(process.env.SocketIoChatRoom).emit('proxy user status change', data);
};

exports.authorization = function(req, accept) {
	// Accept all sockets but only set session data if the user is authorized
	if (!req.headers.cookie) {
		return accept(null, true);
	}

	env.cookieParser(req, null, function(err) {
		var sessionId = req.signedCookies ? 
			req.signedCookies[process.env.ExpressSessionKey] 
			: null;

		if (!sessionId) {
			return accept(null, true);
		}

		env.sessionStore.get(sessionId, function(storeErr, session) {
			if (storeErr || !session) {
				return accept(null, true);
			} 

			req.session = session;
			req.sessionId = sessionId;
			return accept(null, true);
		});
	});
};

exports.connection = function(socket) {
	if (!socket.handshake || !socket.handshake.session || !socket.handshake.session.steamId) {
		socket.emit('connection status', connectionStatuses.NoSession);
		return;
	}

	steamId = socket.handshake.session.steamId;

	env.authenticator.getUserAuthentication(steamId, function(err, auth) {
		if (err) socket.emit('connection status', connectionStatuses.Error);

		switch (auth) {
		case userAuthentications.NotFound:
			/*
			if (env.steamChat.isUserInChatAsMember(steamId)) {
				env.authenticator.setCanChat(steamId, true, function(err, obj) {
					if (err) console.log("Error setting canChat: " + err);
					else console.log("New user " + steamId + " was in chat room, set canChat to true");
				});
				exports.onAuthorizedConnect(steamId, socket);
			}
			else {
				socket.emit('connection status', connectionStatuses.NoUser);
			}
			*/
			socket.emit('connection status', connectionStatuses.NoUser);
			break;
		case userAuthentications.FoundAndBlocked:
			socket.emit('connection status', connectionStatuses.UserNotAllowedToChat);
			break;
		case userAuthentications.FoundAndAuthorized:
			exports.onAuthorizedConnect(steamId, socket);
			break;
		default:
			socket.emit('connection status', connectionStatuses.Error);
			break;
		}
	});
};

exports.onAuthorizedConnect = function(steamId, socket) {
	env.steamWebApi.getProfileDetails(steamId, function(err, data) {
		if (err) {
			winston.error("steamWebApi.getProfileDetails error", err);
			socket.emit('connection status', connectionStatuses.Error);
			return;
		}

		socket.emit('proxy user status change', {
			oldStatus: null,
			newStatus: proxyUserStatuses.NotInChat
		});

		// First make sure steam user is logged in and in chat
		env.steamChat.loginIfOffline(function(err, ok) {
			if (err) {
				winston.error("loginIfOffline error", err);
				socket.emit('connection status', connectionStatuses.Error);
				return;
			}

			env.steamChat.joinChat(function(err, ok) {
				if (err) {
					winston.error("joinChat error", err);
					socket.emit('connection status', connectionStatuses.Error);
					return;
				}

				socket.on('disconnect', function() {
					exports.onDisconnect(steamId, socket);
				});

				socket.join(process.env.SocketIoChatRoom);
				socket.on('send message to chat', function(message) {
					exports.sendMessageToChat(steamId, message, socket);
				});

				socket.emit('connection status', connectionStatuses.UserCanChat);
				socket.emit('all chat member details', env.steamChat.getChatMembers());
				socket.emit('all website user details', env.getWebsiteUserDetails());
				socket.emit('proxy user status change', {
					oldStatus: proxyUserStatuses.NotInChat,
					newStatus: env.steamChat.status
				});
				socket.emit('logged in user details', { steamId: steamId, username: data.username, avatarUrl: data.avatarUrl });

				if (env.websiteUserJoined(steamId, socket, data.username, data.avatarUrl)) {
					exports.emitJoinedFromWebsite({ steamId: steamId, username: data.username, avatarUrl: data.avatarUrl });
					socket.emit('logged in user details', { steamId: steamId, username: data.username, avatarUrl: data.avatarUrl });
				}
			});
		});
	});
};


exports.onDisconnect = function(steamId, socket) {
	var username = env.websiteUserLeft(steamId, socket);
	if (username) {
		exports.emitLeftWebsite({ steamId: steamId, username: username });
	}
};

exports.sendMessageToChat = function(steamId, message, socket) {
	if (!message || env.steamChat.status != proxyUserStatuses.InChatUnmuted) {
		return;
	}

	env.steamWebApi.getProfileDetails(steamId, function(err, data) {
		if (err) {
			winston.error("steamWebApi.getProfileDetails error", err);
			return;
		}

		if (env.updateWebsiteUser(steamId, data.username, data.avatarUrl)) {
			exports.emitWebsiteUserDetails({ steamId: steamId, username: data.username, avatarUrl: data.avatarUrl });
		}

		// Echo message to users since we won't get an event about the bot's own posting
		exports.emitChatMessage({
			steamId: steamId,
			message: message
		});

		env.steamChat.sendProxyMessage(steamId, data.username, message);
	});
};