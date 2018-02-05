const request = require("request-promise-native");
const jar = request.jar();

function RequestHandler (method, uri, qs, headers = "") {
    return request({
        uri,
        qs,
        method,
        headers,
        jar,
        "json": true
    }).catch(Promise.reject);
}

module.exports = RequestHandler;