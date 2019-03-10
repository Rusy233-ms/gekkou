const consola = require('consola'),
    RoomManager = require('./rooming/RoomManager');

var EventEmitter;
try {
    EventEmitter = require('eventemitter3');
} catch (error) {
    EventEmitter = require('events').EventEmitter;
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
     * @arg {Object} [options] Gekkou options
     * @arg {String} [options.username] Account username
     * @arg {String} [options.password] Account password
     * @arg {Number} [options.logLevel=1] Logging level (0 = error, 1 = warn, 2 = log, 3 = info, 4 = debug) (optional)
     * @arg {Boolean} [options.autoreconnect=true] Have Gekkou autoreconnect when connection is lost (optional)
     * @arg {Boolean} [options.forceHTTP=false] Disable HTTPS and force connecting to chat over HTTP. Set to `true` if you have problems connecting over HTTPS. (optional)
     * @arg {Number} [options.defaultImageSize=150] The default size to return user avatars or anything else. Can be whatever you want. (optional)
     */
    constructor(_options = {}) {
        super();
        this.version = require('../package.json').version;
        this.options = Object.assign({
            // default options
            logLevel: 1,
            autoreconnect: true,
            forcehttp: false,
            defaultImageSize: 150
        }, _options);
        this.logger = consola.create({
            level: this.options.logLevel
        });
        this.logger.info(`gekkou v${this.version} - running on Node.js ${process.version} (${process.platform} - ${process.arch})`);
        this.logger.debug('options', this.options);

        if (!(this.options.username || this.options.password)) {
            throw new Error("No username or password specified");
        }

        this.username = this.options.username;
        this.password = this.options.password;

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
     * @param {Array} sites Array of sites to connect to
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
                    if (typeof site === 'object') {
                        this.rooms.spawn(site);
                    } else if (Array.isArray(site)) {
                        for (let _site of site) {
                            if (typeof _site === 'object') {
                                this.rooms.spawn(_site);
                            } else {
                                this.logger.error('Invalid site:', _site);
                                reject(new Error('site must be an object'));
                            }
                        }
                    } else if (typeof site === 'object') {
                        let _site = site();
                        if (_site && typeof _site === 'object') {
                            this.rooms.spawn(_site);
                        } else {
                            this.logger.error('Invalid site:', _site);
                            reject(new Error('site must be an object'));
                        }
                    } else {
                        this.logger.error('Invalid site:', site);
                        reject(new Error('site must be an object'));
                    }
                }
                
                this.rooms.connect();
                resolve();
            }).catch(reject);
        });
    }

    login() {
        return new Promise((resolve, reject) => {
            if (!this.loggedIn) {
                this.logger.info('Now logging in to Wikia');
                this.request("POST", "https://services.wikia.com/auth/token", {}, {
                    "username": this.username,
                    "password": this.password
                }, {}, false, false).then((res) => {
                    this.loggedIn = true;
                    let body = res.data;
                    if (body.access_token) {
                        this.userToken = body.access_token;
                        /**
                         * Fired when the user is logged in
                         * @event Client#login
                         */
                        this.logger.info('Logged in');
                        this.emit("login");
                        resolve();
                    } else {
                        this.logger.error('An unknown error occurred while logging in');
                        reject(new Error('Unknown error'));
                    }
                }).catch((err) => {
                    this.logger.error('Failed to log in!', err.message);
                    reject(err);
                });
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

    /**
     * Dependency manager
     * @param {String} dependency Dependency name
     * @param {Any} _wiki _wiki to be passed
     */
    use(dependency, ..._wiki) {
        return require(dependency)([this, ..._wiki]);
    }

}

module.exports = Client;
