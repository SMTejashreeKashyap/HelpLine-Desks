const express = require('express');
const { addComment, listComments } = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCommentSchema } = require('../validators/commentValidators');

// mergeParams so we can read :id (ticket id) from the parent router
const router = express.Router({ mergeParams: true });

router.use(protect);

router.post('/', validate(createCommentSchema), addComment);
router.get('/', listComments);

module.exports = router;
