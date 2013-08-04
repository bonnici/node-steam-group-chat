var openid = require('openid');
//var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var xml2js = require('xml2js');

var userAuthentications = {
	NotFound: 0,
	FoundAndBlocked: 1,
	FoundAndAuthorized: 2
};
exports.userAuthentications = userAuthentications;

//var Authenticator = function(verifyUrl, mongoUrl) {
var Authenticator = function(verifyUrl, steamGroupId) {
	this.relyingParty = new openid.RelyingParty(
		verifyUrl, // Verification URL (yours)
		verifyUrl, // Realm 
		true, // Use stateless verification
		false, // Strict mode
		[]); // List of extensions to enable and include

	//this.mongoUrl = mongoUrl;
	this.steamGroupId = steamGroupId;
};

Authenticator.prototype.authenticate = function(callback) {
	this.relyingParty.authenticate('http://steamcommunity.com/openid', false, callback);
};

Authenticator.prototype.verify = function(req, callback) {
	this.relyingParty.verifyAssertion(req, function(error, result) {
		var prefix = 'http://steamcommunity.com/openid/id/';
		if (!error && result.authenticated && result.claimedIdentifier && 
			result.claimedIdentifier.indexOf(prefix) == 0) {

			var steamId = result.claimedIdentifier.substring(prefix.length);
			return callback(steamId);
		}
		return callback(null);
	});
};

Authenticator.prototype.getUserAuthentication = function(steamId, callback) {
	// For now just check if the user is in the steam group, maybe persist stuff in mongo later if 
	// there is a need (e.g. to block users)
	var url = 'http://steamcommunity.com/gid/' + this.steamGroupId + '/memberslistxml/?xml=1';

	request(url, function (err, response, body) {
		if (err) {
			return callback(err, null);
		}

		if (response.statusCode != 200) {
			return callback("Invalid HTTP respose code " + response.statusCode, null);
		}

		xml2js.parseString(response.body, function (err, result) {
			if (err) {
				return callback(err, null);
			}

			if (!result || !result.memberList || !result.memberList.members || !result.memberList.members[0].steamID64) {
				return callback("Invalid XML response");
			}

			var groupIds = result.memberList.members[0].steamID64;
			for (var i=0; i < groupIds.length; i++) {
				if (groupIds[i] == steamId) {
					return callback(null, userAuthentications.FoundAndAuthorized);
				}
			}
			return callback(null, userAuthentications.FoundAndBlocked);
		});
	})

	/*
	MongoClient.connect(this.mongoUrl, function(err, db) {
		if(err) return callback(err, null);

		db.collection('users').findOne({_id: steamId}, function(error, record) {
			if(err) return callback(err, null);

			if (!record) {
				return callback(null, userAuthentications.NotFound);
			}
			else {
				return record.canChat 
					? callback(null, userAuthentications.FoundAndAuthorized)
					: callback(null, userAuthentications.FoundAndBlocked)
			}
		});
	});
	*/
};

/*
Authenticator.prototype.setCanChat = function(steamId, canChat, callback) {
	MongoClient.connect(this.mongoUrl, function(err, db) {
		if(err) return callback(err, null);

		db.collection('users').findAndModify(
			{ _id: steamId },
			[['_id', 'asc']],
			{ $set: { canChat: canChat } },
			{ upsert: true, new: true },
			function(err, record) {
				if (err) return callback(err, null);
				return callback(null, record);
			});
	});
};
*/

exports.Authenticator = Authenticator;