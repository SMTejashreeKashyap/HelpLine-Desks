const express = require('express');
const {
  createSlaRule,
  listSlaRules,
  updateSlaRule,
  deleteSlaRule,
} = require('../controllers/slaController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSlaRuleSchema, updateSlaRuleSchema } = require('../validators/slaValidators');

const router = express.Router();

router.use(protect);

router.get('/', listSlaRules);
router.post('/', authorize('manager'), validate(createSlaRuleSchema), createSlaRule);
router.put('/:id', authorize('manager'), validate(updateSlaRuleSchema), updateSlaRule);
router.delete('/:id', authorize('manager'), deleteSlaRule);

module.exports = router;
