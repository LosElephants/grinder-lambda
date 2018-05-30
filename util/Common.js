var request = require('request');

module.exports.authenticate = (auth, callback) => {
    var options = {
        url: 'https://grinder.auth0.com/userinfo',
        headers: {
            'Authorization': auth
        }
    };

    request(options, (error, response, body) => {
        if (error || response.statusCode != 200) {
            callback(error);
        } else {
            callback(null, JSON.parse(body));
        }
    });
}