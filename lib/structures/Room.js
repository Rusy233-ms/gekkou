const Collection = require("../util/Collection");
const Message = require("./Message");
const Socket = require("socket.io-client");
const User = require("./User");

var EventEmitter;

try {
    EventEmitter = require("eventemitter3");
} catch (error) {
    EventEmitter = require("events").EventEmitter;
}

/**
 * Represents a room
 * @prop {String} id The ID of the room
 * @prop {String} site The site name of the room
 * @prop {Collection<User>} users A collection of users that are in the room
 * @prop {Number} userCount The number count of the users in the room
 * @prop {Number} latency The latency of the room
 */
class Room extends EventEmitter {
    /**
     * 
     * @param {(Object|Number)} wiki a wiki object or a room number
     */
    constructor(wiki, client) {
        super();
        this.id = wiki;
        this._client = client;
        this.users = new Collection(User);
        this.userCount = 0;
        this.messages = new Collection(Message, 1000);
    }

    get latency() {
        return this._lastPingSent && this._lastPingReceived ? this._lastPingReceived - this._lastPingSent : Infinity;
    }

    /**
     * Tell the bot to start a connection to the room
     */
    connect() {
        if (this.status === 'ready') {
            Promise.reject("Existing connection detected");
        } else {
            if (typeof this.id === "number") {
                this.initializeSocket();
            } else {
                this.wikiURL = this.buildWikiURL(this.id);
                if (!this.wikiURL) return this._client.rooms.delete(this.id);
                this._client.logger.info(`Connecting to room`, this.id);
                this.getRoomInfo().then(() => this.initializeSocket()).catch((err) => {
                    this._client.rooms.delete(this.id);
                });
            }
        }
    }

    /**
     * Builds a wiki URL
     * @param {Object} wiki object
     * @returns {String} wiki URL
     */
    buildWikiURL(_wiki) {
        if (!_wiki) return;
        const langCodes = require('iso-639-1');
        if (_wiki.domain !== 'wikia' && _wiki.domain !== 'fandom') {
            return this._client.logger.error(`Invalid domain: ${_wiki.domain}. Domain must be "wikia" or "fandom".`, _wiki);
        }
        let wikiDomain;
        if (_wiki.lang && _wiki.lang !== 'en') {
            if (!langCodes.validate(_wiki.lang)) {
                return this._client.logger.error(`Invalid language code: ${_wiki.lang}`, _wiki);
            }
            if (_wiki.domain === 'wikia') {
                wikiDomain = `http://${_wiki.lang}.${_wiki.wiki}.wikia.com`;
            } else if (_wiki.domain === 'fandom') {
                wikiDomain = `https://${_wiki.wiki}.fandom.com/${_wiki.lang}`;
            }
        } else {
            if (_wiki.domain === 'wikia') {
                wikiDomain = `https://${_wiki.wiki}.wikia.com`;
            } else if (_wiki.domain === 'fandom') {
                wikiDomain = `https://${_wiki.wiki}.fandom.com`;
            }
        }
        return wikiDomain;
    }

    getRoomInfo() {
        return new Promise((resolve, reject) => {
            this._client.logger.debug('Fetching info for', this.wikiURL);
            this._client.request("GET", `${this.wikiURL}/api.php`, {
                action: "query",
                meta: "siteinfo",
                siprop: "wikidesc",
                format: "json",
            }, {}, {}, true).then((api_res) => {
                this.server = api_res.data.query.wikidesc.id;
                this._client.request("GET", `${this.wikiURL}/wikia.php`, {
                    controller: "Chat",
                    format: "json",
                }, {}, {}, true).then((chat_res) => {
                    this.id = chat_res.data.roomId;
                    this.key = chat_res.data.chatkey;
                    resolve();
                }).catch((err) => {
                    this._client.logger.error(`Could not fetch chat info for ${this.wikiURL} - Wrong URL or chat isn't enabled. Error:`, err.message);
                    reject(err);
                });
            }).catch((err) => {
                this._client.logger.error(`Could not fetch wiki info for ${this.wikiURL} - Probably the wiki doesn't exist. Error:`, err.message);
                reject(err);
            });
        });
    }

