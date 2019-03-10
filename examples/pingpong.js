const Client = require("../index.js");
const bot = new Client({
	username: 'bot username',
	password: 'bot password'
});

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

bot.connect(
	{
		domain: 'wikia',
		wiki: 'community'
	},
	{
		domain: 'fandom',
		wiki: 'steven-universe',
		lang: 'es'
	}
	).catch((err) => {
	// do error handling here
});