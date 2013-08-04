var winston = require('winston');

exports.steamAuth = function(req, res) {
	var authenticator = res.locals.env.authenticator;
	authenticator.authenticate(function(error, authUrl) {
		if (error) {
			winston.warn('Authentication failed', error);
			res.redirect('/');
		}
		else if (!authUrl) {
			winston.warn('Authentication failed: No authentication URL returned');
			res.redirect('/');
		}
		else {
			res.redirect(authUrl);
		}
	});
};

exports.steamVerify = function(req, res) {
	var authenticator = res.locals.env.authenticator;
	authenticator.verify(req, function(steamId) {
		// we want to  set session's steamId to null if null is returned
		req.session.steamId = steamId; 
		res.redirect('/');
	});
};

exports.logout = function(req, res) {
	req.session.destroy();
	res.redirect('/');
};