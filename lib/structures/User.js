const Base = require("./Base");
const {NOCOOKIE_URL} = require("../rest/Endpoints");

/**
 * Represents a user
 * @prop {String} username The user username
 * @prop {String} avatarURL the user avatar URL
 */

class User extends Base {
    constructor(data, client) {
        super(data.attrs.name);
        this._client = client;
        this.update(data);
    }

    update(data) {
        this.username = data.attrs.name;
        this.since = data.attrs.since["0"];
        this.status = {
            "state": data.attrs.statusState,
            "message": data.attrs.statusMessage
        };
        this.avatar = data.attrs.avatarSrc.replace(/https?:\/.+?\/|\/.+?$/g, "");
        this.groups = data.attrs.groups;
        this.editCount = data.attrs.editCount;
        this.room = data.room;
    }

    get avatarURL() {
        return this.avatar ? `${NOCOOKIE_URL}/${this.avatar}/scale-to-width-down/${this._client.options.defaultImageSize}` : undefined;
    }

    toJSON() {
        const base = {};

        for (const key of [
            "avatar",
            "editCount",
            "groups",
            "since",
            "status",
            "username"
        ]) {
            base[key] = this[key];
        }

        return base;
    }
}

module.exports = User;