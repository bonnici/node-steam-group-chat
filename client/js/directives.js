'use strict';

angular.module('steamGroupChatProxy.directives', [])

	.directive('chatMessage', ['$filter', function($filter) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var formattedTime = $filter('date')(scope.message.timestamp, 'HH:mm a');
				var formattedUsername = $filter('steamProfile')(scope.message.steamId, scope.message.username);

				var htmlText = '<span class="time-username">' + formattedTime + ' - ' + formattedUsername + '</span>' + 
					scope.message.separator + ' ' + scope.message.message;

				element.html(htmlText);
				element.addClass('chat-message');
			}
		};
	}])

	.directive('userDetails', ['$filter', function($filter) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var avatarSrc = scope.user.avatarUrl || $filter('buildAvatarUrl')(scope.user.avatarHash);
				var formattedUsername = $filter('steamProfile')(scope.user.friendid, scope.user.playerName);
				var state = attrs.state || $filter('personaState')(scope.user);
				var game = scope.user.gameName;

				var imageClass = 'responsive' in attrs ? 'small-3 columns' : '';
				var infoClass = 'responsive' in attrs ? 'small-9' : '';

				var htmlText = 
					'<div class="' + imageClass + ' chat-member-image"><img src="' + avatarSrc + '"></div>' +
					'<div class="' + infoClass + ' columns chat-member-info">' +
					'	<div class="row">' + formattedUsername + '</div>' +
					'	<div class="row">' + state + '</div>';

				if (game) {
					htmlText += '<div class="row">' + game + '</div>';
				}

				htmlText += '</div>';

				element.html(htmlText);
				element.addClass('row chat-member');
			}
		};
	}])
;
