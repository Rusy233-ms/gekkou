const req = require('request-tsuki');
const log = require('hikari');
const EventEmitter = require('eventemitter3');
const io = require('socket.io-client');

class Gekkou extends EventEmitter {
  constructor(username, pass, site) {
    super();
    this.users = [];
    this.login(username, pass);
    this.getChatInfo(site);
    this.connect(username);
  }
  use(dependency) {
    require(dependency)(this); // eslint-disable-line global-require, import/no-dynamic-require
  }

  login(username, password) {
    req('https://services.wikia.com/auth/token', {
      username,
      password,
    }, 'POST').then(() => {
      this.emit('logged');
    }).catch((e) => {
      log(`Couldn't login because ${e.statusCode === 400 ? 'the username or the password is invalid.' : e.error.error_description.toLoweCase()} `, 'ERROR');
    });
  }

  getChatInfo(site) {
    this.on('logged', () => {
      req(`http://${site}.wikia.com/api.php`, {
        action: 'query',
        meta: 'siteinfo',
        siprop: 'wikidesc',
        format: 'json',
      }, 'GET').then((body) => {
        req(`http://${site}.wikia.com/wikia.php`, {
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
          this.emit('chatInfo', this.chatInfo);
        });
      });
    });
  }

  connect(name) {
    this.on('chatInfo', (d) => {
      this.socket = io.connect('http://chat.wikia-services.com', {
        query: {
          name,
          key: d.key,
          serverId: d.wikiId,
          wikiId: d.wikiId,
          roomId: d.roomId,
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
          if (!this.ready && data.attrs.name === name) {
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
          console.log(data.command);
        }
        if (socketevent === 'initial') {
          const users = data.collections.users.models;
          users.forEach((user) => {
            this.users[user.attrs.name] = user.attrs;
          });
        }
      });
    });
  }
}

module.exports = Gekkou;
