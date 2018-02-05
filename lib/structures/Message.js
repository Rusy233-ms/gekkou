const Base = require("./Base");

/**
 * Represents a message
 * @prop {Number} id The ID of the message
 * @prop {Room} room The room the message is in
 * @prop {Number} timestamp Timestamp of message creation
 * @prop {User} author The message author
 * @prop {String} content Message content
 * @prop {Command?} command The Command used in the Message, if any (CommandClient only)
 */

class Message extends Base {

    /**
     * @param {Object} data
     * @param {Client} client
     */
    constructor(data, client) {
        super(data.id);
        this._client = client;
        this.update(data);
    }


    /**
     * @param {Object} data
     */
    update(data) {
        this.room = data.room;
        this.timestamp = data.attrs.timeStamp;
        this.author = this.room.users.get(data.attrs.name);
        this.content = data.attrs.text;
        this.continued = data.attrs.continued;
    }


    /**
     * @param {String} content
     */
    reply(content) {
        return this.room.createMessage.call(this.room, `${this.author.username}, ${content}`);
    }

    toJSON() {
        const base = super.toJSON(true);

        for (const key of [
            "author",
            "content",
            "timestamp"
        ]) {
            base[key] = this[key] && this[key].toJSON ? this[key].toJSON() : this[key];
        }

        return base;
    }
}

module.exports = Message;