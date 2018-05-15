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

var succeed = (data) => {
  return {
    statusCode: 200,
    body: JSON.stringify(data),
  };
}

var error = (err, code) => {
  return {
    statusCode: code || 500,
    body: JSON.stringify({
      error: err
    })
  }
}

var badRequest = (msg) => {
  return error(msg, 400);
}

const unauthorized = error("Unauthorized", 401);

module.exports.getProfile = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, unauthorized);
    return;
  }

  authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile || !authProfile.sub) {
      callback(null, unauthorized);
      return;
    }

    var client = getDynamoClient();
    getProfile(authProfile.sub, (err, data) => {
      if (err || !data) {
        createProfile(authProfile, (err, data) => {
          if (err) {
            callback(null, error(err));
            return;
          } else {
            getProfile(authProfile.sub, (err, data) => {
              if (err) {
                callback(null, error(err));
                return;
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
        callback(null, error(err));
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

module.exports.app = (event, context, callback) => {
  AWS.config.update({
    region: 'us-east-2',
  });
  var s3 = new AWS.S3();
  var params = {
    Bucket: "",
    Key: "index.html",
  }
  s3.getObject(params, function(err, data) {
    if (err) {
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({ error : err })
      })
    } else {
      let objectData = data.Body.toString('utf-8');
      callback(null, {
        statusCode: 200,
        body: objectData
      })
    }
  });
};