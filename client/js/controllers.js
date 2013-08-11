'use strict';

angular.module('steamGroupChatProxy.controllers', []).

	controller('ChatRoomCtrl', ['$scope', 'socket', function($scope, socket) {

		$scope.model = { 
			chatHistory: [], 
			memberDetails: {},
			websiteUserDetails: {},
			proxyUserStatusMessage: '',
			statusMessage: 'Please wait ...'
		};

		socket.on('logged in user details', function(data) {
			$scope.model.user = data;
		});

		socket.on('all website user details', function(data) {
			$scope.model.websiteUserDetails = data;
		});

		socket.on('website user details', function(data) {
			if (data.steamId in $scope.model.websiteUserDetails) {
				$scope.model.websiteUserDetails[data.steamId].playerName = data.username;
				$scope.model.websiteUserDetails[data.steamId].avatarUrl = data.avatarUrl;
			}
		});

		socket.on('user joined from website', function(data) {
			$scope.model.chatHistory.push({
				timestamp: new Date(),
				username: data.username,
				steamId: data.steamId,
				message: "joined from the chat proxy.",
				separator: ''
			});

			$scope.model.websiteUserDetails[data.steamId] = { 
				playerName: data.username,
				friendid: data.steamId,
				avatarUrl: data.avatarUrl
			};
		});

		socket.on('user left website', function(data) {
			$scope.model.chatHistory.push({
				timestamp: new Date(),
				username: data.username,
				steamId: data.steamId,
				message: "left the chat proxy.",
				separator: ''
			});

			delete $scope.model.websiteUserDetails[data.steamId];
		});

		socket.on('proxy user status change', function(data) {
			switch (data.newStatus) {
				case 0: // Offline
					$scope.model.proxyUserStatusMessage = "The chat proxy user isn't online for some reason. This site is pretty useless now, maybe refresh the page?";
					$('#proxy-user-status-modal').foundation('reveal', 'open');
					break;
				case 1: // NotInChat
					$scope.model.proxyUserStatusMessage = "The chat proxy user isn't in chat for some reason, maybe refresh the page?";
					$('#proxy-user-status-modal').foundation('reveal', 'open');
					break;
				case 2: // InChatMuted
					$scope.model.proxyUserStatusMessage = "The overlords in chat have muted the chat proxy. Stop being so annoying.";
					$('#proxy-user-status-modal').foundation('reveal', 'open');
					break;
				case 3: // InChatUnmuted
					$scope.model.proxyUserStatusMessage = "Everything looks OK, this dialog should go away now.";
					$('#proxy-user-status-modal').foundation('reveal', 'close');
					break;
				default: 
					$scope.model.proxyUserStatusMessage = "Uh oh, something is wrong with the chat proxy user.";
					$('#proxy-user-status-modal').foundation('reveal', 'open');
					break;
			}
		});

		socket.on('message from chat', function(data) {
			var username = findUsername(data.steamId);
			var formattedMessage = data.message.replace(/\n/, '<br>');

			$scope.model.chatHistory.push({
				timestamp: new Date(),
				username: username,
				steamId: data.steamId,
				message: formattedMessage,
				separator: ':'
			});
		});

		socket.on('connection status', function(status) {
			switch (status) {
				case 0: // Error
					$scope.model.statusMessage = "Uh oh, something broke. Try refreshing the page or logging in again maybe?";
					$('#bad-status-modal').foundation('reveal', 'open');
					break;
				case 1: // NoSession
					$scope.model.statusMessage = "Log in using Steam to use the chat proxy.";
					$('#bad-status-modal').foundation('reveal', 'open');
					break;
				case 2: // NoUser
					$scope.model.statusMessage = "Couldn't find your profile for some reason. Try refreshing the page or logging in again maybe?";
					$('#bad-status-modal').foundation('reveal', 'open');
					break;
				case 3: // UserNotAllowedToChat
					$scope.model.statusMessage = "You aren't a member of the group so you can't use the chat proxy. If you join the group you can refresh the page or log in again.";
					$('#bad-status-modal').foundation('reveal', 'open');
					break;
				case 4: // UserCanChat
					$scope.model.statusMessage = "Authenticated";
					$('#bad-status-modal').foundation('reveal', 'close');
					break;
				default:
					$scope.model.statusMessage = "Uh oh, something broke. Try refreshing the page or logging in again maybe?";
					$('#bad-status-modal').foundation('reveal', 'open');
					break;
			}
		});

		socket.on('all chat member details', function(data) {
			$scope.model.memberDetails = data;
		});

		socket.on('user state change', function(data) {
			sendStateChangeMessage(data);

			// joined
			if (data.stateChange & 0x01) {
				$scope.model.memberDetails[data.user.friendid] = data.user;
			}
			// left | disconnected | kicked | banned
			else if (data.stateChange & 0x1E) {
				delete $scope.model.memberDetails[data.user.friendid];
			}
		});

		socket.on('persona state change', function(data) {
			if (data.friendid in $scope.model.memberDetails) {
				$scope.model.memberDetails[data.friendid] = data;
			}
		});

		socket.on('disconnect', function(data) {
			$scope.model.statusMessage = "Uh oh, something broke. Try refreshing the page or logging in again maybe?";
			$('#bad-status-modal').foundation('reveal', 'open');
		});

		$scope.sendMessage = function() {
			var message = $scope.model.newMessage;
			$scope.model.newMessage = "";
			socket.emit('send message to chat', message);
		};


		$scope.sendMessageOrNewline = function($event) {
			if ($event.keyCode == 13 || $event.keyCode == 10) {
				$event.preventDefault();

				if ($event.ctrlKey) {
					$scope.model.newMessage += '\n';
				}
				else {
					$scope.sendMessage();
				}
			}
		};


		var sendStateChangeMessage = function(data) {
			var message;
			if (data.stateChange & 0x01)
				message = "entered chat.";
			else if (data.stateChange & 0x02)
				message = "left chat.";
			else if (data.stateChange & 0x04)
				message = "disconnected.";
			else if (data.stateChange & 0x08)
				message = "was kicked by " + data.actedOnBy.playerName  + ".";
			else if (data.stateChange & 0x10) 
				message = "was banned by " + data.actedOnBy.playerName  + ".";

			$scope.model.chatHistory.push({
				timestamp: new Date(),
				username: data.user.playerName,
				steamId: data.user.friendid,
				message: message,
				separator: ''
			});
		};

		var findUsername = function(steamId) {
			var username = '?';

			if (steamId in $scope.model.memberDetails) {
				username = $scope.model.memberDetails[steamId].playerName;
			}
			else if (steamId in $scope.model.websiteUserDetails) {
				username = $scope.model.websiteUserDetails[steamId].playerName;
			}

			return username;
		};
	}]);