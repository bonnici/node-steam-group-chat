node-steam-group-chat
=====================

Mobile-friendly steam group chat website. Runs as a web server that is paired with a steam user in the background. When someone visits the website, the steam user will join a specific chat room and all messages in the room will be echoed in the app, and you can also send messages that will be send to the room using the steam user. The current users in chat are also shown in the website. Authentication is handled by logging in through Steam, and only members of the group are allowed to see the chat and send messages.

This was built using Angular JS, with most connection stuff being handled by socket.io, for more details see my [blog post ](http://holtcode.blogspot.com/2013/08/online-steam-group-chat-app.html). 

To get this working you'll need to have some environment variables set up, in devo you can make a file in server\config.js that looks like this:

```
exports.init = function() {
	process.env.PORT = 8001;
	process.env.SteamChatProxyUserId = 'xxx';
	process.env.SteamChatProxyUserName = 'xxx';
	process.env.SteamChatProxyUserPassword = 'xxx';
	process.env.SteamGroupId = 'xxx';
	process.env.ExpressCookieSecret = 'xxx';
	process.env.ExpressSessionKey = 'xxx';
	process.env.SteamWebApiKey = 'xxx';
	process.env.SocketIoChatRoom = 'xxx';
	process.env.SteamOpenIdVerifyUrl = 'http://localhost:8001/steamverify';
	process.env.MongoUrl = 'xxx';
}
```

There are also a few gotchas related to installation, you'll need to follow the setup instructions for [node-gyp](https://github.com/TooTallNate/node-gyp#installation), and your steam user will also need to have Steam Guard disabled and it must own a game or be an administrator of the group before it will be allowed to join the chat room.