var sockets = require('../../../server/sockets.js');
var _ = require('underscore');

var userAuthentications = require('../../../server/authenticator.js').userAuthentications;
var proxyUserStatuses = require('../../../server/steamChat.js').statuses;

describe('sockets', function() {
	var fakeEnv, fakeSio, fakeSioRoom;
	var sessionKey = "key";
	var chatRoom = "chatRoom";

	beforeEach(function() {
		fakeEnv = jasmine.createSpyObj('environment', 
			['getWebsiteUsersString', 'getWebsiteUserDetails', 'websiteUserJoined', 
			'websiteUserLeft', 'updateWebsiteUser', 'cookieParser']);

		fakeEnv.sessionStore = jasmine.createSpyObj('sessionStore', ['get']);
		fakeEnv.authenticator = jasmine.createSpyObj('authenticator', ['getUserAuthentication']);
		fakeEnv.steamWebApi = jasmine.createSpyObj('steamWebApi', ['getProfileDetails']);
		fakeEnv.steamChat = jasmine.createSpyObj('steamChat', 
				['sendProxyMessage', 'getChatMembers', 'on', 'sendJoinedStatusMessage', 
				'sendLeftStatusMessage', 'isUserInChatAsMember', 'loginIfOffline', 'joinChat', 'leaveChat']);
		process.env.ExpressSessionKey = sessionKey;
		process.env.SocketIoChatRoom = chatRoom;

		fakeSio = jasmine.createSpyObj('sio', ['set', 'sockets']);
		fakeSio.sockets = jasmine.createSpyObj('sockets', ['on', 'in']);
		fakeSioRoom = jasmine.createSpyObj('sioRoom', ['emit']);
		fakeSio.sockets.in.andCallFake(function (roomName) {
			return fakeSioRoom;
		});

		sockets.init(fakeEnv, fakeSio);
	});

	describe('init', function() {
		it("should set authorization and connection handlers", function() {
			expect(fakeSio.set).toHaveBeenCalled();
			expect(fakeSio.set.calls[0].args[0]).toEqual("authorization");
			expect(fakeSio.sockets.on).toHaveBeenCalled();
			expect(fakeSio.sockets.on.calls[0].args[0]).toEqual("connection");
		});
	});

	describe('authorization', function() {
		it("should accept but not set session details if no cookie is found", function() {
			var req = { headers: {} };

			var authorized = false;
			sockets.authorization(req, function(err, accepted) {
				expect(accepted).toEqual(true);
				authorized = true;
			});

			waitsFor(function() {
				return authorized;
			}, "Authorization never finished", 1000);
		});

		it("should accept but not set session details if no session ID is found", function() {
			var req = { headers: { cookie: {} } };
			fakeEnv.cookieParser = function(req, res, callback) {
				req.signedCookies = {};
				callback();
			};
			
			var authorized = false;
			sockets.authorization(req, function(err, accepted) {
				expect(accepted).toEqual(true);
				authorized = true;
			});

			waitsFor(function() {
				return authorized;
			}, "Authorization never finished", 1000);
		});

		it("should accept but not set session details if no session data is found", function() {
			var req = { headers: { cookie: {} } };
			fakeEnv.cookieParser = function(req, res, callback) {
				req.signedCookies = {};
				req.signedCookies[sessionKey] = null;
				callback();
			};
			
			var authorized = false;
			sockets.authorization(req, function(err, accepted) {
				expect(accepted).toEqual(true);
				authorized = true;
			});

			waitsFor(function() {
				return authorized;
			}, "Authorization never finished", 1000);
		});

		it("should accept and set session details if session data is found", function() {
			var req = { headers: { cookie: {} } };
			fakeEnv.cookieParser = function(req, res, callback) {
				req.signedCookies = {};
				req.signedCookies[sessionKey] = "sessionId";
				callback();
			};

			fakeEnv.sessionStore.get = function(sessionId, callback) {
				expect(sessionId).toEqual("sessionId");
				callback(null, "session");
			};
			
			var authorized = false;
			sockets.authorization(req, function(err, accepted) {
				expect(accepted).toEqual(true);
				authorized = true;
			});

			waitsFor(function() {
				return authorized;
			}, "Authorization never finished", 1000);

			runs(function() {
				expect(req.sessionId).toEqual("sessionId");
				expect(req.session).toEqual("session");
			});
		});
	});

	describe('connection', function() {
		it("should emit no session if no session is found", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on']);
			fakeSocket.handshake = { };

			sockets.connection(fakeSocket);

			expect(fakeSocket.emit).toHaveBeenCalledWith('connection status', sockets.connectionStatuses.NoSession);
		});

/*
		it("should emit no user if user is not in the database or in chat as a member", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on']);
			fakeSocket.handshake = { session: { steamId: 'steamId' } };

			fakeEnv.authenticator.getUserAuthentication.andCallFake(function(steamId, callback) { 
				return callback(null, userAuthentications.NotFound); 
			});

			fakeEnv.steamChat.isUserInChatAsMember.andCallFake(function(steamId) { 
				return false; 
			});

			sockets.connection(fakeSocket);

			expect(fakeSocket.emit).toHaveBeenCalledWith('connection status', sockets.connectionStatuses.NoUser);
		});

		it("should emit authorized if user is not in the database but is in chat", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.handshake = { session: { steamId: 'steamId' } };

			fakeEnv.authenticator.getUserAuthentication.andCallFake(function(steamId, callback) { 
				return callback(null, userAuthentications.NotFound); 
			});

			fakeEnv.steamChat.isUserInChatAsMember.andCallFake(function(steamId) { 
				return true; 
			});

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			sockets.connection(fakeSocket);

			expect(fakeEnv.authenticator.setCanChat).toHaveBeenCalled();
			expect(fakeEnv.authenticator.setCanChat.calls[0].args[0]).toEqual('steamId');
			expect(fakeEnv.authenticator.setCanChat.calls[0].args[1]).toEqual(true);
			expect(fakeSocket.emit).toHaveBeenCalledWith('connection status', sockets.connectionStatuses.UserCanChat);
		});
*/

		it("should emit not allowed to chat if user can't chat", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.handshake = { session: { steamId: 'steamId' } };

			fakeEnv.authenticator.getUserAuthentication.andCallFake(function(steamId, callback) { 
				return callback(null, userAuthentications.FoundAndBlocked); 
			});

			sockets.connection(fakeSocket);

			expect(fakeSocket.emit).toHaveBeenCalledWith('connection status', sockets.connectionStatuses.UserNotAllowedToChat);
		});
		
		it("should emit authorized if user can chat", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.handshake = { session: { steamId: 'steamId' } };

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.authenticator.getUserAuthentication.andCallFake(function(steamId, callback) { 
				return callback(null, userAuthentications.FoundAndAuthorized); 
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			sockets.connection(fakeSocket);

			expect(fakeSocket.emit).toHaveBeenCalledWith('connection status', sockets.connectionStatuses.UserCanChat);
		});
	});

	describe('onAuthorizedConnect', function() {
		it("should set up socket handlers and emit initial state authorized after an authorized connection", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(fakeEnv.websiteUserJoined).toHaveBeenCalled();
			expect(fakeSocket.join).toHaveBeenCalledWith(chatRoom);
			expect(fakeSocket.on).toHaveBeenCalled();
			expect(fakeSocket.on.calls[0].args[0]).toEqual('disconnect');
			expect(fakeSocket.on.calls[1].args[0]).toEqual('send message to chat');
			expect(fakeSocket.emit.calls.length).toEqual(6);
			expect(fakeSocket.emit.calls[0].args[0]).toEqual('proxy user status change');
			expect(fakeSocket.emit.calls[1].args[0]).toEqual('connection status');
			expect(fakeSocket.emit.calls[1].args[1]).toEqual(sockets.connectionStatuses.UserCanChat);
			expect(fakeSocket.emit.calls[2].args[0]).toEqual('all chat member details');
			expect(fakeSocket.emit.calls[3].args[0]).toEqual('all website user details');
			expect(fakeSocket.emit.calls[4].args[0]).toEqual('proxy user status change');
			expect(fakeSocket.emit.calls[5].args[0]).toEqual('logged in user details');
		});

		it("should not set up the socket after an authorized connection if the nickname can't be found", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback("error", null);
			});

			expect(_.size(fakeEnv.websiteUsers)).toEqual(0);
			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(_.size(fakeEnv.websiteUsers)).toEqual(0);
			expect(fakeSocket.join).not.toHaveBeenCalled();
			expect(fakeSocket.on).not.toHaveBeenCalled();
			expect(fakeSocket.emit.calls.length).toEqual(1);
			expect(fakeSocket.emit.calls[0].args[0]).toEqual('connection status');
			expect(fakeSocket.emit.calls[0].args[1]).toEqual(sockets.connectionStatuses.Error);
		});

		it("should emit a joined message if the user was not already on the website", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.websiteUserJoined.andCallFake(function() { 
				return true; 
			});

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(fakeEnv.websiteUserJoined).toHaveBeenCalled();

			expect(fakeSioRoom.emit).toHaveBeenCalled();
			expect(fakeSioRoom.emit.calls[0].args[0]).toEqual('user joined from website');
		});

		it("should not emit a joined message if the user was already on the website", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.websiteUserJoined.andCallFake(function() { 
				return false; 
			});

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(fakeEnv.websiteUserJoined).toHaveBeenCalled();
			
			expect(fakeSioRoom.emit).not.toHaveBeenCalled();
		});

