const express = require('express');
const {
  createTicket,
  listTickets,
  listBreachedTickets,
  getTicket,
  assignTicket,
  updateStatus,
  escalateTicket,
} = require('../controllers/ticketController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createTicketSchema,
  assignTicketSchema,
  updateStatusSchema,
  escalateSchema,
} = require('../validators/ticketValidators');
const commentRoutes = require('./commentRoutes');
const ratingRoutes = require('./ratingRoutes');

const router = express.Router();

router.use(protect);

router.post('/', authorize('customer'), validate(createTicketSchema), createTicket);
router.get('/', listTickets);
router.get('/breached', listBreachedTickets);
router.get('/:id', getTicket);
router.put('/:id/assign', authorize('manager'), validate(assignTicketSchema), assignTicket);
router.put('/:id/status', authorize('agent', 'manager'), validate(updateStatusSchema), updateStatus);
router.put('/:id/escalate', authorize('agent', 'manager'), validate(escalateSchema), escalateTicket);

// Module 7/8: comment + internal-note thread, nested under a ticket
router.use('/:id/comments', commentRoutes);
// Module 11: satisfaction rating, nested under a ticket
router.use('/:id/rating', ratingRoutes);

module.exports = router;
