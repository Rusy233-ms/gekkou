const req = require('request-tsuki');
const log = require('hikari');
const EventEmitter = require('eventemitter3');
const io = require('socket.io-client');

class Gekkou extends EventEmitter {
  constructor(username, pass, site) {
    super();
    this.users = {};
    this.socket = {};
    this.username = username;
    this.password = pass;
    this.site = site;
    this.loggedIn = false;
    this.ready = false;
    this.connect();
  }
  /**
 * @param {string} dependency - Dependency to be used, should be required before this line
 * @param {array} options - An array of options, guess you already know?
 */
  use(dependency, ...options) {
    dependency(this, options); // eslint-disable-line global-require, import/no-dynamic-require
  }
  /**
   * Sends a message, with less or equal than 1000 characters.
   * @param {string} text
   */
  sendMessage(text) {
    if (text.length <= 1000) {
      this.socket.send(JSON.stringify({
        attrs: {
          msgType: 'chat',
          name: this.username,
          text,
        },
      }));
    } else {
      log('Message must be less than 1000 characters!', 'ERROR');
    }
  }
  /**
   * Sets the bot "away"
   */
  setAway() {
    this.socket.send(JSON.stringify({
      attrs: {
        command: 'setstatus',
        msgType: 'command',
        statusState: 'away',
      },
    }));
  }
  /**
   * Kicks a user from chat. **Requires mod rights** (or above)
   * @param {string} userToKick
   */
  kick(userToKick) {
    this.socket.send(JSON.stringify({
      attrs: {
        msgType: 'command',
        command: 'kick',
        userToKick,
      },
    }));
  }
  /**
 * Quits ang logouts from the socket.io server
 */
  quit() {
    this.socket.send(JSON.stringify({
      attrs: {
        msgType: 'command',
        command: 'logout',
      },
    }));
    process.exit(1);
  }

  /** Bans a user from chat. **Requires mod rights** (or above)
   * @param {string} userToBan - User to ban
   * @param {(number|string)} time - Time ('1 second' or 1 or 'infinite')
   * @param {string} reason - Reason to ban
   */
  ban(userToBan, time, reason) {
    this.socket.send(JSON.stringify({
      attrs: {
        msgType: 'command',
        command: 'ban',
        userToBan,
        time,
        reason,
      },
    }));
  }

  connect() { // eslint-disable-line consistent-return
    if (!this.loggedIn) {
      return req('https://services.wikia.com/auth/token', {
        username: this.username,
        password: this.password,
      }, 'POST').then(() => {
        this.loggedIn = true;
        this.connect();
      }).catch((e) => {
        log(`Couldn't login because ${e.statusCode === 400 ? 'the username or the password is invalid.' : e.error.error_description.toLowerCase()} `, 'ERROR');
      });
    }

    req(`http://${this.site}.wikia.com/api.php`, {
      action: 'query',
      meta: 'siteinfo',
      siprop: 'wikidesc',
      format: 'json',
    }, 'GET').then((body) => {
      req(`http://${this.site}.wikia.com/wikia.php`, {
        controller: 'Chat',
        format: 'json',
      }, 'GET').then((chat) => {
        this.chatInfo = {
          wikiName: chat.themeSettings.wikiName,
          wikiDomain: chat.themeSettings.wikiDomain,
          wikiDescription: chat.themeSettings.wikiDescription,
          wikiId: body.query.wikidesc.id,
          roomId: chat.roomId,
          key: chat.chatkey,
        };

        this.socket = io.connect('http://chat.wikia-services.com', {
          query: {
            name: this.username,
            key: this.chatInfo.key,
            serverId: this.chatInfo.wikiId,
            wikiId: this.chatInfo.wikiId,
            roomId: this.chatInfo.roomId,
          },
        });
        this.socket.on('message', (payload) => {
          const socketevent = payload.event;
          const data = typeof payload.data === 'string' && payload.data.substr(0, 1) === '{' ?
            JSON.parse(payload.data) : payload.data;
          if (socketevent === 'chat:add') {
            const message = {
              author: {
                avatar: data.attrs.avatarSrc,
                name: data.attrs.name,
              },
              continued: data.attrs.continued,
              id: data.attrs.id,
              reply: text => this.sendMessage(`@${message.author.name}: ${text}`),
              timestamp: data.attrs.timeStamp,
              text: data.attrs.text,
            };
            this.emit('message', message, this, log);
          }
          if (socketevent === 'join') {
            if (!this.ready && data.attrs.name === this.username) {
              this.ready = true;
              this.emit('ready', log);
              this.socket.send(JSON.stringify({
                attrs: {
                  msgType: 'command',
                  command: 'initquery',
                },
              }));
            } else {
              this.emit('join', data.attrs.name, this, log);
              this.users[data.attrs.name] = data.attrs;
            }
          }
          if (socketevent === 'part') {
            this.emit('part', data.attrs.name, this, log);
            if (this.users[data.attrs.name]) delete this.users[data.attrs.name];
          }
          if (socketevent === 'openPrivateRoom') {
            log(data.attrs.command);
          }
          if (socketevent === 'initial') {
            const users = data.collections.users.models;
            users.forEach((user) => {
              this.users[user.attrs.name] = user.attrs;
            });
          }
          if (socketevent === 'kick') {
            const kick = {
              moderator: data.attrs.moderatorName,
              kicked: data.attrs.kickedUserName
            }
            this.emit('kick', kick, this, log);
            if (this.users[data.attrs.kickedUserName]) delete this.users[data.attrs.kickedUserName];
          }
          if (socketevent === 'ban') {
            const ban = {
              moderator: data.attrs.moderatorName,
              banned: data.attrs.kickedUserName,
              time: data.attrs.time,
              reason: data.attrs.reason
            }
            this.emit('ban', ban, this, log);
            if (this.users[data.attrs.kickedUserName]) delete this.users[data.attrs.kickedUserName];
          }
        });
      });
    });
  }
}

module.exports = Gekkou;