/*
		it("should add the user to the website users variable after an authorized connection", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.id = 'socketId';

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});
			
			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			expect(_.size(fakeEnv.websiteUsers)).toEqual(0);

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);
			expect(fakeEnv.websiteUsers['steamId'].username).toEqual('profileName');
			expect(_.size(fakeEnv.websiteUsers['steamId'].sockets)).toEqual(1);
			expect(fakeEnv.websiteUsers['steamId'].sockets['socketId']).toEqual(true);
		});

		it("should update the user in the website users variable after an authorized connection if they are already connected", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.id = 'socketId2';

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName2' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});
			
			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			fakeEnv.websiteUsers = { steamId: { username: 'profileName1', sockets: { socketId1: true } } };
			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);
			expect(fakeEnv.websiteUsers['steamId'].username).toEqual('profileName2');
			expect(_.size(fakeEnv.websiteUsers['steamId'].sockets)).toEqual(2);
			expect(fakeEnv.websiteUsers['steamId'].sockets['socketId1']).toEqual(true);
			expect(fakeEnv.websiteUsers['steamId'].sockets['socketId2']).toEqual(true);
		});

		it("should send a join message to steam when a user connects", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.id = 'socketId2';

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			fakeEnv.steamChat.loginIfOffline.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});
			
			fakeEnv.steamChat.joinChat.andCallFake(function(callback) { 
				return callback(null, "ok"); 
			});

			sockets.onAuthorizedConnect('steamId', fakeSocket);

			expect(fakeEnv.steamChat.sendJoinedStatusMessage).toHaveBeenCalledWith('steamId', 'profileName');
		});
*/
	});

	describe('onDisconnect', function() {
		it("should emit a left message if the user does not have any more website connections", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.websiteUserLeft.andCallFake(function() { 
				return 'username'; 
			});

			sockets.onDisconnect('steamId', fakeSocket);

			expect(fakeSioRoom.emit).toHaveBeenCalled();
			expect(fakeSioRoom.emit.calls[0].args[0]).toEqual('user left website');

		});

		it("should not emit a left message if the user does have another website connection", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.websiteUserLeft.andCallFake(function() { 
				return null;
			});

			sockets.onDisconnect('steamId', fakeSocket);
			
			expect(fakeSioRoom.emit).not.toHaveBeenCalled();
		});
