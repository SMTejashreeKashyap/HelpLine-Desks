require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const SlaRule = require('../models/SlaRule');

const DEMO_USERS = [
  { name: 'Priya Manager', email: 'manager@helpdesk.io', password: 'Manager123!', role: 'manager' },
  { name: 'Arjun Agent', email: 'agent@helpdesk.io', password: 'Agent123!', role: 'agent' },
  { name: 'Divya Agent', email: 'agent2@helpdesk.io', password: 'Agent123!', role: 'agent' },
  { name: 'Sam Customer', email: 'customer@helpdesk.io', password: 'Customer123!', role: 'customer' },
];

const DEMO_SLA_RULES = [
  { category: 'Login Issue', priority: 'Urgent', resolutionHours: 2 },
  { category: 'Login Issue', priority: 'High', resolutionHours: 8 },
  { category: 'Billing', priority: 'High', resolutionHours: 12 },
  { category: 'Billing', priority: 'Medium', resolutionHours: 48 },
  { category: 'Bug Report', priority: 'Urgent', resolutionHours: 4 },
  { category: 'Bug Report', priority: 'Medium', resolutionHours: 72 },
  { category: 'Feature Request', priority: 'Low', resolutionHours: 168 },
];

async function seed() {
  await connectDB();

  for (const u of DEMO_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`Skip (exists): ${u.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
    console.log(`Created ${u.role}: ${u.email} / ${u.password}`);
  }

  for (const rule of DEMO_SLA_RULES) {
    const exists = await SlaRule.findOne({ category: rule.category, priority: rule.priority });
    if (exists) continue;
    await SlaRule.create(rule);
    console.log(`Created SLA rule: ${rule.category} / ${rule.priority} -> ${rule.resolutionHours}h`);
  }

  console.log('\nSeed complete. Demo logins:');
  DEMO_USERS.forEach((u) => console.log(`  ${u.role.padEnd(9)} ${u.email} / ${u.password}`));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
