# Deskline — Customer Support Helpdesk & Ticketing System

CIA-3 project (P14 — Customer Support Helpdesk & Ticketing System) built with **Node.js, Express, and MongoDB**. Customers raise tickets, agents resolve them against a priority-based SLA, and managers monitor compliance and workload — a smaller-scale Zendesk/Freshdesk.

## Team

| Name | Roll Number | Department | Section |
|---|---|---|---|
| _fill in_ | _fill in_ | _fill in_ | _fill in_ |
| _fill in_ | _fill in_ | _fill in_ | _fill in_ |
| _fill in_ | _fill in_ | _fill in_ | _fill in_ |

## Problem statement

Support teams need a system that turns an incoming request into a tracked, deadline-bound case: assigned to the right agent, escalated when it stalls, and reported on so a manager can see compliance before it becomes a customer complaint. Deskline models that lifecycle end-to-end — ticket creation, SLA deadlines, assignment, status workflow, escalation, and reporting — behind a role-restricted REST API.

## Tech stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose ODM
- **Auth:** JWT, bcrypt password hashing
- **Validation:** Joi
- **Frontend:** Vanilla HTML/CSS/JS (no framework), served statically by Express
- **Docs/testing:** Postman collection (`postman_collection.json`)

## Setup instructions

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env: set MONGO_URI to your local MongoDB or Atlas connection string,
# and set JWT_SECRET to a long random string

# 3. (Optional) seed demo accounts + starter SLA rules
npm run seed

# 4. Run the server
npm start        # production
npm run dev       # with nodemon, auto-restarts on file changes
```

The API and the frontend are both served from `http://localhost:5000` (or whatever `PORT` you set) — open that URL in a browser for the login screen, or point Postman at `http://localhost:5000/api`.

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Manager | manager@helpdesk.io | Manager123! |
| Agent | agent@helpdesk.io | Agent123! |
| Agent | agent2@helpdesk.io | Agent123! |
| Customer | customer@helpdesk.io | Customer123! |

## Implemented modules (13/13)

| # | Module | Where |
|---|---|---|
| 1 | User Registration & Authentication | `controllers/authController.js`, JWT + bcrypt |
| 2 | Ticket Creation Module | `controllers/ticketController.js` → `createTicket` |
| 3 | Ticket Assignment Engine | `ticketController.js` → `assignTicket` (manager only) |
| 4 | Ticket Status Workflow | `ticketController.js` → `updateStatus`, enforced transition map |
| 5 | SLA Deadline Calculation | `utils/slaCalculator.js`, uses configured `SlaRule` or sensible defaults |
| 6 | SLA Breach Flagging | `ticketController.js` → `listBreachedTickets`, `Ticket.isBreached()` |
| 7 | Comment/Reply Thread | `controllers/commentController.js` |
| 8 | Internal Notes Module | `commentController.js`, `isInternal` flag stripped for customers server-side |
| 9 | Escalation Workflow | `ticketController.js` → `escalateTicket` |
| 10 | Category & Priority Management | `controllers/slaController.js` (CRUD on `SlaRule`) |
| 11 | Customer Satisfaction Rating | `controllers/ratingController.js` |
| 12 | Agent Workload Dashboard | `controllers/managerController.js` → `getMyWorkload` / `getAllAgentWorkload` |
| 13 | Manager Reports & Analytics | `managerController.js` → `getSlaReport` |

## Actors / roles

| Role | Can do |
|---|---|
| **Customer** | Register/login, create tickets, view own tickets, reply, rate resolved/closed tickets |
| **Agent** | View/update assigned tickets, change status, add internal notes, escalate, see own workload |
| **Manager** | Everything above, plus assign tickets, configure SLA rules, view all tickets, agent workload, and reports |

## Database schema summary

| Collection | Key fields | Relationship notes |
|---|---|---|
| `users` | name, email, passwordHash, role | Referenced by tickets/comments/ratings — large, shared, updated independently |
| `tickets` | customerId, category, priority, status, assignedAgentId, slaDueAt, statusHistory[] | References `users`; embeds `statusHistory` (small, always read with the ticket) |
| `comments` | ticketId, authorId, message, isInternal | Own collection, not embedded — grows unbounded and is queried/paginated independently |
| `slaRules` | category, priority, resolutionHours | Small admin-configured lookup table, referenced by category+priority |
| `ratings` | ticketId (unique), customerId, score, comment | One per ticket, added after closure by a different actor than the ticket owner's usual flow |

**Suggested indexes:** `users.email` (unique), `tickets.customerId`, `tickets.assignedAgentId`, `tickets.status`, `comments.ticketId`, `slaRules.category+priority` (unique compound), `ratings.ticketId` (unique).

## API endpoint reference

All routes except `/api/auth/register` and `/api/auth/login` require `Authorization: Bearer <token>`.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in, receive a JWT |
| GET | `/api/auth/me` | any | Current user profile |
| POST | `/api/tickets` | customer | Create a ticket (Module 2) |
| GET | `/api/tickets` | any | List tickets in the caller's scope (`?status=`, `?category=`, `?priority=`) |
| GET | `/api/tickets/breached` | any | Tickets past their SLA deadline (Module 6) |
| GET | `/api/tickets/:id` | any (owner/assignee/manager) | Ticket detail |
| PUT | `/api/tickets/:id/assign` | manager | Assign an agent (Module 3) |
| PUT | `/api/tickets/:id/status` | agent, manager | Move ticket through its workflow (Module 4) |
| PUT | `/api/tickets/:id/escalate` | agent, manager | Escalate a ticket (Module 9) |
| POST | `/api/tickets/:id/comments` | any | Add a reply / internal note (Modules 7, 8) |
| GET | `/api/tickets/:id/comments` | any | List thread (internal notes hidden from customers) |
| POST | `/api/tickets/:id/rating` | customer | Rate a resolved/closed ticket (Module 11) |
| GET | `/api/tickets/:id/rating` | any | Read the rating |
| GET | `/api/sla-rules` | any | List SLA rules |
| POST | `/api/sla-rules` | manager | Add an SLA rule (Module 10) |
| PUT | `/api/sla-rules/:id` | manager | Update resolution hours |
| DELETE | `/api/sla-rules/:id` | manager | Remove a rule |
| GET | `/api/manager/agents` | manager | List agents |
| GET | `/api/manager/agents/workload` | manager | All-agent workload (Module 12) |
| GET | `/api/agents/me/workload` | agent | Own workload (Module 12) |
| GET | `/api/manager/reports/sla` | manager | SLA compliance, volume trend, category breakdown (Module 13) |

Sample request/response bodies and a ready-to-import collection are in `postman_collection.json`.

## Known limitations

- No email/SMS notifications — third-party integrations are out of scope per the brief.
- SLA breach detection is computed on read (no background cron job); acceptable for this project's scope since every ticket list/detail call recomputes it live.
- Frontend is a single-file vanilla JS app for clarity, not a build-tooled SPA framework.
- A single currency/locale/timezone is assumed, as scoped.

## Project structure

```
project-root/
  config/          -> db.js (MongoDB connection)
  models/          -> Mongoose schemas (one file per collection)
  routes/          -> Express route definitions, grouped by resource
  controllers/     -> business logic for each route
  validators/       -> Joi request-body schemas
  middleware/      -> auth.js (JWT verify + roles), validate.js, errorHandler.js
  utils/           -> token generation, SLA calculation, async handler, seed script
  public/          -> frontend (index.html, css/, js/)
  .env.example     -> sample environment variables (no real secrets)
  server.js        -> app entry point
  postman_collection.json
```
