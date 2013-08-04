var environment = require('../../../server/environment.js');

describe('environment', function() {
	var env, fakeSocket1, fakeSocket2;

	beforeEach(function() {
		env = new environment.Environment(false);
		env.steamChat = jasmine.createSpyObj('steamChat', ['sendJoinedStatusMessage', 'sendLeftStatusMessage', 'leaveChat']);

		fakeSocket1 = { id: 'socketId1' };
		fakeSocket2 = { id: 'socketId2' };
	});

	describe('website users', function() {
		it("should create a new entry for a user and send a message to steam when they join for the first time", function() {
			var newlyJoined = env.websiteUserJoined('steamId', fakeSocket1, 'username', 'avatarUrl');

			expect(env.websiteUsers).toEqual({ steamId: { 
				username: 'username',
				avatarUrl: 'avatarUrl', 
				sockets: { 'socketId1': fakeSocket1 }
			} });

			expect(newlyJoined).toEqual(true);
			expect(env.steamChat.sendJoinedStatusMessage).toHaveBeenCalledWith('steamId', 'username');
		});

		it("should update the entry for a user and not send a message to steam when they join for the second time", function() {
			var fakeSocket2 = { id: 'socketId2' };
			env.websiteUserJoined('steamId', fakeSocket1, 'username', 'avatarUrl');
			var newlyJoined = env.websiteUserJoined('steamId', fakeSocket2, 'username2', 'avatarUrl2');

			expect(env.websiteUsers).toEqual({ steamId: { 
				username: 'username2',
				avatarUrl: 'avatarUrl2', 
				sockets: { 'socketId1': fakeSocket1, 'socketId2': fakeSocket2 }
			} });

			expect(newlyJoined).toEqual(false);
			expect(env.steamChat.sendJoinedStatusMessage.calls.length).toEqual(1);
		});

		it("should remove the entry for a user and send a message to steam when they leave and have no other connections", function() {
			env.websiteUserJoined('steamId', fakeSocket1, 'username', 'avatarUrl');
			var leftUsername = env.websiteUserLeft('steamId', fakeSocket1);

			expect(env.websiteUsers).toEqual({});

			expect(leftUsername).toEqual('username');
			expect(env.steamChat.sendLeftStatusMessage).toHaveBeenCalledWith('steamId', 'username');
		});

		it("should update the entry for a user and not send a message to steam when they leave but still have other connections", function() {
			env.websiteUserJoined('steamId', fakeSocket1, 'username', 'avatarUrl');
			env.websiteUserJoined('steamId', fakeSocket2, 'username2', 'avatarUrl2');
			var leftUsername = env.websiteUserLeft('steamId', fakeSocket1);

			expect(env.websiteUsers).toEqual({ steamId: { 
				username: 'username2',
				avatarUrl: 'avatarUrl2', 
				sockets: { 'socketId2': fakeSocket2 }
			} });

			expect(leftUsername).toBeFalsy();
			expect(env.steamChat.sendLeftStatusMessage).not.toHaveBeenCalled();
		});

		it("should leave chat when the last user leaves the website", function() {
			env.websiteUserJoined('steamId', fakeSocket1, 'username', 'avatarUrl');
			env.websiteUserLeft('steamId', fakeSocket1);

			expect(env.steamChat.leaveChat).toHaveBeenCalled();
		});

		it("should not leave chat if another user is still on the website", function() {
			env.websiteUserJoined('steamId1', fakeSocket1, 'username1', 'avatarUrl1');
			env.websiteUserJoined('steamId2', fakeSocket2, 'username2', 'avatarUrl2');
			env.websiteUserLeft('steamId1', fakeSocket1);

			expect(env.steamChat.leaveChat).not.toHaveBeenCalled();
		});
	});
});