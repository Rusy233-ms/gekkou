const Client = require("../index.js");
const bot = new Client("user", "pass");

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

bot.connect("onewiki", "es.anotherwiki"); // if u want more sites to connect, pass them as parameters