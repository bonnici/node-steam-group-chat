var routes = require('../../../server/routes.js');

describe('routes', function() {

	describe('steamAuth', function() {
		it("should redirect to the authentication URL on successful authentication", function() {
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);
			var fakeAuth = jasmine.createSpyObj('authenticator', ['authenticate']);
			fakeAuth.authenticate.andCallFake(function(callback) {
				callback(null, 'authUrl');
			});

			fakeRes.locals = { env: { authenticator: fakeAuth } };

			routes.steamAuth(null, fakeRes);

			expect(fakeAuth.authenticate).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('authUrl');
		});

		it("should redirect back to the home page on unsuccessful authentication", function() {
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);
			var fakeAuth = jasmine.createSpyObj('authenticator', ['authenticate']);
			fakeAuth.authenticate.andCallFake(function(callback) {
				callback('error', null);
			});

			fakeRes.locals = { env: { authenticator: fakeAuth } };

			routes.steamAuth(null, fakeRes);

			expect(fakeAuth.authenticate).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('/');
		});

		it("should redirect back to the home page if no authentication URL is returned", function() {
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);
			var fakeAuth = jasmine.createSpyObj('authenticator', ['authenticate']);
			fakeAuth.authenticate.andCallFake(function(callback) {
				callback(null, '');
			});

			fakeRes.locals = { env: { authenticator: fakeAuth } };

			routes.steamAuth(null, fakeRes);

			expect(fakeAuth.authenticate).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('/');
		});
	});

	describe('steamVerify', function() {
		it("should set a steam ID on the session on successful verification", function() {
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);
			var fakeAuth = jasmine.createSpyObj('authenticator', ['verify']);
			fakeAuth.verify.andCallFake(function(req, callback) {
				callback('steamId');
			});

			fakeRes.locals = { env: { authenticator: fakeAuth } };
			var req = { session: {} };

			routes.steamVerify(req, fakeRes);

			expect(req.session.steamId).toEqual('steamId');
			expect(fakeAuth.verify).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('/');
		});

		it("should clear the steam ID on the session on unsuccessful verification", function() {
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);
			var fakeAuth = jasmine.createSpyObj('authenticator', ['verify']);
			fakeAuth.verify.andCallFake(function(req, callback) {
				callback(null);
			});

			fakeRes.locals = { env: { authenticator: fakeAuth } };
			var req = { session: {} };

			routes.steamVerify(req, fakeRes);

			expect(req.session.steamId).toBe(null);
			expect(fakeAuth.verify).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('/');
		});
	});

	describe('logout', function() {
		it("should destroy session and redirect to home", function() {
			var fakeReq = { session: jasmine.createSpyObj('session', ['destroy']) };
			var fakeRes = jasmine.createSpyObj('res', ['redirect']);

			routes.logout(fakeReq, fakeRes);

			expect(fakeReq.session.destroy).toHaveBeenCalled();
			expect(fakeRes.redirect).toHaveBeenCalledWith('/');
		});
	});
});