    initializeSocket() {
        this._client.logger.debug(`Initializing WebSocket connection for room ${this.id}`);
        this.socket = Socket.connect(this._client.options.forcehttp === true ? "http://chat.wikia-services.com" : "https://chat.wikia-services.com", {
            query: {
                name: this._client.username,
                serverId: this.server,
                roomId: this.id,
                key: this.key
            }
        });
        this.socket
            .on("connect", () => {
                this._client.logger.debug(`(Re)connected to room ${this.id}`);
                this.ready = true;
                /**
                 * Fired when the room turns ready
                 * @event Room#ready
                 */
                super.emit("ready");
                this.status = "ready";
                this.send({
                    attrs: {
                        msgType: "command",
                        command: "initquery"
                    }
                });
                this._lastPingAck = true;
            })
            .on("message", (fn) => {
                const event = fn.event;
                const data = typeof fn.data === "string" && /^{|}$/.test(fn.data) ? JSON.parse(fn.data) : fn.data;
                this._client.logger.debug(`Received WebSocket message from room ${this.id} (${event})`, data);
                switch (event) {
                    case "chat:add":
                        data.room = this;
                        this.emit("messageCreate", this.messages.add(new Message(data, this._client)));
                        break;
                    case "join":
                        if (data.attrs.name !== this._client.username) {
                            data.id = data.attrs.name;
                            data.room = this;
                            if (!this.users.get(data.id)) {
                                this.emit("userJoin", this.users.add(data, this._client));
                                ++this.userCount;
                                ++this._client.userCount;
                            }
                        }
                        break;
                    case "logout":
                        data.id = data.attrs.name;
                        data.room = this;
                        if (this.users.get(data.id)) {
                            this.emit("userPart", this.users.remove(data));
                            --this._client.userCount;
                            --this.userCount;
                        }
                        break;
                    case "updateUser":
                        data.id = data.attrs.name;
                        data.room = this;
                        this.emit("userUpdate", this.users.update(data, this._client));
                        break;
                    case "kick":
                        data.id = data.attrs.kickedUserName;
                        this.emit("userKick", this.users.remove(data), this.users.get(data.attrs.moderatorName));
                        --this._client.userCount;
                        --this.userCount;
                        break;
                    case "initial": {
                            const users = data.collections.users.models;
                            for (var user of users) {
                                user.id = user.attrs.name;
                                this.users.add(user, this._client);
                                ++this.userCount;
                                ++this._client.userCount;
                            }
                            const messages = data.collections.chats.models;
                            for (var message of messages) {
                                message.room = this;
                                this.messages.add(new Message(message, this._client));
                            }
                        }
                        break;
                    case "openPrivateRoom":
                        console.log(data);
                        break;
                }
            })
            .on("ping", () => {
                if (!this._lastPingAck) {
                    return this.disconnect(new Error("Server didn't acknowledge previous ping, possible lost connection"));
                }

                this._lastPingAck = false;
                this._lastPingSent = new Date().getTime();
            })
            .on("pong", () => {  
                this._lastPingAck = true;
                this._lastPingReceived = new Date().getTime();
            })
            .on("disconnect", () => {
                super.emit("disconnect");
            });
    }
    /**
     * Tell the client to disconnect the room
     */
    disconnect(error) {
        if (this.status === "ready") {
            this.send({
                attrs: {
                  msgType: "command",
                  command: "logout",
                }
            });
            this.emit("debug", error | null);
        } else {
            Promise.reject("There's no connection to the room");
        }
    }
    /**
     * Creates a message to the room
     * @param {String} content 
     */
    createMessage(content) {
        this.send({
            attrs: {
                msgType: "chat",
                name: this._client.username,
                text: content,
            }
        });
    }

    /**
     * Update the bot's status in the room
     * @param {String} status Sets the bot's status, either `here` or `away` 
     */
    editStatus(status) {
        this.send({
            attrs: {
                msgType: "command",
                command: "setstatus",
                statusState: status
            }
        });
    }
    getMessages(limit) {
        return this._client.rooms.getMessages.call(this._client.rooms, this.id, limit);
    }
    /**
     * Kick a member from the room
     * @param {String} member The name of the member
     */
    kick(member) {
        if (/sysop|chatmoderator/.test(this.users.get(this._client.username).groups)) {
            if (!/sysop|chatmoderator/.test(this.users.get(member).groups)) {
                this.send({
                    attrs: {
                        msgType: "command",
                        command: "kick",
                        userToKick: member
                    }
                });
            } else {
                Promise.reject("Client is lower or same in rights");
            }
        } else {
            Promise.reject("Missing permissions");
        }
    }
    /**
     * Ban an user in the room
     * @param {String} user The user to ban
     * @param {String} reason The reason to ban the user
     * @param {Number} time The length of the ban (in milliseconds; default to one day)
     */
    ban(user, reason = "Bad behavior", time = 86400) {
        this.send({
            attrs: {
                msgType: "command",
                command: "ban",
                userToBan: user,
                reason,
                time
            }
        });
    }
    /**
     * Send a 'message' event
     * @param {Object} attrs The attributes object
     * @returns {Promise<String>}
     */
    send(attrs, ack) {
        if (typeof attrs !== "object") return;
        return new Promise((resolve, reject) => {
            attrs = JSON.stringify(attrs);
            if (this.status === "ready") {
                this.socket.send(attrs, ack);
                resolve(attrs);
            } else {
                reject("Room is not ready");
            }
        });
    }

    emit(event) {
        this._client.emit.apply(this._client, arguments);
        if (event !== "error" || this.listeners("error").length > 0) {
            super.emit.apply(this, arguments);
        }
    }
}

module.exports = Room;