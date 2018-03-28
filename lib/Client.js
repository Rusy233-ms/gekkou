const RoomManager = require("./rooming/RoomManager");

var EventEmitter;

try {
    EventEmitter = require("eventemitter3");
} catch (error) {
    EventEmitter = require("events").EventEmitter;
}

/**
 * Represents a Gekkou client
 * @prop {String} username The client username
 * @prop {String} password The client password
 * @prop {String} site The client wiki domain
 * @prop {Number} startTime Timestamp of bot ready event
 * @prop {Number} uptime How long in milliseconds the client has been up for
 */
class Client extends EventEmitter {
    /**
     * Create a client
     * @arg {String} username Client username
     * @arg {String} password Client password
     * @arg {Object} [options] Gekkou options (optional)
     * @arg {Boolean} [options.autoreconnect=true] Have Gekkou autoreconnect when connection is lost
     * @arg {Boolean} [options.forcehttp=false] Disable HTTPS and force connecting to chat over HTTP. Only enable if you have problems connecting over HTTPS.
     * @arg {Number} [options.defaultImageSize=150] The default size to return user avatars or anything else. Can be whatever you want.
     */
    constructor(username, password, options = {}) {
        super();

        if (!(username || password)) {
            throw new Error("No username or password specified");
        }

        this.options = {
            "autoreconnect": true,
            "forcehttp": false,
            "defaultImageSize": 150
        };

        if (typeof options === "object") {
            for (const item in options) {
                this.options[item] = options[item];
            }
        }

        this.username = username;
        this.password = password;

        this.request = require("./rest/RequestHandler");

        this.rooms = new RoomManager(this);
        this.userCount = 0;
    }

    get uptime() {
        return this.startTime ? Date.now() - this.startTime : 0;
    }

    /**
     * Tell the client to connect all rooms.
     * The arguments passed will be taken as sites to connect the bot
     * @param {String} sites The site to connect
     * @returns {Promise} Resolves when the client are connected
     */
    connect(...sites) { // eslint-disable-line no-unused-vars
        return new Promise((resolve, reject) => {
            this.login().then(() => {
                if (arguments.length === 0) {
                    reject("No site specified");
                }

                this.site = Array.from(arguments);

                for (const site of this.site) {
                    if (typeof site === "string") {
                        this.rooms.spawn(site);
                    } else if (Array.isArray(site)) {
                        for (let _site of site) {
                            if (typeof _site === "string") {
                                this.rooms.spawn(_site);
                            }
                        }
                    } else if (typeof site === "function") {
                        let _site = site();
                        if (_site && typeof _site === "string") {
                            this.rooms.spawn(_site);
                        }
                    }
                }

                this.rooms.connect();

                resolve();
            });
        });
    }

    login() {
        return new Promise((resolve, reject) => {
            if (!this.loggedIn) {
                this.request("POST", "https://services.wikia.com/auth/token", {
                    "username": this.username,
                    "password": this.password
                }).then(() => {
                    this.loggedIn = true;

                    /**
                     * Fired when the user is logged
                     * @event Client#login
                     */
                    this.emit("login");
                    resolve();
                }).catch(reject);
            } else {
                resolve();
            }
        });
    }

    disconnect() {
        this.ready = false;
        this.rooms.forEach((room) => {
            room.disconnect();
        });
        this.rooms.connectQueue = [];
    }


    /**
     * Create a message
     * @arg {String} room A room ID or name to send the message
     * @arg {String} content A content string
     */
    createMessage(room, content) {
        return this.rooms.createMessage.call(this.rooms, room, content);
    }


    /**
     * Update the bot's status in all rooms
     * @param {String} status Sets the bot's status, either `here` or `away`
     */
    editStatus(status) {
        return this.rooms.editStatus.call(this.rooms, status);
    }
}

module.exports = Client;