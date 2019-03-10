const Collection = require("../util/Collection");
const Room = require("../structures/Room");

class RoomManager extends Collection {
    constructor(client) {
        super(Room);
        this._client = client;
        this.connectQueue = [];
    }

    connect() {
        for (var site of this.connectQueue) {
            var room = this.get(site);

            if (!room) {
                room = this.add(new Room(site, this._client));
            }

            if (room.status === "ready") return;

            room.connect();

            room.on("ready", () => {
                /**
                 * Fired when a room turns ready
                 * @event Client#roomReady
                 * @prop {Number} id the ID of the room
                 */
                this._client.emit("roomReady", room.id);
                if (this._client.ready) {
                    return;
                }
                for (var other of this) {
                    if (!other[1].ready) {
                        return;
                    }
                }
                this._client.ready = true;
                this._client.startTime = Date.now();
                /**
                 * Fired when all rooms turn ready
                 * @event Client#ready
                 */
                this._client.logger.info('All rooms ready');
                this._client.emit("ready");
            });

            room.on("disconnect", (error) => {
                /**
                 * Fired when a room disconnects
                 * @event Client#roomDisconnect
                 * @prop {Error?} error The error, if any
                 * @prop {Number} id The ID of the room
                 */
                this._client.emit("roomDisconnect", error, room.id);
                for (var other of this) {
                    if (other[1].ready) {
                        return;
                    }
                }
                this._client.ready = false;
                this._client.startTime = 0;
                /**
                 * Fired when all rooms disconnect
                 * @event Client#disconnect
                 */
                this._client.logger.info('All rooms disconnected');
                this._client.emit("disconnect");
            });
        }
    }

    spawn(site) {
        var room = this.get(room);
        if (!room) {
            this.add(new Room(site, this._client));
            this.connectQueue.push(site);
        }
    }

    createMessage(room, content) {
        return new Promise((resolve, reject) => {
            if (!(room || content)) reject("No room or content specified");
            room = this.find((r) => (r.name || r.id) == room);
            if (!room) reject("Inexistent room");
            room.createMessage(content);
            resolve();
        });
    }

    getMessages(room, limit = 50) {
        return new Promise((resolve, reject) => {
            if (!(room)) reject("No room specified");
            room = this.find((r) => (r.name || r.id) == room);
            if (!room) reject("Inexistent room");
            const messages = Array.from(room.messages);
            var logs = [];
            if (limit <= messages.length) {
                return resolve(messages.slice(messages.length - limit, messages.length).map((message) => message[1]).concat(logs));
            }
            limit -= messages.length;
            logs = messages.map((message) => message[1]).concat(logs);
            if (messages.length < 100) {
                return resolve(logs);
            }
            reject();
        });
    }

    editStatus(status) {
        this.forEach((room) => {
            room.editStatus(status);
        });
    }

    toJSON() {
        var base = {};
        for (var key in this) {
            if (key in this && !key.startsWith("_")) {
                if (typeof this[key].toJSON === "function") {
                    base[key] = this[key].toJSON();
                } else {
                    base[key] = this[key];
                }
            }
        }
        return base;
    }
}

module.exports = RoomManager;