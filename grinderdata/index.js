'use strict';

var request = require('request');
var uuid = require('uuid/v4');
var common = require('../util/Common');
var responses = require('../util/Responses');
const grinderTable = "GrinderReadings"

var AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-2',
});

var getDynamoClient = () => {
  return new AWS.DynamoDB.DocumentClient();
};

var newReading = (grinderId, reading) => {
  return {
    uuid: grinderId,
    reading: reading,
    timestamp: new Date().toLocaleString()
  };
}

var firstReading = (reading) => {
  var reading = newReading();
  reading.uuid = uuid();
  return reading;
};

var getDataPoints = (grinderId, startDate, endDate, client, callback) => {
  var docClient = client || getDynamoClient();

  if (endDate <= startDate) {
    callback('endDate must come after startDate');
  }

  var getParams = {
    TableName: grinderTable,
    FilterExpression: "timestamp between :start and :end",
    ExpressionAttributeValues: {
      ":start": startDate.toLocaleString(),
      ":end": endDate.toLocaleString()
    }
  }
  docClient.get(getParams, (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, data.Item);
    }
  });
};

var saveDataPoint = (dataPoint, client, callback) => {
  var docClient = client || getDynamoClient();
  var putParams = {
    TableName: grinderTable,
    Item: dataPoint
  }
  docClient.put(putParams, (err, data) => {
    if (err) {
      callback(err);
    } else {
      callback(null, data);
    }
  });
};

module.exports.postDataPoint = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, responses.unauthorized);
  }

  common.authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile || !authProfile.sub) {
      callback(null, responses.unauthorized);
      return;
    }

    if (!event.body.reading) {
      callback(null, responses.error("reading is a required parameter"));
      return;
    }

    var dataPoint;
    if (event.body.deviceId) {
      dataPoint = event.body;
    } else {
      dataPoint = firstReading(event.body.reading);
    }

    var client = getDynamoClient();
    saveDataPoint(dataPoint, client, (err, data) => {
      if (err) {
        callback(null, responses.error(err));
      } else {
        callback(null, responses.succeed(data));
      }
    });
  });
};

module.exports.getDataPoints = (event, context, callback) => {
  if (!event.headers.Authorization) {
    callback(null, responses.unauthorized);
  }

  common.authenticate(event.headers.Authorization, (err, authProfile) => {
    if (err || !authProfile || !authProfile.sub) {
      callback(null, responses.unauthorized);
      return;
    }

    var client = getDynamoClient();
    getDataPoints(event.body.deviceId, event.body.startDate, event.body.endDate, client, (err, data) => {
      if (err) {
        callback(null, responses.error(err));
      } else {
        callback(null, responses.succeed(data));
      }
    });
  });
};