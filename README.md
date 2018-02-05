Gekkou [![NPM version]](https://npmjs.com/package/gekkou)
====
A NodeJS Wikia chat client

## Requirements

- [NodeJS](https://nodejs.org/en/download/ "Latest version recommended.")

---

### Installation

Create a directory for your bot and change to that directory in your command line. Use NPM to install Gekkou:

`npm install gekkou`

### Optional libraries

- `eventemitter3` - Alternate EventEmitter library (faster)

---

### Example: Ping Pong

```js
const { Client } = require("gekkou");
const bot = new Client("some_username", "some_password");

bot.on("ready", () => {
    console.log("Ready!"); // logs ready
});

bot.on("messageCreate", (msg) => {
    if (msg.content === "!ping") { // If the message content is "!ping"
        bot.createMessage(msg.room.id, "Pong!");
        // Send a message in the same room with "Pong!"
    } else if (msg.content === "!pong") { // Otherwise, if the message is "!pong"
        bot.createMessage(msg.room.id, "Ping!");
        // Respond with "Ping!"
    }
});

bot.connect("ur.wiki", "ur.other-wiki"); // if u want more sites to connect, pass them as parameters
```

More examples can be found in the [examples folder](/examples).

[NPM version]: https://img.shields.io/npm/v/gekkou.svg?style=flat-square