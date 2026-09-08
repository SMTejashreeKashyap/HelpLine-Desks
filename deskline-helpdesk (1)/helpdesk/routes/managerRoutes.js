const express = require('express');
const {
  getAllAgentWorkload,
  getSlaReport,
  listAgents,
} = require('../controllers/managerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('manager'));

router.get('/agents', listAgents);
router.get('/agents/workload', getAllAgentWorkload);
router.get('/reports/sla', getSlaReport);

module.exports = router;
