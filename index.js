const Client = require("./lib/Client");

function Gekkou(options) {
    return new Client(options);
}

Gekkou.Base = require("./lib/structures/Base");
Gekkou.Client = require("./lib/Client");
Gekkou.Collection = require("./lib/util/Collection");
Gekkou.Endpoints = require("./lib/rest/Endpoints");
Gekkou.Message = require("./lib/structures/Message");
Gekkou.RequestHandler = require("./lib/rest/RequestHandler");
Gekkou.Room = require("./lib/structures/Room");
Gekkou.RoomManager = require("./lib/rooming/RoomManager");
Gekkou.User = require("./lib/structures/User");

module.exports = Gekkou;