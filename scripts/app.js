var botApp = angular.module('botApp', ['ngSanitize']);
botApp.config(['$compileProvider',
  function ($compileProvider) {
      $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|file|blob|cdvfile|content):|data:image\//);

  }]);

botApp.controller('ChatCtrl', function ($scope, $interval, $rootScope, $window, $sce, $filter, $q) {
    $scope.botId = 1;
    $scope.botId2MessageId = {};
    $scope.lastConversationLength = 0;
    $scope.DayArray = ["Mon", "Tue", "Wed", "Thurs", "Fri", "Sat", "Sun"];
    var imageExtensionSupported = [".bmp",".gif",".jpeg",".jpg",".png",".svg"];
    $scope.botIconPath = botIcon;
    $scope.startTimestamp = new Date();
    $scope.welcomeTimestamp = "Now";
    var messageNo = 1;
    if ($scope.botId2MessageId.hasOwnProperty($scope.botId)) {
        messageNo = $scope.botId2MessageId[$scope.botId];
    }
    var messageId = $scope.botId + "" + messageNo;


    function isImage(src) {

        var deferred = $q.defer();

        var image = new Image();
        image.onerror = function () {
            
            deferred.resolve(false);
        };
        image.onload = function () {
            deferred.resolve(true);
            
        };
        image.src = src;

        return deferred.promise;
    }

    $scope.FileSelected = function (input, isIframe) {
        
        if (input.files && input.files[0]) {

            var errorMsg = null;
            var size= input.files[0].size/1000000;
            if (size > 5)
            {
                errorMsg ="Image bigger than 5MB. Please select smaller image!";
                
            }

            var URL = window.URL || window.webkitURL;
            isImage(URL.createObjectURL(input.files[0])).then(function (test) {
                
                if(test==false)
                {
                    errorMsg = "File not supported!";
                }

                if (errorMsg == null) {
                    if (isIframe == "true") {
                        $scope.chatClient = chatClient;
                    }
                    if ($scope.chatClient != null) {
                        var message = new ChatLib.ChatMessage();
                        $scope.chatClient.sendMedia(input.files[0]);
                    }
                }
                else {
                    alert(errorMsg);
                }

            });
            
        }
    }

    function getTimeStampStr(dateNow, originalMsgTimestamp) {
        var difference = dateNow - originalMsgTimestamp;
        var minutesDiffrence = Math.floor(difference / (1000 * 60));
        var str = null;
        if (minutesDiffrence < 1) {
            str = "Now";
        }
        else if (minutesDiffrence < 5 && minutesDiffrence >= 1) {
            str = "1 min ago";
        }

        else if (minutesDiffrence >= 5 && minutesDiffrence < 60) {
            str = (Math.floor(minutesDiffrence / 5) * 5) + " mins ago";
        }
        else if (minutesDiffrence == 60) {
            str = "1 hour ago";
        }
        else {
            str = $filter('date')(originalMsgTimestamp, "dd/MM/yyyy hh:mm a");;
        }
        return str;
    }

    $scope.GetMessages = function (inputBotId, isIframe) {
        if (isIframe == "true") {
            $scope.chatClient = chatClient;
        }
        if ($scope.chatClient == null) {
            $scope.chatClient = new ChatLib.ChatClient(clientSecret, inputBotId, function () {

                $scope.chatClient.sendMessage(message);
            });
        }

        // If the watermark hasn't changed, return existing data
        if ($scope.chatClient._watermark == $scope.watermark)
            return $scope.chatClient.conversation;

        var conversation = $scope.chatClient.conversation;
        if (isIframe == "true" && (conversation.length - $scope.lastConversationLength > 0)) {
            $("#body-container").animate({ scrollTop: $("#body-container")[0].scrollHeight }, "slow");
            $scope.lastConversationLength = conversation.length;
        }
        else {
            var elem = document.getElementById("BotModalBody" + inputBotId);
            if (elem != null)
                elem.scrollTop = elem.scrollHeight;
        }



        var dateNow = new Date();
        $scope.welcomeTimestamp = getTimeStampStr(dateNow, $scope.startTimestamp);
        for (i = 0; i < conversation.length; i++) {
            conversation[i].showtimestamp = true;
            conversation[i].showIcon = true;

            conversation[i].timestampstr = getTimeStampStr(dateNow, conversation[i].timestamp);
        }

        if (conversation.length > 0) {
            var startMessageFrom = conversation[0].isBotResponse;

            var startTimeStamp = conversation[0].timestamp;
            for (i = 1; i < conversation.length; i++) {
                if (conversation[i].isBotResponse == startMessageFrom) {
                    var differnce = conversation[i].timestamp - startTimeStamp;
                    var secondsDifference = Math.floor(differnce / 1000);
                    if (secondsDifference <= 60) {
                        conversation[i - 1].showtimestamp = false;
                        conversation[i].showIcon = false;
                    }
                    else {
                        startMessageFrom = conversation[i].isBotResponse;
                        startTimeStamp = conversation[i].timestamp;
                    }
                }
                else {
                    startMessageFrom = conversation[i].isBotResponse;
                    startTimeStamp = conversation[i].timestamp;
                }
            }
        }

        $scope.watermark = $scope.chatClient._watermark;
        return conversation;
    }

    $scope.renderHtml = function (html) {
        return $sce.trustAsHtml(html);
    }

    $scope.renderMarked = function (text) {

        return marked(text);
    }

    $scope.sendTextMessage = function (inputBotId, clientSecret, isIframe) {
        
        var element = $("#messageToSend")[0];
        if (element != null) {

            var message2send = element.textContent;
            message2send = message2send.trim();
            element.innerHTML = '';
            $("#send-svg").attr('style', 'color:' +defaultSendButtonColor + ' !important');
            $("#send-svg").css('opacity', '0.3');
            if (message2send != '') {
                var message = new ChatLib.ChatMessage();
                message.messageId = messageId;
                message.text = message2send;
                message.timestamp = new Date();
                if (isIframe == "true") {
                    $scope.chatClient = chatClient;
                }
                if ($scope.chatClient == null) {
                    $scope.chatClient = new ChatLib.ChatClient(clientSecret, inputBotId, function () {

                        $scope.chatClient.sendMessage(message);
                    });
                }
                else {
                    $scope.chatClient.sendMessage(message);
                }
                
            }
        }
    };


    var timer = $interval(function () {

    }, 10);

    $scope.toggleUploadOptions = function () {
        
        $("#uploadOptions").toggle();
    }

});


angular.element(document).ready(function () {
    var elements = document.getElementsByClassName("BotMainDiv");

    for (var i = 0; i < elements.length; i++) {
        angular.bootstrap(elements[i], ['botApp']);
    }


});




