const Joi = require('joi');

const createRatingSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(500).allow('', null),
});

module.exports = { createRatingSchema };
