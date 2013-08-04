var nock = require('nock');
var _ = require('underscore');
var auth = require('../../../server/authenticator.js');
var Authenticator = auth.Authenticator;

describe('authenticator', function() {
	var authenticator;
	var fakeRelyingParty;

	beforeEach(function() {
		fakeRelyingParty = jasmine.createSpyObj('RelyingParty', ['authenticate', 'verifyAssertion']);
		authenticator = new Authenticator('verifyUrl', 'groupId');
		authenticator.relyingParty = fakeRelyingParty;
	});

	describe('verify', function() {
		it("should return Steam ID if verification succeeds", function() {
			fakeRelyingParty.verifyAssertion.andCallFake(function(req, callback) {
				callback(null, { 
					authenticated: true, 
					claimedIdentifier: 'http://steamcommunity.com/openid/id/123456789'
				});
			});

			var returnedSteamId;
			authenticator.verify(null, function(steamId) {
				returnedSteamId = steamId;
			});

			waitsFor(function() {
				return returnedSteamId !== undefined;
			}, "Steam ID never returned", 1000);

			runs(function() {
				expect(fakeRelyingParty.verifyAssertion).toHaveBeenCalled();
				expect(returnedSteamId).toEqual('123456789');
			});
		});

		it("should return null if a bad identifier is returned", function() {
			fakeRelyingParty.verifyAssertion.andCallFake(function(req, callback) {
				callback(null, { 
					authenticated: true, 
					claimedIdentifier: 'http://stearncommunity.com/openid/id/123456789'
				});
			});

			var returnedSteamId;
			authenticator.verify(null, function(steamId) {
				returnedSteamId = steamId;
			});

			waitsFor(function() {
				return returnedSteamId !== undefined;
			}, "Steam ID never returned", 1000);

			runs(function() {
				expect(fakeRelyingParty.verifyAssertion).toHaveBeenCalled();
				expect(returnedSteamId).toBe(null);
			});
		});

		it("should return null if a bad Steam ID is returned", function() {
			fakeRelyingParty.verifyAssertion.andCallFake(function(req, callback) {
				callback(null, { 
					authenticated: true, 
					claimedIdentifier: 'http://stearncommunity.com/openid/id/'
				});
			});

			var returnedSteamId;
			authenticator.verify(null, function(steamId) {
				returnedSteamId = steamId;
			});

			waitsFor(function() {
				return returnedSteamId !== undefined;
			}, "Steam ID never returned", 1000);

			runs(function() {
				expect(fakeRelyingParty.verifyAssertion).toHaveBeenCalled();
				expect(returnedSteamId).toBe(null);
			});
		});
	});

	describe('getUserAuthentication', function() {
		var makeXml = function(members) {
			var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><memberList><members>';
			_.each(members, function(id) {
				xml += '<steamID64>' + id + '</steamID64>';
			});
			xml += '</members></memberList>';
			return xml;
		};

		it("should callback with authorized if user is in steam group", function() {
			var community = nock('http://steamcommunity.com')
				.get('/gid/groupId/memberslistxml/?xml=1')
				.reply(200, makeXml(['userId']));

			var returned = false;
			authenticator.getUserAuthentication('userId', function(err, result) {
				expect(err).toBe(null);
				expect(result).toEqual(auth.userAuthentications.FoundAndAuthorized);
				returned = true;
			});

			waitsFor(function() {
				return returned;
			}, "Web request never returned", 1000);

			runs(function() {
				community.done();
			});
		});

		it("should callback with blocked if user is not in steam group", function() {
			var community = nock('http://steamcommunity.com')
				.get('/gid/groupId/memberslistxml/?xml=1')
				.reply(200, makeXml(['userId2']));

			var returned = false;
			authenticator.getUserAuthentication('userId1', function(err, result) {
				expect(err).toBe(null);
				expect(result).toEqual(auth.userAuthentications.FoundAndBlocked);
				returned = true;
			});

			waitsFor(function() {
				return returned;
			}, "Web request never returned", 1000);

			runs(function() {
				community.done();
			});
		});

		it("should callback with error on request error", function() {
			var community = nock('http://steamcommunity.com')
				.get('/gid/groupId/memberslistxml/?xml=1')
				.reply(404);

			var returned = false;
			authenticator.getUserAuthentication('userId', function(err, result) {
				expect(err).not.toBe(null);
				expect(result).toBe(null);
				returned = true;
			});

			waitsFor(function() {
				return returned;
			}, "Web request never returned", 1000);

			runs(function() {
				community.done();
			});
		});

		it("should callback with error on xml error", function() {
		});
	});
});
