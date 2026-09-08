const express = require('express');
const { getMyWorkload } = require('../controllers/managerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('agent'));

router.get('/me/workload', getMyWorkload);

module.exports = router;
