const ApiError = require('../utils/ApiError');

// 404 handler for unmatched routes — forwards to the error handler so the
// response shape stays consistent with every other error.
function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

// Single place that turns any thrown/forwarded error into the consistent
// JSON error shape used across the whole API.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { statusCode, message, errorCode } = err;

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  }

  // Mongoose duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists`;
  }

  // Malformed ObjectId in a route param
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  if (!(err instanceof ApiError) && !statusCode) {
    statusCode = 500;
    errorCode = 'SERVER_ERROR';
    message = process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message;
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode || 500).json({
    success: false,
    message: message || 'Unexpected error',
    errorCode: errorCode || 'SERVER_ERROR',
  });
}

module.exports = { notFound, errorHandler };
