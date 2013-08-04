var SteamChat = require('../../../server/steamChat.js').SteamChat;
var steam = require('steam');
var _ = require('underscore');

var chatStatuses = require('../../../server/steamChat.js').statuses;

describe('steamChat', function() {
	var steamChat;
	var fakeSteamClient;

	beforeEach(function() {
		fakeSteamClient = jasmine.createSpyObj('steam', [
				'logOn', 'on', 'setPersonaState', 'joinChat', 'sendMessage'
			]);
		fakeSteamClient.chatRooms = {};
		steamChat = new SteamChat('username', 'password', 'guardCode', 'groupId', fakeSteamClient);
	});

	describe('logOn', function() {
		it("should log on when created", function() {
			expect(fakeSteamClient.logOn).toHaveBeenCalledWith('username', 'password', 'guardCode', undefined);
		});

		it("should go online when logged on", function() {
			steamChat._onLoggedOn();
			expect(fakeSteamClient.setPersonaState).toHaveBeenCalledWith(steam.EPersonaState.Online);
		});

		it("should update status after logged on", function() {
			expect(steamChat.status).toEqual(chatStatuses.Offline);
			steamChat._onLoggedOn();
			expect(steamChat.status).toEqual(chatStatuses.NotInChat);
		});

		it("should maintain mute status after a rejoin", function() {
			expect(steamChat.status).toEqual(chatStatuses.Offline);
			steamChat._onLoggedOn();
			steamChat.joinChat(function() {
				expect(steamChat.status).toEqual(chatStatuses.InChatUnmuted);
				steamChat.mute();
				expect(steamChat.status).toEqual(chatStatuses.InChatMuted);
				steamChat.leaveChat();
				expect(steamChat.status).toEqual(chatStatuses.NotInChat);
				steamChat.joinChat(function() {
					expect(steamChat.status).toEqual(chatStatuses.InChatMuted);
				});
			});
		});
	});

	describe('sendProxyMessage', function() {
		it("should send a message when in chat and unmuted", function() {
			steamChat.status = chatStatuses.InChatUnmuted;
			steamChat.sendProxyMessage('steamId', 'username', 'message');

			expect(fakeSteamClient.sendMessage).toHaveBeenCalledWith('groupId', 'username: message');
		});

		it("should not send a message when not logged in", function() {
			steamChat.status = chatStatuses.Offline;
			steamChat.sendProxyMessage('user', 'message');

			expect(fakeSteamClient.sendMessage).not.toHaveBeenCalled();
		});
	});

	describe('onChatMessage', function() {
		it("should emit an event when a message is received", function() {
			var messageRecieved = false;
			steamChat.on('chatMessage', function(data) {
				messageRecieved = true;
				expect(data.steamId).toEqual('steamId');
				expect(data.message).toEqual('message');
			});

			fakeSteamClient.users = { 'steamId': { playerName: 'username' } };
			steamChat._onChatMessage('groupId', 'message', steam.EChatEntryType.ChatMsg, 'steamId');

			waitsFor(function() {
				return messageRecieved;
			}, "Message was never recieved", 1000);
		});

		it("should not call message callback when a message is received for the wrong room", function() {
			var messageRecieved = false;
			steamChat.on('chatMessage', function(data) {
				messageRecieved = true;
			});

			steamChat._onChatMessage('group2Id', 'message', steam.EChatEntryType.ChatMsg, 'chatterId');

			waits(100);

			runs(function () {
				expect(messageRecieved).toEqual(false);
			});
		});

		it("should not call message callback when a non-chat message is received", function() {
			var messageRecieved = false;
			steamChat.on('chatMessage', function(data) {
				messageRecieved = true;
			});

			steamChat._onChatMessage('groupId', 'message', steam.EChatEntryType.Typing, 'chatterId');

			waits(100);

			runs(function () {
				expect(messageRecieved).toEqual(false);
			});
		});
	});

	describe('getChatMembers', function() {
		it("should send details of all users in chat room that are also in users", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId1': {},
				'steamId2': {},
				'steamId3': {}
			} };
			fakeSteamClient.users = { 
				'steamId1': { playerName: "name1" },
				'steamId2': { playerName: "name2" },
				'steamId4': { playerName: "name4" }
			};

			var members = steamChat.getChatMembers();

			expect(_.size(members)).toEqual(2);
			expect(members.steamId1.playerName).toEqual('name1');
			expect(members.steamId2.playerName).toEqual('name2');
		});

		it("should include details of the included user", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId1': {}
			} };
			fakeSteamClient.users = { 
				'steamId1': { playerName: "name1" },
				'steamId2': { playerName: "name2" }
			};

			var members = steamChat.getChatMembers('steamId2', null);

			expect(_.size(members)).toEqual(2);
			expect(members.steamId1.playerName).toEqual('name1');
			expect(members.steamId2.playerName).toEqual('name2');
		});

		it("should not include details of the excluded user", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId1': {},
				'steamId2': {}
			} };
			fakeSteamClient.users = { 
				'steamId1': { playerName: "name1" },
				'steamId2': { playerName: "name2" }
			};

			var members = steamChat.getChatMembers(null, 'steamId2');

			expect(_.size(members)).toEqual(1);
			expect(members.steamId1.playerName).toEqual('name1');
		});
	});

	describe('isUserInChatAsMember', function() {
		it("should be true if use is in chat as a member, owner, officer, or moderator", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'member': { rank: steam.EClanPermission.Member },
				'owner': { rank: steam.EClanPermission.Owner },
				'officer': { rank: steam.EClanPermission.Officer },
				'moderator': { rank: steam.EClanPermission.Moderator },
				'all': { rank: steam.EClanPermission.Member | steam.EClanPermission.Owner
							| steam.EClanPermission.Officer | steam.EClanPermission.Moderator }
			} };

			expect(steamChat.isUserInChatAsMember('member')).toEqual(true);
			expect(steamChat.isUserInChatAsMember('owner')).toEqual(true);
			expect(steamChat.isUserInChatAsMember('officer')).toEqual(true);
			expect(steamChat.isUserInChatAsMember('moderator')).toEqual(true);
			expect(steamChat.isUserInChatAsMember('all')).toEqual(true);
		});

		it("should be false if use is not in chat", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId1': { rank: steam.EClanPermission.Member },
				'steamId2': { rank: steam.EClanPermission.Member }
			} };

			expect(steamChat.isUserInChatAsMember('steamId3')).toEqual(false);
		});

		it("should be false if use is in chat as a guest", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId1': { rank: steam.EClanPermission.Nobody },
				'steamId2': { }
			} };

			expect(steamChat.isUserInChatAsMember('steamId1')).toEqual(false);
			expect(steamChat.isUserInChatAsMember('steamId2')).toEqual(false);
		});
	});

	describe('send joined/left message', function() {
		it("should not send a message if the user is in chat", function() {
			fakeSteamClient.chatRooms = { 'groupId': {
				'steamId': { rank: steam.EClanPermission.Member }
			} };
			steamChat.status = chatStatuses.InChatUnmuted;

			steamChat.sendJoinedStatusMessage('steamId', 'username');
			steamChat.sendLeftStatusMessage('steamId', 'username');
			expect(fakeSteamClient.sendMessage).not.toHaveBeenCalled();

			fakeSteamClient.chatRooms = { 'groupId': {
			} };

			steamChat.sendJoinedStatusMessage('steamId', 'username');
			expect(fakeSteamClient.sendMessage.calls.length).toEqual(1);
			steamChat.sendLeftStatusMessage('steamId', 'username');
			expect(fakeSteamClient.sendMessage.calls.length).toEqual(2);
		});
	});

	describe('loginIfOffline', function() {
		it("should return immediately if not offline", function() {
			steamChat.status = chatStatuses.NotInChat;

			callbackCalled = false;
			steamChat.loginIfOffline(function(err, ok) { 
				expect(err).toEqual(null);
				expect(ok).not.toEqual(null);
				callbackCalled = true;
			});

			waits(10);

			runs(function() {
				expect(callbackCalled).toEqual(true);
				expect(steamChat.status).toEqual(chatStatuses.NotInChat);
				// Initial login attemp on creation 
				expect(fakeSteamClient.logOn.calls.length).toEqual(1);
			});
		});

		it("should return as soon as the status changes if offline", function() {
			steamChat.status = chatStatuses.Offline;

			callbackCalled = false;
			steamChat.loginIfOffline(function(err, ok) { 
				expect(err).toEqual(null);
				expect(ok).not.toEqual(null);
				callbackCalled = true;
			});

			setTimeout(function() { steamChat._onLoggedOn(); }, 500)

			waitsFor(function() {
				return callbackCalled;
			}, "Callback never fired", 1000);

			runs(function() {
				expect(steamChat.status).toEqual(chatStatuses.NotInChat);
				expect(fakeSteamClient.logOn.calls.length).toEqual(2);
			});
		});

		it("should return after the time limit if the login fails", function() {
			steamChat.status = chatStatuses.Offline;

			callbackCalled = false;
			steamChat.loginIfOffline(function(err, ok) { 
				expect(err).not.toEqual(null);
				expect(ok).toEqual(null);
				callbackCalled = true;
			}, 500);

			waitsFor(function() {
				return callbackCalled;
			}, "Callback never fired", 600);

			runs(function() {
				expect(steamChat.status).toEqual(chatStatuses.Offline);
				expect(fakeSteamClient.logOn.calls.length).toEqual(2);
			});
		});
	});
	
	describe('joinChat', function() {
		it("should return immediately if in chat", function() {
			steamChat.status = chatStatuses.InChatUnmuted;

			callbackCalled = false;
			steamChat.joinChat(function(err, ok) { 
				expect(err).toEqual(null);
				expect(ok).not.toEqual(null);
				callbackCalled = true;
			});

			waits(10);

			runs(function() {
				expect(callbackCalled).toEqual(true);
				expect(steamChat.status).toEqual(chatStatuses.InChatUnmuted);
				expect(fakeSteamClient.joinChat).not.toHaveBeenCalled();
			});
		});

		it("should return immediately if offline", function() {
			steamChat.status = chatStatuses.Offline;

			callbackCalled = false;
			steamChat.joinChat(function(err, ok) { 
				expect(err).toEqual(null);
				expect(ok).not.toEqual(null);
				callbackCalled = true;
			});

			waits(10);

			runs(function() {
				expect(callbackCalled).toEqual(true);
				expect(steamChat.status).toEqual(chatStatuses.Offline);
				expect(fakeSteamClient.joinChat).not.toHaveBeenCalled();
			});
		});

		it("should return as soon as the user is in chat if online and not in chat", function() {
			steamChat.status = chatStatuses.NotInChat;
			fakeSteamClient.steamID = "ownSteamId";

			callbackCalled = false;
			steamChat.joinChat(function(err, ok) { 
				expect(err).toEqual(null);
				expect(ok).not.toEqual(null);
				callbackCalled = true;
			});

			setTimeout(function() { 
				fakeSteamClient.chatRooms = { 'groupId': {
					'ownSteamId': {}
				} };
			}, 500)

			waitsFor(function() {
				return callbackCalled;
			}, "Callback never fired", 1000);

			runs(function() {
				expect(steamChat.status).toEqual(chatStatuses.InChatUnmuted);
				expect(fakeSteamClient.joinChat).toHaveBeenCalled();
			});
		});

		it("should return after the time limit if the join fails", function() {
			steamChat.status = chatStatuses.NotInChat;
			fakeSteamClient.steamID = "ownSteamId";

			callbackCalled = false;
			steamChat.joinChat(function(err, ok) { 
				expect(err).not.toEqual(null);
				expect(ok).toEqual(null);
				callbackCalled = true;
			}, 500);

			waitsFor(function() {
				return callbackCalled;
			}, "Callback never fired", 600);

			runs(function() {
				expect(steamChat.status).toEqual(chatStatuses.NotInChat);
				expect(fakeSteamClient.joinChat).toHaveBeenCalled();
			});
		});
	});
});
