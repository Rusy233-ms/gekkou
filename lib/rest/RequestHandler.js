const axios = require('axios'),
	qsParser = require('qs');

function RequestHandler (method, url, qs = {}, form = {}, headers = {}, wikiaAuth = false, json = true) {
	if (wikiaAuth) headers['Cookie'] = `access_token=${this.userToken}`;
	if (!json) form = qsParser.stringify(form);
	this.logger.debug(`${method} request to: ${url}`, qs, form, headers);
	return axios({
  		method: method,
  		url: url,
  		params: qs,
  		data: form,
  		headers: headers
  	});
}

module.exports = RequestHandler;