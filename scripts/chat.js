var baseUrl = "https://directline.botframework.com";
var ChatLib;
(function (ChatLib) {
    (function (MessageType) {
        MessageType[MessageType["Text"] = 0] = "Text";
        MessageType[MessageType["Image"] = 1] = "Image";
        MessageType[MessageType["File"] = 2] = "File";
        MessageType[MessageType["Video"] = 3] = "Video";
        MessageType[MessageType["Audio"] = 4] = "Audio";
        MessageType[MessageType["Location"] = 5] = "Location";
        MessageType[MessageType["Contact"] = 6] = "Contact";
    })(ChatLib.MessageType || (ChatLib.MessageType = {}));
    var MessageType = ChatLib.MessageType;
    var ChatMessage = (function () {
        function ChatMessage() {
            this.messageId = '';
            //public chatId: string = ''; //id for conversation
            this.botId = '';
            this.timestamp = null;
            this.text = '';
            this.contact = '';
            this.lat = '';
            this.long = '';
            this.contentUrl = '';
            this.isBotResponse = false;
            this.msgtype = 'text';
        }
        return ChatMessage;
    }());
    ChatLib.ChatMessage = ChatMessage;
    var ChatClient = (function () {
        function ChatClient(tokenNeedsRenewal, tokenOrSecret, botId, callback) {
            this._lastMessage = '';
            this._conversationId = null;
            this._watermark = null;
            this._token = null;
            this._polling = false;
            this._pollingStartTimer = false;
            this._botId = '';
            this._clientSecret = '';
            this._maxRetryOnPollFailure = 20;
            this._pollSetTimeout = 300;
            this._pollInterval = 1000;
            this._maxRetryOnRenewalFailure = 20;
            this._tokenRenewalInterval = 900000;
            this._tokenRenewalIntervalOnFailure = 600000;
            this.errorMessage = '';
            this._tokenNeedsRenewal = "true";
            this.conversation = [];
            this._clientSecret = tokenOrSecret;
            this._botId = botId;
            this._tokenNeedsRenewal = tokenNeedsRenewal;
            this._userId = null;
            // start a new conversation
            var _this = this;
            window.onmessage = function(event) {_this._userId = event.data;};
            this.startConversation(function () {
                callback();
            });
        }
        ChatClient.prototype.getCurrentTime = function () {
            var d = new Date();
            return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
        };
        ChatClient.prototype.startTokenRenewal = function (attemptNumber) {
            var _this = this;
            if (attemptNumber === void 0) { attemptNumber = 0; }
            $.ajax({
                type: 'GET',
                url: baseUrl + '/api/tokens/' + this._conversationId + '/renew',
                headers: { 'Authorization': 'BOTCONNECTOR ' + this._token },
                contentType: 'application/json',
            }).done(function (result) {
                _this.clearHttpError();
                _this._token = result;
                setTimeout(function (_) { _this.startTokenRenewal(); }, _this._tokenRenewalInterval);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                _this.showHttpError(jqXHR);
                attemptNumber++;
                if (attemptNumber < _this._maxRetryOnRenewalFailure) {
                    setTimeout(function (_) { _this.startTokenRenewal(attemptNumber); }, _this._tokenRenewalIntervalOnFailure);
                }
                //this.scrollToBottom();
            });
        };
        ChatClient.prototype.startConversation = function (callback) {
            var _this = this;
            $.ajax({
                method: 'POST',
                crossDomain: true,
                contentType: "text/plain",
                url: baseUrl + '/api/conversations',
                headers: { 'Authorization': 'BotConnector ' + this._clientSecret }
            }).done(function (result) {
                _this._conversationId = result.conversationId;
                if (_this._tokenNeedsRenewal == "true") {
                    _this._token = result.token;
                    setTimeout(function (_) { _this.startTokenRenewal(); }, _this._tokenRenewalInterval);
                }
                else {
                    _this._token = _this._clientSecret;
                }
                _this.clearHttpError();
                _this.pollMessages(true);
                callback();
            }).fail(function (jqXHR, textStatus, errorThrown) {
                _this.showHttpError(jqXHR);
            });
        };
        ChatClient.prototype.convertMessageToIntercomFormatJson = function (message) {
            var data = {
                conversationId: this._conversationId,
                from: this._userId,
                to: null,
                text: message.text
            };
            if (this._userId) {
                data.channelData = {userId:this._userId};
            }
            return JSON.stringify(data);
        };
        ChatClient.prototype.convertToCustomMessageFormat = function (message) {
            var responses = [];
            if (message.text) {
                var botResponse = new ChatMessage();
                botResponse.text = message.text;
                botResponse.botId = this._botId;
                botResponse.timestamp = new Date(message.created);
                if (message.from == this._botId) {
                    botResponse.isBotResponse = true;
                }
                responses.push(botResponse);
            }
            if (message.images.length > 0) {
                for (var i = 0; i < message.images.length; i++) {
                    var botResponse = new ChatMessage();
                    botResponse.botId = this._botId;
                    botResponse.timestamp = new Date(message.created);
                    if (message.from == this._botId) {
                        botResponse.isBotResponse = true;
                    }
                    botResponse.contentUrl = baseUrl + message.images[i];
                    botResponse.msgtype = 'image';
                    responses.push(botResponse);
                }
            }
            return responses;
        };
        ChatClient.prototype.sendMedia = function (path) {
            var _this = this;
            var formData = new FormData();
            formData.append('file', path);
            $.ajax({
                type: 'POST',
                url: baseUrl + '/api/conversations/' + this._conversationId + '/upload',
                headers: { 'Authorization': 'BOTCONNECTOR ' + this._token },
                cache: false,
                contentType: false,
                processData: false,
                data: formData
            }).done(function (result) {
                _this.clearHttpError();
                setTimeout(function (_) { _this.pollMessages(false); }, _this._pollSetTimeout);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                _this.showHttpError(jqXHR);
            });
        };
        ChatClient.prototype.sendMessage = function (message) {
            var _this = this;
            if (message.msgtype != 'text')
                return;
            this.conversation.push(message);
            var text = this.convertMessageToIntercomFormatJson(message);
            console.log(text);
            $.ajax({
                type: 'POST',
                url: baseUrl + '/api/conversations/' + this._conversationId + '/messages',
                headers: { 'Authorization': 'BotConnector ' + this._token },
                contentType: 'application/json',
                data: text
            }).done(function (result) {
                // TODO: add mesage to chat list
                _this.clearHttpError();
                //this.scrollToBottom();
                setTimeout(function (_) { _this.pollMessages(false); }, _this._pollSetTimeout);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                _this.showHttpError(jqXHR);
                //this.scrollToBottom();
            });
        };
        ChatClient.prototype.pollMessages = function (startTimer, attemptNumber) {
            var _this = this;

            if (attemptNumber === void 0) { attemptNumber = 0; }
            // Keep track of whether we're going to restart the timer (startTimer) or if
            // another caller asked us to restart the timer (this._pollingStartTimer).
            this._pollingStartTimer = startTimer = this._pollingStartTimer || startTimer;
            // Bail if someone is already calling
            if (this._polling)
                return;
            try {
                this._polling = true;
                var getUrl = '';
                if (this._watermark == null)
                    getUrl = baseUrl + '/api/conversations/' + this._conversationId + '/messages';
                else
                    getUrl = baseUrl + '/api/conversations/' + this._conversationId + '/messages?watermark=' + this._watermark;
                $.ajax({
                    type: 'GET',
                    url: getUrl,
                    headers: { 'Authorization': 'BotConnector ' + this._token },
                }).done(function (result) {
                    _this._polling = false;
                    _this._watermark = result.watermark;
                    var botResponses = _this.getBotResponses(result.messages);
                    for (var i = 0; i < botResponses.length; ++i) {
                        _this.conversation = _this.conversation.concat(_this.convertToCustomMessageFormat(botResponses[i]));
                    }
                    // If anyone asked us to start the timer while we were waiting, factor that in
                    startTimer = startTimer || _this._pollingStartTimer;
                    if (startTimer) {
                        _this._pollingStartTimer = false;
                        setTimeout(function (_) { _this.pollMessages(startTimer); }, _this._pollInterval);
                    }
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    _this._polling = false;
                    attemptNumber++;
                    if (attemptNumber < _this._maxRetryOnPollFailure) {
                        _this._pollingStartTimer = false;
                        setTimeout(function (_) { _this.pollMessages(startTimer, attemptNumber); }, _this._pollSetTimeout);
                    }
                });
            }
            catch (err) {
                this._polling = false;
            }
        };
        ChatClient.prototype.getBotResponses = function (messages) {
            var botResponses = [];
            for (var i = 0; i < messages.length; ++i) {
                if (messages[i].from == this._botId || messages[i].images.length > 0) {
                    botResponses.push(messages[i]);
                }
            }
            return botResponses;
        };
        ChatClient.prototype.scrollToBottom = function () {
            window.scrollTo(0, document.body.scrollHeight);
        };
        ChatClient.prototype.clearHttpError = function () {
            this.errorMessage = '';
        };
        ChatClient.prototype.showHttpError = function (jqXHR) {
            var text = 'Error talking to server :(';
            if (jqXHR.status == 401) {
                text = 'Authorization error';
            }
            else if (jqXHR.status == 500) {
                text = 'A server error occurred while processing this query.';
            }
            this.errorMessage = text;
        };
        return ChatClient;
    }());
    ChatLib.ChatClient = ChatClient;
})(ChatLib || (ChatLib = {}));
//# sourceMappingURL=chat.js.map
