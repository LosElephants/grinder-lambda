'use strict';

var request = require('request');

var AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-2',
});

var getDynamoClient = () => {
  return new AWS.DynamoDB.DocumentClient();
}

var newProfile = (authProfile) => {
  var profile = {
    userId: authProfile.sub,
    createdDate: Date.now()
  };

  if (authProfile) {
    profile.userId = authProfile.sub;
    profile.name = authProfile.name;
    profile.picture = authProfile.picture;
    profile.locale = authProfile.locale;
    profile.email = authProfile.email;
    profile.emailVerified = authProfile.email_verified;
  }

  return profile;
};

var createProfile = (authProfile, callback, client) => {
  var profile = newProfile(authProfile);
  saveProfile(profile, callback, client);
};

var saveProfile = (profile, callback, client) => {
  console.log('saving profile', JSON.stringify(profile));
  var docClient = client || getDynamoClient();
  var putParams = {
    TableName: "UserData",
    Item: profile
  }
  docClient.put(putParams, (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, data);
    }
  });
};

var getProfile = (userId, callback, client) => {
  console.log("getting profile with userId", userId);
  var docClient = client || getDynamoClient();
  var getParams = {
    TableName: "UserData",
    Key: {
      userId: userId
    }
  }
  client.get(getParams, (err, data) => {
    if (err) {
      console.log('error getting profile with id:', getParams.Key.userId);
      callback(err);
    } else {
      console.log('got profile [', getParams.Key.userId, ']', data);
      callback(null, data.Item);
    }
  });
};

var authenticate = (auth, callback) => {
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

const unauthorized = {
  statusCode: 401,
  body: JSON.stringify({ message: "Unauthorized" })
}

var badRequest = (msg) => {
  return {
    statusCode: 400,
    body: {
      message: msg || "Bad Request"
    }
  };
}

var succeed = (data) => {
  return {
    statusCode: 200,
    body: data
  };
}

var error = (err, code) => {
  return {
    statusCode: code || 500,
    body: {
      error: err
    }
  }
}

module.exports.getProfile = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, unauthorized);
  }

  callback(null, succeed(event));
  return;

  authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile) {
      callback(null, unauthorized);
    }

    var client = getDynamoClient();
    getProfile(authProfile.sub, (err, data) => {
      if (err || !data) {
        createProfile(authProfile, (err, data) => {
          if (err) {
            console.log("failure creating profile? defect or system outage");
            callback(null, error(err));
          } else {
            getProfile(authProfile.sub, (err, data) => {
              if (err) {
                console.log("failure getting profile that just got created? defect or system outage");
                callback(null, error(err));
              } else {
                callback(null, succeed(data));
              }
            }, client);
          }
        }, client);
      } else {
        callback(null, succeed(data));
      }
    }, client);
  });
};

module.exports.updateProfile = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, unauthorized);
  }

  authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile) {
      callback(null, unauthorized);
    }

    var profile = JSON.parse(event.body);
    if (!profile || !profile.userId) {
      callback(null, badRequest("userId is a required field"));
    }
    if (profile.userId !== authProfile.sub) {
      callback(null, unauthorized);
    }

    var client = getDynamoClient();

    getProfile(profile.userId, (err, data) => {
      if (err) {
        callback(err);
      } else {
        for (var key in profile) {
          data[key] = profile[key];
        }
        saveProfile(data, (err, d) => {
          if (err) {
            callback(err);
          } else {
            callback(null, succeed(data));
          }
        }, client);
      }
    }, client);
  });
};