/*
		it("should delete the socket from the website users variable but leave the user if there is another socket", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			fakeSocket.id = 'socketId1';

			fakeEnv.websiteUsers = { steamId: { username: 'profileName', sockets: { socketId1: true, socketId2: true } } };

			sockets.onDisconnect('steamId', fakeSocket);

			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);
			expect(fakeEnv.websiteUsers['steamId'].username).toEqual('profileName');
			expect(_.size(fakeEnv.websiteUsers['steamId'].sockets)).toEqual(1);
			expect(fakeEnv.websiteUsers['steamId'].sockets['socketId2']).toEqual(true);
		});

		it("should delete the user from the website users variable and send a disconnection notification if the last socket is removed", function() {
			fakeEnv.websiteUsers = { steamId: { username: 'profileName', sockets: { socketId1: true, socketId2: true } } };

			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);

			sockets.onDisconnect('steamId', { id: 'socketId1' });
			expect(_.size(fakeEnv.websiteUsers)).toEqual(1);

			sockets.onDisconnect('steamId', { id: 'socketId2' });
			expect(_.size(fakeEnv.websiteUsers)).toEqual(0);
		});

		it("should send a part message to steam when a user disconnects", function() {
			fakeEnv.websiteUsers = { steamId: { username: 'profileName', sockets: { socketId: true } } };

			sockets.onDisconnect('steamId', { id: 'socketId' });

			expect(fakeEnv.steamChat.sendLeftStatusMessage).toHaveBeenCalledWith('steamId', 'profileName');
		});
*/
	});

	describe('sendMessageToChat', function() {
		it("should not send message if no text is passed", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);
			sockets.sendMessageToChat('steamId', null, fakeSocket);
			sockets.sendMessageToChat('steamId', '', fakeSocket);

			expect(fakeSocket.emit).not.toHaveBeenCalled();
		});

		it("should not send message if web API returns an error", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback("error", null);
			});

			sockets.sendMessageToChat('steamId', 'message', fakeSocket);

			expect(fakeSocket.emit).not.toHaveBeenCalled();
		});

		it("should send and emit message if message and username are valid", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamChat.status = proxyUserStatuses.InChatUnmuted;
			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName' });
			});

			sockets.sendMessageToChat('steamId', 'message', fakeSocket);

			expect(fakeSioRoom.emit).toHaveBeenCalled();
			expect(fakeSioRoom.emit.calls[0].args[0]).toEqual('message from chat');
			expect(fakeSioRoom.emit.calls[0].args[1].steamId).toEqual('steamId');
			expect(fakeSioRoom.emit.calls[0].args[1].message).toEqual('message');
			expect(fakeEnv.steamChat.sendProxyMessage).toHaveBeenCalledWith('steamId', 'profileName', 'message');
		});

		it("should update the stored username and emit if it changes", function() {
			var fakeSocket = jasmine.createSpyObj('socket', ['emit', 'on', 'join']);

			fakeEnv.steamChat.status = proxyUserStatuses.InChatUnmuted;
			fakeEnv.websiteUsers = { steamId: { username: 'profileName1', sockets: { socketId1: true } } };
			fakeEnv.steamWebApi.getProfileDetails.andCallFake(function(steamId, callback) { 
				callback(null, { username: 'profileName2', avatarUrl: 'avatarUrl' });
			});

			fakeEnv.updateWebsiteUser.andCallFake(function() { 
				return true;
			});

			sockets.sendMessageToChat('steamId', 'message', fakeSocket);

			expect(fakeEnv.updateWebsiteUser).toHaveBeenCalledWith('steamId', 'profileName2', 'avatarUrl');
			expect(fakeSioRoom.emit).toHaveBeenCalledWith('website user details', { steamId: 'steamId', username: 'profileName2', avatarUrl: 'avatarUrl' });
		});
	});
});
