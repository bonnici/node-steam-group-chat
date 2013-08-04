var express = require('express');
var winston = require('winston');

var Environment = require('./environment.js').Environment;
var routes = require('./routes.js');
var sockets = require('./sockets.js');

var env = new Environment(true);
var app = env.app;

app.use(express.bodyParser());
app.use(env.cookieParser);
app.use(express.session({ 
	key: process.env.ExpressSessionKey, 
	store: env.sessionStore 
}));
app.use(express.static(__dirname + '/../client'));

app.use(function(req, res, next) {
	res.locals.env = env;
	next();
});

//todo prod/devo config

//app.get('/sessiontest', routes.sessionTest);

app.get('/steamauth', routes.steamAuth);
app.get('/steamverify', routes.steamVerify);
app.get('/logout', routes.logout);

sockets.init(env);

env.server.listen(process.env.PORT, function() {
	winston.info("Express server listening on port " + env.server.address().port + " in " + app.settings.env + " mode");
});