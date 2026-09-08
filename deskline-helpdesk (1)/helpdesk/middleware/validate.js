const ApiError = require('../utils/ApiError');

// Generic validator: pass a Joi schema, get a middleware that validates
// req.body before any controller / business logic runs (non-functional
// requirement: validation happens before it can hit the database).
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return next(new ApiError(400, message, 'VALIDATION_ERROR'));
  }

  req.body = value;
  next();
};

module.exports = validate;
