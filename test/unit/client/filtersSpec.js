'use strict';

describe('filter', function() {
	beforeEach(module('steamGroupChatProxy.filters'));

	describe('buildAvatarUrl', function() {
		it('should generate a valid image URL', inject(function(buildAvatarUrlFilter) {
			var avatarHash = [0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF];
			expect(buildAvatarUrlFilter(avatarHash)).toEqual('http://media.steampowered.com/steamcommunity/public/images/avatars/aa/aaabacadaeaf.jpg');
		}));

		it('should pad single digit hexes', inject(function(buildAvatarUrlFilter) {
			var avatarHash = [0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F];
			expect(buildAvatarUrlFilter(avatarHash)).toEqual('http://media.steampowered.com/steamcommunity/public/images/avatars/0a/0a0b0c0d0e0f.jpg');
		}));
	});

	describe('personaState', function() {
		it('should show in game when game is not null', inject(function(personaStateFilter) {
			var userData = { gameName: 'Bad Rats' };
			expect(personaStateFilter(userData)).toEqual('In-Game');
		}));

		it('should show online by default', inject(function(personaStateFilter) {
			expect(personaStateFilter(null)).toEqual('Online');
		}));

		it('should show normal statuses', inject(function(personaStateFilter) {
			expect(personaStateFilter({ gameName: null, personaState: 0 })).toEqual('Offline');
			expect(personaStateFilter({ gameName: null, personaState: 1 })).toEqual('Online');
			expect(personaStateFilter({ gameName: null, personaState: 2 })).toEqual('Busy');
			expect(personaStateFilter({ gameName: null, personaState: 3 })).toEqual('Away');
			expect(personaStateFilter({ gameName: null, personaState: 4 })).toEqual('Snooze');
			expect(personaStateFilter({ gameName: null, personaState: 5 })).toEqual('Looking to Trade');
			expect(personaStateFilter({ gameName: null, personaState: 6 })).toEqual('Looking to Play');
		}));
	});

	describe('steamProfile', function() {
		it('should construct a steam profile URL', inject(function(steamProfileFilter) {
			expect(steamProfileFilter('steamId', 'username')).toEqual('<a href="http://steamcommunity.com/profiles/steamId" target="chatProxyProfile">username</a>');
		}));
	});
});
