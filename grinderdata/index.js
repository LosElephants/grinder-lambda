'use strict';

var request = require('request');
var uuid = require('uuid/v4');
var common = require('../util/Common');
var responses = require('../util/Responses');
const grinderTable = "GrinderData"

var AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-2',
});

var getDynamoClient = () => {
  return new AWS.DynamoDB.DocumentClient();
};

var newReading = (grinderId, reading) => {
  return {
    deviceId: grinderId,
    reading: reading,
    createdDate: new Date().valueOf()
  };
}

var firstReading = (reading) => {
  var reading = newReading();
  reading.deviceId = uuid();
  return reading;
};

var getDataPoints = (grinderId, startDate, endDate, client, callback) => {
  var docClient = client || getDynamoClient();

  if (endDate <= startDate) {
    callback('endDate must come after startDate');
  }

  var queryParams = {
    TableName: grinderTable,
    KeyConditionExpression: "deviceId = :deviceId and createdDate between :start and :end",
    ExpressionAttributeValues: {
      ":start": startDate.valueOf(),
      ":end": endDate.valueOf(),
      ":deviceId": grinderId
    }
  }
  docClient.query(queryParams, (err, data) => {
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
    Item: dataPoint,
    Key: dataPoint.deviceId
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

    var body = JSON.parse(event.body);

    if (!body.reading) {
      callback(null, responses.error("reading is a required parameter"));
      return;
    }

    var dataPoint;
    if (body.deviceId) {
      dataPoint = body;
    } else {
      dataPoint = firstReading(body.reading);
    }

    var client = getDynamoClient();
    saveDataPoint(dataPoint, client, (err, data) => {
      if (err) {
        callback(null, responses.error(err));
      } else {
        callback(null, responses.succeed(dataPoint));
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

    if (!event.queryStringParameters) {
      callback(null, responses.error("deviceId is a required parameter"));
      return;
    }
    var startDate = event.queryStringParameters.startDate || new Date(0);
    var endDate = event.queryStringParameters.endDate || new Date();
    var client = getDynamoClient();
    getDataPoints(event.queryStringParameters.deviceId, startDate, endDate, client, (err, data) => {
      if (err) {
        callback(null, responses.error(err));
      } else {
        callback(null, responses.succeed(data));
      }
    });
  });
};