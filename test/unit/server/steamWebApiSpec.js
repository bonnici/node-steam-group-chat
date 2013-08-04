var SteamWebApi = require('../../../server/steamWebApi.js').SteamWebApi;

describe('steamWebApi', function() {
	var steamWebApi;
	var fakeSteamWeb;

	describe('getProfileDetails', function() {
		var buildResponse = function(personaname, avatar) {
			return { 
				response: {
					players: [{ 
						personaname: personaname,
						avatar: avatar
					}]
				}
			};
		};

		beforeEach(function() {
			fakeSteamWeb = jasmine.createSpyObj('steam-web', ['getPlayerSummaries']);
			steamWebApi = new SteamWebApi('key');
			steamWebApi.client = fakeSteamWeb;
			steamWebApi.profileNameCache = jasmine.createSpyObj('cache', ['get', 'set']);
		});

		it("should get a user's profile name", function() {
			fakeSteamWeb.getPlayerSummaries.andCallFake(function(params) {
				params.callback(null, buildResponse("profileName", "avatar"));
			});

			var userData = null;
			var userDetailsErr = null
			steamWebApi.getProfileDetails('123', function(err, data) {
				userData = data;
				userDetailsErr = err;
			});

			waitsFor(function() {
				return userData != null || userDetailsErr != null;
			}, "Profile data never returned", 1000);

			runs(function() {
				expect(fakeSteamWeb.getPlayerSummaries).toHaveBeenCalled();
				expect(userDetailsErr).toBe(null);
				expect(userData.username).toEqual('profileName');
			});
		});

		it("should pass through errors", function() {
			fakeSteamWeb.getPlayerSummaries.andCallFake(function(params) {
				params.callback("steam-web error", null);
			});

			var userData = null;
			var userDetailsErr = null
			steamWebApi.getProfileDetails('123', function(err, data) {
				userData = data;
				userDetailsErr = err;
			});

			waitsFor(function() {
				return userData != null || userDetailsErr != null;
			}, "Profile data never returned", 1000);

			runs(function() {
				expect(fakeSteamWeb.getPlayerSummaries).toHaveBeenCalled();
				expect(userDetailsErr).toEqual("steam-web error");
				expect(userData).toBe(null);
			});
		});

		it("should return an error if a bad response is returned", function() {
			fakeSteamWeb.getPlayerSummaries.andCallFake(function(params) {
				params.callback(null, { invalid: "response" });
			});

			var userData = null;
			var userDetailsErr = null
			steamWebApi.getProfileDetails('123', function(err, data) {
				userData = data;
				userDetailsErr = err;
			});

			waitsFor(function() {
				return userData != null || userDetailsErr != null;
			}, "Profile data never returned", 1000);

			runs(function() {
				expect(fakeSteamWeb.getPlayerSummaries).toHaveBeenCalled();
				expect(userDetailsErr).not.toBe(null);
				expect(userData).toBe(null);
			});
		});

		it("should use the cached value if found", function() {
			steamWebApi.profileNameCache.get.andCallFake(function(steamId) {
				return { username: "cachedName" };
			});

			steamWebApi.getProfileDetails('steamId', function(err, data) {
				expect(fakeSteamWeb.getPlayerSummaries).not.toHaveBeenCalled();
				expect(err).toBe(null);
				expect(data.username).toEqual('cachedName');
			});
		});
		
		it("should store a retrieved value in the cache", function() {
			steamWebApi.profileNameCache.get.andCallFake(function(steamId) {
				return null;
			});
			fakeSteamWeb.getPlayerSummaries.andCallFake(function(params) {
				params.callback(null, buildResponse("profileName", "avatar"));
			});

			var userData = null;
			var userDetailsErr = null
			steamWebApi.getProfileDetails('steamId', function(err, data) {
				userData = data;
				userDetailsErr = err
			});

			waitsFor(function() {
				return userData != null || userDetailsErr != null;
			}, "Profile data never returned", 1000);

			runs(function() {
				expect(steamWebApi.profileNameCache.set).toHaveBeenCalledWith('steamId', { username: 'profileName', avatarUrl: 'avatar' });
			});
		});
	});
});
