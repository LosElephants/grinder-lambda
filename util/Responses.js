module.exports.succeed = (data) => {
    return {
        statusCode: 200,
        body: JSON.stringify(data),
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    };
}

module.exports.error = (err, code) => {
    return {
        statusCode: code || 500,
        body: JSON.stringify({
            error: err
        })
    }
}

module.exports.badRequest = (msg) => {
    return error(msg, 400);
}

module.exports.unauthorized = module.exports.error("Unauthorized", 401);