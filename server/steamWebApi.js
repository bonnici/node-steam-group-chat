var steamWeb = require('steam-web');
var LRU = require("lru-cache")

var SteamWebApi = function(apiKey) {
	this.client = new steamWeb({ apiKey: apiKey, format: 'json' });
	this.profileNameCache = LRU({ max: 100, maxAge: 10*60*1000 });
	//this.profileNameCache = LRU({ max: 100, maxAge: 1000 });
}

/*
returns callback(err, userDetails) where userDetails contains:
username - string
avatarUrl - string
*/

SteamWebApi.prototype.getProfileDetails = function(steamId, callback) {
	var cached = this.profileNameCache.get(steamId);
	if (cached) {
		return callback(null, cached);
	}

	var that = this;
	this.client.getPlayerSummaries({
		steamids: [steamId],
		callback: function(err, data) {
			if (err) {
				return callback(err, null);
			}
			if (!data) {
				return callback("No data returned", null);
			}

			if (data.response && data.response.players && data.response.players.length > 0) {
				var playerData = data.response.players[0];
				if (playerData && playerData.personaname) {
					var data = { username: playerData.personaname, avatarUrl: playerData.avatar };
					that.profileNameCache.set(steamId, data);
					return callback(null, data);
				}
			}
			return callback("Invalid response: " + data.response, null);
		}
	});
};

exports.SteamWebApi = SteamWebApi;