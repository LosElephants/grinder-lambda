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

var createProfile = (authProfile, callback) => {
  var profile = newProfile(authProfile);
  this.saveProfile(profile, callback);
};

var saveProfile = (profile, callback) => {
  var docClient = this.getDynamoClient();
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
        createProfile(authProfile, (err, data) => {
          if (err) {
            callback(err);
          } else {
            callback(null, {
              statusCode: 200,
              body: JSON.stringify({ body: data.Item })
            });
          }
        });
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

module.exports.profile = (event, context, callback) => {
  if (event.userId) {
    getProfile(event.userId, callback);
  } else {
    callback(null, {
      statusCode: 400,
      body: JSON.stringify({ message: "userId is a required field" })
    });
  }
};