'use strict';

angular.module('steamGroupChatProxy.filters', []).

	filter('buildAvatarUrl', function() {
		var defaultUrl = 'http://media.steampowered.com/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg';

		var paddedHex = function(num) {
			var hex = '';
			if (num < 0x10) hex += '0';
			hex += num.toString(16);
			return hex;
		};

		return function(avatarHash) {
			if (!avatarHash || avatarHash.length < 1 || avatarHash[0] == 0) {
				return defaultUrl;
			}

			var url = 'http://media.steampowered.com/steamcommunity/public/images/avatars/' + paddedHex(avatarHash[0]) + '/';
			for (var i=0; i < avatarHash.length; i++) {
				url += paddedHex(avatarHash[i]);
			}
			url += '.jpg';

			return url;
		}
	})

	.filter('personaState', function() {
		return function(userData) {
			if (!userData) {
				return "Online";
			}

			if (userData.gameName) {
				return "In-Game";
			}

			switch (userData.personaState) {
				case 0: return "Offline"
				case 1: return "Online"
				case 2: return "Busy"
				case 3: return "Away"
				case 4: return "Snooze"
				case 5: return "Looking to Trade"
				case 6: return "Looking to Play"
				default: return "Online";
			}
		}
	})
	
	.filter('steamProfile', function() {
		return function(steamId, username) {
			return '<a href="http://steamcommunity.com/profiles/' + steamId + '" target="chatProxyProfile">' + username + '</a>';
		}
	});