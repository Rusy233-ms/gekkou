const request = require("request-promise-native");
const jar = request.jar();

function RequestHandler (method, uri, qs = {}, form = {}, headers = "", json = false) {
    return request({
        uri: uri,
        method: method,
        headers: headers,
		qs: qs,
		form: form,
        jar,
		json: json
    })
}

module.exports = RequestHandler;