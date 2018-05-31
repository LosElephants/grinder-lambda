'use strict';

var request = require('request');
var responses = require('../util/Responses');
var common = require('../util/Common');

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
    profile.devices = [];
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
  docClient.get(getParams, (err, data) => {
    if (err) {
      console.log('error getting profile with id:', getParams.Key.userId);
      callback(err);
    } else {
      console.log('got profile [', getParams.Key.userId, ']', data);
      callback(null, data.Item);
    }
  });
};

module.exports.getProfile = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, responses.unauthorized);
    return;
  }

  common.authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile || !authProfile.sub) {
      callback(null, responses.unauthorized);
      return;
    }

    var client = getDynamoClient();
    getProfile(authProfile.sub, (err, data) => {
      if (err || !data) {
        createProfile(authProfile, (err, data) => {
          if (err) {
            callback(null, responses.error(err));
            return;
          } else {
            getProfile(authProfile.sub, (err, data) => {
              if (err) {
                callback(null, responses.error(err));
                return;
              } else {
                callback(null, responses.succeed(data));
              }
            }, client);
          }
        }, client);
      } else {
        callback(null, responses.succeed(data));
      }
    }, client);
  });
};

module.exports.updateProfile = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, responses.unauthorized);
  }

  common.authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile) {
      callback(null, responses.unauthorized);
    }

    var profile = JSON.parse(event.body);
    if (!profile || !profile.userId) {
      callback(null, responses.badRequest("userId is a required field"));
    }
    if (profile.userId !== authProfile.sub) {
      callback(null, responses.unauthorized);
    }

    var client = getDynamoClient();

    getProfile(profile.userId, (err, data) => {
      if (err) {
        callback(null, responses.error(err));
      } else {
        for (var key in profile) {
          data[key] = profile[key];
        }
        saveProfile(data, (err, d) => {
          if (err) {
            callback(null, responses.error(err));
          } else {
            callback(null, responses.succeed(data));
          }
        }, client);
      }
    }, client);
  });
};