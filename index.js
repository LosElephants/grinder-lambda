'use strict';

module.exports.handler = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  };

  callback(null, response);
};

module.exports.info = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Multiple functions!',
      input: event,
    }),
  };

  callback(null, response);
}

var AWS = require('aws-sdk');
AWS.config.update({
  region: process.env.AWS_DEFAULT_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

var newProfile = (userId, authProfile) => {
  var profile = {
    userId: userId,
    createdDate: Date.now()
  };

  if (authProfile) {
    for (var key in authProfile) {
      if (key === 'sub') continue;
      if (key === 'updated_at') continue;

      profile[key] = authProfile[key];
    }
  }

  return profile;
};

var createProfile = (authProfile, callback, client) => {
  var profile = newProfile(authProfile);
  saveProfile(profile, callback, client);
};

var saveProfile = (profile, callback, client) => {
  var docClient = client || getDynamoClient();
  var putParams = {
    TableName: "UserData",
    Item: profile
  }
  docClient.put(putParams, (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, data.Item);
    }
  });
};

var getProfile = (userId, callback) => {
  var client = new AWS.DynamoDB.DocumentClient({ apiVersion: process.env.DYNAMO_CLIENT_VERSION });
  var getParams = {
    TableName: "UserData",
    Key: {
      userId: userId
    }
  }
  client.get(getParams, (err, data) => {
    if (err || !data.Item || !data.Item.userId) {
      if (!data) {
        callback(err);
      } else {
        createProfile({ userId: userId }, (err, data) => {
          if (err) {
            callback(err);
          } else {
            callback(null, {
              statusCode: 200,
              body: JSON.stringify({ body: data.Item })
            });
          }
        }, client);
      }
    } else {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          body: data.Item
        })
      });
    }
  });
};

module.exports.getProfile = (event, context, callback) => {
  var qParams = event.queryStringParameters;
  if (qParams && qParams.userId) {
    getProfile(qParams.userId, callback);
  } else {
    callback(null, {
      statusCode: 400,
      body: JSON.stringify({ message: "The query string parameter 'userId' is a required field" })
    });
  }
};

module.exports.updateProfile = (event, context, callback) => {
  var profile = event.body;
  if (profile) {
    getProfile(profile.userId, (err, data) => {
      if (err) {
        callback(err);
      } else {
        for (var key in profile) {
          data[key] = profile[key];
          saveProfile(data, callback);
        }
      }
    });
  } else {
    callback("Missing request body");
  }
};