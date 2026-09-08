(() => {
  'use strict';

  /* ============================================================
     State + API helper
     ============================================================ */
  const state = {
    token: localStorage.getItem('dl_token') || null,
    user: JSON.parse(localStorage.getItem('dl_user') || 'null'),
    tab: null,
    agentsCache: null,
  };

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({ success: false, message: 'Unexpected server response' }));
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Request failed');
    }
    return json.data;
  }

  function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.toggle('toast--error', isError);
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function fmtDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function caseNo(id) {
    return 'CASE-' + String(id).slice(-6).toUpperCase();
  }

  function statusClass(status) {
    return {
      'Open': 'open', 'In Progress': 'progress', 'On Hold': 'hold',
      'Resolved': 'resolved', 'Closed': 'closed',
    }[status] || 'open';
  }

  const STATUS_TRANSITIONS = {
    'Open': ['In Progress'],
    'In Progress': ['On Hold', 'Resolved'],
    'On Hold': ['In Progress'],
    'Resolved': ['Closed', 'In Progress'],
    'Closed': [],
  };

  /* ============================================================
     Login screen
     ============================================================ */
  function initLogin() {
    document.getElementById('stub-random').textContent =
      String(Math.floor(100000 + Math.random() * 899999));

    document.querySelectorAll('.auth-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach((b) => b.classList.remove('is-active'));
        tabBtn.classList.add('is-active');
        const target = tabBtn.dataset.tab;
        document.getElementById('form-signin').hidden = target !== 'signin';
        document.getElementById('form-signup').hidden = target !== 'signup';
      });
    });

    document.querySelectorAll('.demo-box__row').forEach((row) => {
      row.addEventListener('click', () => {
        document.querySelector('.auth-tab[data-tab="signin"]').click();
        const form = document.getElementById('form-signin');
        form.email.value = row.dataset.demo;
        form.password.value = row.dataset.pass;
      });
    });

    document.getElementById('form-signin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('signin-error');
      errEl.textContent = '';
      const form = e.target;
      try {
        const data = await api('/auth/login', {
          method: 'POST',
          body: { email: form.email.value.trim(), password: form.password.value },
        });
        loginSuccess(data);
      } catch (err) {
        errEl.textContent = err.message;
      }
    });

    document.getElementById('form-signup').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('signup-error');
      errEl.textContent = '';
      const form = e.target;
      try {
        const data = await api('/auth/register', {
          method: 'POST',
          body: {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            password: form.password.value,
            role: form.role.value,
          },
        });
        loginSuccess(data);
      } catch (err) {
        errEl.textContent = err.message;
      }
    });
  }

  function loginSuccess({ user, token }) {
    state.token = token;
    state.user = user;
    localStorage.setItem('dl_token', token);
    localStorage.setItem('dl_user', JSON.stringify(user));
    showApp();
  }

  function signOut() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('dl_token');
    localStorage.removeItem('dl_user');
    document.getElementById('view-app').hidden = true;
    document.getElementById('view-login').hidden = false;
  }

  /* ============================================================
     App shell
     ============================================================ */
  const TABS_BY_ROLE = {
    customer: [
      { key: 'my-tickets', label: 'My tickets' },
      { key: 'new-ticket', label: 'New ticket' },
    ],
    agent: [
      { key: 'assigned', label: 'Assigned tickets' },
      { key: 'workload', label: 'My workload' },
    ],
    manager: [
      { key: 'all-tickets', label: 'All tickets' },
      { key: 'sla-rules', label: 'SLA rules' },
      { key: 'agent-workload', label: 'Agent workload' },
      { key: 'reports', label: 'Reports' },
    ],
  };

  function showApp() {
    document.getElementById('view-login').hidden = true;
    document.getElementById('view-app').hidden = false;
    document.getElementById('user-role').textContent = state.user.role;
    document.getElementById('user-name').textContent = state.user.name;

    const tabsEl = document.getElementById('app-tabs');
    tabsEl.innerHTML = '';
    const tabs = TABS_BY_ROLE[state.user.role];
    tabs.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (i === 0 ? ' is-active' : '');
      btn.textContent = t.label;
      btn.type = 'button';
      btn.addEventListener('click', () => setTab(t.key));
      btn.dataset.key = t.key;
      tabsEl.appendChild(btn);
    });
    setTab(tabs[0].key);
  }

  function setTab(key) {
    state.tab = key;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.key === key));
    const renderers = {
      'my-tickets': renderCustomerTickets,
      'new-ticket': renderNewTicketForm,
      'assigned': renderAgentTickets,
      'workload': renderMyWorkload,
      'all-tickets': renderAllTickets,
      'sla-rules': renderSlaRules,
      'agent-workload': renderAgentWorkloadOverview,
      'reports': renderReports,
    };
    (renderers[key] || (() => {}))();
  }

  document.getElementById('btn-signout').addEventListener('click', signOut);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  function content() { return document.getElementById('app-content'); }

  /* ============================================================
     Ticket list (shared renderer for customer / agent / manager)
     ============================================================ */
  function ticketLedgerHtml(tickets) {
    if (!tickets.length) {
      return `<div class="card"><div class="empty-state">No tickets here yet.</div></div>`;
    }
    const rows = tickets.map((t) => {
      const breached = t.status !== 'Closed' && new Date(t.slaDueAt) < new Date();
      return `
        <tr data-id="${t._id}">
          <td class="case-no">${caseNo(t._id)}</td>
          <td class="subject-cell">${escapeHtml(t.subject)}<span class="sub">${escapeHtml(t.category)}</span></td>
          <td><span class="priority-tag priority-tag--${t.priority.toLowerCase()}">${t.priority}</span></td>
          <td><span class="status-dot status-dot--${statusClass(t.status)}">${t.status}</span></td>
          <td>${t.assignedAgentId ? escapeHtml(t.assignedAgentId.name) : '<span class="muted">Unassigned</span>'}</td>
          <td>${breached ? '<span class="breach-flag">Breached</span>' : `<span class="muted">${fmtDate(t.slaDueAt)}</span>`}</td>
        </tr>`;
    }).join('');

    return `
      <table class="ledger">
        <thead><tr>
          <th>Case</th><th>Subject</th><th>Priority</th><th>Status</th><th>Agent</th><th>SLA due</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function attachRowHandlers() {
    document.querySelectorAll('.ledger tbody tr').forEach((row) => {
      row.addEventListener('click', () => openTicketDetail(row.dataset.id));
    });
  }

  async function renderCustomerTickets() {
    content().innerHTML = `<div class="panel-head"><h2>My tickets</h2></div><div id="list-slot">Loading…</div>`;
    try {
      const tickets = await api('/tickets');
      document.getElementById('list-slot').innerHTML = ticketLedgerHtml(tickets);
      attachRowHandlers();
    } catch (err) { toast(err.message, true); }
  }

  async function renderAgentTickets() {
    content().innerHTML = `<div class="panel-head"><h2>Assigned tickets</h2></div><div id="list-slot">Loading…</div>`;
    try {
      const tickets = await api('/tickets');
      document.getElementById('list-slot').innerHTML = ticketLedgerHtml(tickets);
      attachRowHandlers();
    } catch (err) { toast(err.message, true); }
  }

  async function renderAllTickets() {
    content().innerHTML = `
      <div class="panel-head">
        <h2>All tickets</h2>
        <div class="panel-head__meta">
          <select id="filter-status" class="filter-select">
            <option value="">All statuses</option>
            <option>Open</option><option>In Progress</option><option>On Hold</option><option>Resolved</option><option>Closed</option>
          </select>
        </div>
      </div>
      <div id="list-slot">Loading…</div>`;
    const load = async () => {
      const status = document.getElementById('filter-status').value;
      const tickets = await api(`/tickets${status ? `?status=${encodeURIComponent(status)}` : ''}`);
      document.getElementById('list-slot').innerHTML = ticketLedgerHtml(tickets);
      attachRowHandlers();
    };
    document.getElementById('filter-status').addEventListener('change', () => load().catch((e) => toast(e.message, true)));
    try { await load(); } catch (err) { toast(err.message, true); }
  }

  /* ============================================================
     New ticket form (customer)
     ============================================================ */
  function renderNewTicketForm() {
    content().innerHTML = `
      <div class="panel-head"><h2>Raise a new ticket</h2></div>
      <div class="card" style="max-width:520px">
        <form id="form-new-ticket">
          <div class="form-row"><span>Subject</span><input name="subject" required maxlength="150" placeholder="Can't log in to my account" /></div>
          <div class="form-row"><span>Category</span><input name="category" required placeholder="Login Issue, Billing, Bug Report…" /></div>
          <div class="form-row"><span>Priority</span>
            <select name="priority" required>
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div class="form-row"><span>Description</span><textarea name="description" required placeholder="What's going wrong, and since when?"></textarea></div>
          <button class="btn btn--primary" type="submit">Submit ticket</button>
        </form>
      </div>`;

    document.getElementById('form-new-ticket').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('/tickets', {
          method: 'POST',
          body: {
            subject: f.subject.value.trim(),
            category: f.category.value.trim(),
            priority: f.priority.value,
            description: f.description.value.trim(),
          },
        });
        toast('Ticket submitted');
        setTab('my-tickets');
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ============================================================
     Ticket detail modal
     ============================================================ */
  function closeModal() { document.getElementById('modal-backdrop').hidden = true; }

  async function openTicketDetail(id) {
    const backdrop = document.getElementById('modal-backdrop');
    const body = document.getElementById('modal-body');
    body.innerHTML = 'Loading…';
    backdrop.hidden = false;

    try {
      const [ticket, comments] = await Promise.all([
        api(`/tickets/${id}`),
        api(`/tickets/${id}/comments`),
      ]);
      let rating = null;
      if (['Resolved', 'Closed'].includes(ticket.status)) {
        rating = await api(`/tickets/${id}/rating`).catch(() => null);
      }
      renderTicketDetail(ticket, comments, rating);
    } catch (err) {
      body.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderTicketDetail(ticket, comments, rating) {
    const role = state.user.role;
    const breached = ticket.status !== 'Closed' && new Date(ticket.slaDueAt) < new Date();

    const historyHtml = (ticket.statusHistory || []).slice().reverse().map((h) => `
      <div class="timeline-item">
        <span class="t">${fmtDate(h.changedAt)}</span>
        <span>${escapeHtml(h.status)}${h.remarks ? ' — ' + escapeHtml(h.remarks) : ''}</span>
      </div>`).join('') || '<p class="muted">No history yet.</p>';

    const threadHtml = comments.map((c) => `
      <div class="thread-item ${c.isInternal ? 'thread-item--internal' : ''}">
        <div class="thread-item__head">
          <span><b>${escapeHtml(c.authorId?.name || 'Unknown')}</b> · ${fmtDate(c.createdAt)}</span>
          ${c.isInternal ? '<span class="internal-badge">Internal</span>' : ''}
        </div>
        <div>${escapeHtml(c.message)}</div>
      </div>`).join('') || '<p class="muted">No replies yet.</p>';

    let actionsHtml = '';

    if (role !== 'customer') {
      const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
      if (nextStatuses.length) {
        actionsHtml += `
          <div class="inline-form" id="status-form">
            <select id="status-select">${nextStatuses.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
            <button class="btn btn--small btn--primary" id="btn-update-status" type="button">Update status</button>
          </div>`;
      }
    }

    if (role === 'manager' && ticket.status !== 'Closed') {
      actionsHtml += `
        <div class="inline-form" id="assign-form">
          <select id="assign-select"><option value="">Assign agent…</option></select>
          <button class="btn btn--small" id="btn-assign" type="button">Assign</button>
        </div>`;
    }

    if (role !== 'customer' && !['Resolved', 'Closed'].includes(ticket.status)) {
      actionsHtml += `
        <div class="inline-form" id="escalate-form">
          <input id="escalate-reason" placeholder="Reason for escalation" style="min-width:220px" />
          <button class="btn btn--small btn--danger" id="btn-escalate" type="button">Escalate</button>
        </div>`;
    }

    let ratingHtml = '';
    if (role === 'customer' && ['Resolved', 'Closed'].includes(ticket.status)) {
      if (rating) {
        ratingHtml = `<p>You rated this ${rating.score}/5${rating.comment ? ' — “' + escapeHtml(rating.comment) + '”' : ''}.</p>`;
      } else {
        ratingHtml = `
          <div class="rating-stars" id="rating-stars">
            ${[1,2,3,4,5].map((n) => `<button type="button" data-n="${n}">★</button>`).join('')}
          </div>
          <div class="inline-form">
            <input id="rating-comment" placeholder="Optional comment" style="min-width:220px" />
            <button class="btn btn--small btn--primary" id="btn-submit-rating" type="button">Submit rating</button>
          </div>`;
      }
    }

    document.getElementById('modal-body').innerHTML = `
      <div class="detail-head">
        <div>
          <span class="case-no">${caseNo(ticket._id)}</span>
          <h3>${escapeHtml(ticket.subject)}</h3>
        </div>
        <span class="status-dot status-dot--${statusClass(ticket.status)}">${ticket.status}</span>
      </div>
      <div class="detail-meta">
        <span>Category: ${escapeHtml(ticket.category)}</span>
        <span>Priority: ${ticket.priority}</span>
        <span>SLA due: ${fmtDate(ticket.slaDueAt)}</span>
        ${breached ? '<span class="breach-flag">Breached</span>' : ''}
        ${ticket.escalated ? '<span class="breach-flag" style="color:#B3432D">Escalated</span>' : ''}
      </div>
      <p>${escapeHtml(ticket.description)}</p>

      <div class="action-row">${actionsHtml}</div>

      <div class="section-label">Status history</div>
      <div class="timeline">${historyHtml}</div>

      <div class="section-label">Thread</div>
      <div class="thread">${threadHtml}</div>
      <div class="inline-form">
        <input id="new-comment" placeholder="Write a reply…" style="flex:1;min-width:180px" />
        ${role !== 'customer' ? '<label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="is-internal" /> Internal note</label>' : ''}
        <button class="btn btn--small btn--primary" id="btn-send-comment" type="button">Send</button>
      </div>

      ${ratingHtml ? `<div class="section-label">Satisfaction rating</div>${ratingHtml}` : ''}
    `;

    // Wire up actions
    document.getElementById('btn-send-comment')?.addEventListener('click', async () => {
      const input = document.getElementById('new-comment');
      const message = input.value.trim();
      if (!message) return;
      const isInternal = document.getElementById('is-internal')?.checked || false;
      try {
        await api(`/tickets/${ticket._id}/comments`, { method: 'POST', body: { message, isInternal } });
        openTicketDetail(ticket._id);
      } catch (err) { toast(err.message, true); }
    });

    document.getElementById('btn-update-status')?.addEventListener('click', async () => {
      const status = document.getElementById('status-select').value;
      try {
        await api(`/tickets/${ticket._id}/status`, { method: 'PUT', body: { status } });
        toast('Status updated');
        openTicketDetail(ticket._id);
        refreshCurrentTab();
      } catch (err) { toast(err.message, true); }
    });

    document.getElementById('btn-escalate')?.addEventListener('click', async () => {
      const reason = document.getElementById('escalate-reason').value.trim();
      if (!reason) return toast('Give a reason to escalate', true);
      try {
        await api(`/tickets/${ticket._id}/escalate`, { method: 'PUT', body: { reason } });
        toast('Ticket escalated');
        openTicketDetail(ticket._id);
        refreshCurrentTab();
      } catch (err) { toast(err.message, true); }
    });

    if (document.getElementById('assign-select')) {
      loadAgentsIntoSelect(document.getElementById('assign-select'));
      document.getElementById('btn-assign').addEventListener('click', async () => {
        const agentId = document.getElementById('assign-select').value;
        if (!agentId) return toast('Choose an agent first', true);
        try {
          await api(`/tickets/${ticket._id}/assign`, { method: 'PUT', body: { agentId } });
          toast('Ticket assigned');
          openTicketDetail(ticket._id);
          refreshCurrentTab();
        } catch (err) { toast(err.message, true); }
      });
    }

    if (document.getElementById('rating-stars')) {
      let chosen = 0;
      const stars = document.querySelectorAll('#rating-stars button');
      stars.forEach((btn) => {
        btn.addEventListener('click', () => {
          chosen = Number(btn.dataset.n);
          stars.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.n) <= chosen));
        });
      });
      document.getElementById('btn-submit-rating').addEventListener('click', async () => {
        if (!chosen) return toast('Pick a star rating first', true);
        try {
          await api(`/tickets/${ticket._id}/rating`, {
            method: 'POST',
            body: { score: chosen, comment: document.getElementById('rating-comment').value.trim() },
          });
          toast('Thanks for the rating');
          openTicketDetail(ticket._id);
        } catch (err) { toast(err.message, true); }
      });
    }
  }

  async function loadAgentsIntoSelect(selectEl) {
    try {
      if (!state.agentsCache) state.agentsCache = await api('/manager/agents');
      state.agentsCache.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a._id;
        opt.textContent = `${a.name} (${a.email})`;
        selectEl.appendChild(opt);
      });
    } catch (err) { /* non-fatal */ }
  }

  function refreshCurrentTab() {
    const renderers = {
      'my-tickets': renderCustomerTickets, 'assigned': renderAgentTickets, 'all-tickets': renderAllTickets,
    };
    (renderers[state.tab] || (() => {}))();
  }

  /* ============================================================
     Agent workload (self) + manager overview + SLA rules + reports
     ============================================================ */
  async function renderMyWorkload() {
    content().innerHTML = `<div class="panel-head"><h2>My workload</h2></div><div id="wl-slot">Loading…</div>`;
    try {
      const d = await api('/agents/me/workload');
      document.getElementById('wl-slot').innerHTML = `
        <div class="grid-3">
          <div class="card stat-card"><div class="stat-card__label">Open tickets</div><div class="stat-card__value">${d.openTicketCount}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Total assigned</div><div class="stat-card__value">${d.totalAssigned}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Avg resolution</div><div class="stat-card__value">${d.avgResolutionHours}h</div></div>
        </div>`;
    } catch (err) { toast(err.message, true); }
  }

  async function renderAgentWorkloadOverview() {
    content().innerHTML = `<div class="panel-head"><h2>Agent workload</h2></div><div id="wl-slot">Loading…</div>`;
    try {
      const rows = await api('/manager/agents/workload');
      document.getElementById('wl-slot').innerHTML = `
        <table class="ledger">
          <thead><tr><th>Agent</th><th>Open</th><th>Total assigned</th><th>Avg resolution</th></tr></thead>
          <tbody>${rows.map((r) => `
            <tr><td>${escapeHtml(r.name)}<span class="sub" style="display:block;font-size:11.5px;color:var(--muted)">${escapeHtml(r.email)}</span></td>
            <td>${r.openTicketCount}</td><td>${r.totalAssigned}</td><td>${r.avgResolutionHours}h</td></tr>`).join('')}</tbody>
        </table>`;
    } catch (err) { toast(err.message, true); }
  }

  async function renderSlaRules() {
    content().innerHTML = `
      <div class="panel-head"><h2>SLA rules</h2></div>
      <div class="grid-2">
        <div id="rules-slot">Loading…</div>
        <div class="card">
          <div class="section-label" style="margin-top:0">Add a rule</div>
          <form id="form-new-rule">
            <div class="form-row"><span>Category</span><input name="category" required /></div>
            <div class="form-row"><span>Priority</span>
              <select name="priority"><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select>
            </div>
            <div class="form-row"><span>Resolution hours</span><input name="resolutionHours" type="number" min="1" required /></div>
            <button class="btn btn--primary btn--small" type="submit">Add rule</button>
          </form>
        </div>
      </div>`;

    const loadRules = async () => {
      const rules = await api('/sla-rules');
      document.getElementById('rules-slot').innerHTML = `
        <table class="ledger">
          <thead><tr><th>Category</th><th>Priority</th><th>Hours</th><th></th></tr></thead>
          <tbody>${rules.map((r) => `
            <tr><td>${escapeHtml(r.category)}</td><td>${r.priority}</td><td>${r.resolutionHours}h</td>
            <td><button class="btn btn--small btn--ghost" data-del="${r._id}" type="button">Remove</button></td></tr>`).join('') ||
            `<tr><td colspan="4" class="empty-state">No rules configured — defaults apply.</td></tr>`}</tbody>
        </table>`;
      document.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try { await api(`/sla-rules/${btn.dataset.del}`, { method: 'DELETE' }); loadRules(); }
          catch (err) { toast(err.message, true); }
        });
      });
    };

    document.getElementById('form-new-rule').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('/sla-rules', {
          method: 'POST',
          body: { category: f.category.value.trim(), priority: f.priority.value, resolutionHours: Number(f.resolutionHours.value) },
        });
        f.reset();
        toast('SLA rule added');
        loadRules();
      } catch (err) { toast(err.message, true); }
    });

    try { await loadRules(); } catch (err) { toast(err.message, true); }
  }

  async function renderReports() {
    content().innerHTML = `<div class="panel-head"><h2>Reports & analytics</h2></div><div id="report-slot">Loading…</div>`;
    try {
      const r = await api('/manager/reports/sla');
      const maxCount = Math.max(1, ...r.ticketVolumeTrend.map((v) => v.count));
      document.getElementById('report-slot').innerHTML = `
        <div class="grid-3">
          <div class="card stat-card"><div class="stat-card__label">Total tickets</div><div class="stat-card__value">${r.totalTickets}</div></div>
          <div class="card stat-card"><div class="stat-card__label">SLA compliance</div><div class="stat-card__value">${r.slaComplianceRatePercent ?? '—'}${r.slaComplianceRatePercent !== null ? '%' : ''}</div></div>
          <div class="card stat-card"><div class="stat-card__label">Resolved/closed</div><div class="stat-card__value">${r.resolvedOrClosedCount}</div></div>
        </div>

        <div class="section-label">Ticket volume — last 14 days</div>
        <div class="card">
          ${r.ticketVolumeTrend.map((v) => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12px">
              <span class="muted" style="width:70px;font-family:var(--font-mono)">${v.date}</span>
              <div style="background:var(--accent-tint);height:10px;border-radius:2px;width:${(v.count/maxCount)*100}%;min-width:4px"></div>
              <span>${v.count}</span>
            </div>`).join('') || '<p class="muted">No tickets in this window.</p>'}
        </div>

        <div class="section-label">Category breakdown</div>
        <table class="ledger">
          <thead><tr><th>Category</th><th>Tickets</th></tr></thead>
          <tbody>${r.categoryBreakdown.map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${c.count}</td></tr>`).join('')}</tbody>
        </table>`;
    } catch (err) { toast(err.message, true); }
  }

  /* ============================================================
     Utilities + bootstrap
     ============================================================ */
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  initLogin();
  if (state.token && state.user) showApp();
})();
