const express = require('express');
const { createRating, getRating } = require('../controllers/ratingController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRatingSchema } = require('../validators/ratingValidators');

const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/', authorize('customer'), validate(createRatingSchema), createRating);
router.get('/', getRating);

module.exports = router;
