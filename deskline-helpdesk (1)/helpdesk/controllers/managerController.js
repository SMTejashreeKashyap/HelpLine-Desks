const Ticket = require('../models/Ticket');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Shared aggregation: per-agent open ticket count + average resolution
// time (in hours) for tickets that agent has resolved.
async function computeWorkload(matchAgentId) {
  const agentFilter = { role: 'agent' };
  if (matchAgentId) agentFilter._id = matchAgentId;
  const agents = await User.find(agentFilter).select('name email');

  const stats = await Ticket.aggregate([
    { $match: matchAgentId ? { assignedAgentId: matchAgentId } : { assignedAgentId: { $ne: null } } },
    {
      $group: {
        _id: '$assignedAgentId',
        openCount: {
          $sum: { $cond: [{ $in: ['$status', ['Open', 'In Progress', 'On Hold']] }, 1, 0] },
        },
        resolvedDurationsMs: {
          $push: {
            $cond: [
              { $ne: ['$resolvedAt', null] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              '$$REMOVE',
            ],
          },
        },
        totalTickets: { $sum: 1 },
      },
    },
  ]);

  const statsByAgent = new Map(stats.map((s) => [String(s._id), s]));

  return agents.map((agent) => {
    const s = statsByAgent.get(String(agent._id));
    const durations = s?.resolvedDurationsMs || [];
    const avgHours = durations.length
      ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 3600000
      : 0;

    return {
      agentId: agent._id,
      name: agent.name,
      email: agent.email,
      openTicketCount: s?.openCount || 0,
      totalAssigned: s?.totalTickets || 0,
      avgResolutionHours: Math.round(avgHours * 10) / 10,
    };
  });
}

// GET /api/manager/agents/workload — Module 12 (manager view of all agents)
const getAllAgentWorkload = asyncHandler(async (req, res) => {
  const data = await computeWorkload(null);
  res.status(200).json({ success: true, message: 'Agent workload retrieved', data });
});

// GET /api/agents/me/workload — Module 12 (agent's own dashboard)
const getMyWorkload = asyncHandler(async (req, res) => {
  const [data] = await computeWorkload(req.user._id);
  res.status(200).json({
    success: true,
    message: 'Workload retrieved',
    data: data || { openTicketCount: 0, totalAssigned: 0, avgResolutionHours: 0 },
  });
});

// GET /api/manager/reports/sla — Module 13: Manager Reports & Analytics
const getSlaReport = asyncHandler(async (req, res) => {
  const totalTickets = await Ticket.countDocuments();

  const resolvedOrClosed = await Ticket.find({
    status: { $in: ['Resolved', 'Closed'] },
  }).select('resolvedAt slaDueAt');

  const withinSla = resolvedOrClosed.filter(
    (t) => t.resolvedAt && t.resolvedAt <= t.slaDueAt
  ).length;
  const complianceRate = resolvedOrClosed.length
    ? Math.round((withinSla / resolvedOrClosed.length) * 1000) / 10
    : null;

  // Ticket volume trend: tickets created per day, last 14 days.
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const volumeTrend = await Ticket.aggregate([
    { $match: { createdAt: { $gte: fourteenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const categoryBreakdown = await Ticket.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    message: 'SLA report generated',
    data: {
      totalTickets,
      resolvedOrClosedCount: resolvedOrClosed.length,
      slaComplianceRatePercent: complianceRate,
      ticketVolumeTrend: volumeTrend.map((v) => ({ date: v._id, count: v.count })),
      categoryBreakdown: categoryBreakdown.map((c) => ({ category: c._id, count: c.count })),
    },
  });
});

// GET /api/manager/agents — helper for assignment dropdowns in the UI
const listAgents = asyncHandler(async (req, res) => {
  const agents = await User.find({ role: 'agent' }).select('name email');
  res.status(200).json({ success: true, message: 'Agents retrieved', data: agents });
});

module.exports = { getAllAgentWorkload, getMyWorkload, getSlaReport, listAgents };
