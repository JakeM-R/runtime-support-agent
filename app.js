(function () {
  const { RULES, DEFAULTS, route, classify } = window.Engine;
  const TICKETS = window.TICKETS, RUNS = window.RUNS, KB = window.KB, EVALS = window.EVALS;
  const kbById = Object.fromEntries(KB.map((a) => [a.id, a]));

  const state = {
    settings: { threshold: DEFAULTS.threshold, rules: { ...DEFAULTS.rules } },
    selected: "T-1041",
    decisions: {},
    lastRoutes: {}
  };

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shield = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/></svg>';
  const check = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function routeFor(id) { return route(RUNS[id], state.settings); }

  function chipsFor(id, r, moved) {
    const d = state.decisions[id];
    let main;
    if (r.route === "auto") main = `<span class="chip auto${moved ? " moved" : ""}">Auto-sent</span>`;
    else if (d === "approved") main = `<span class="chip done">Approved · sent</span>`;
    else if (d === "denied") main = `<span class="chip done">Held</span>`;
    else main = `<span class="chip approval${moved ? " moved" : ""}">Needs approval</span>`;
    return main + (r.engineering ? `<span class="chip eng">→ Engineering</span>` : "") + (r.feedback ? `<span class="chip fb">Product idea</span>` : "");
  }

  function renderCounts(routes) {
    const v = Object.values(routes);
    const auto = v.filter((r) => r.route === "auto").length;
    const appr = v.length - auto;
    const eng = v.filter((r) => r.engineering).length;
    $("#counts").innerHTML =
      `<span class="count"><b>${auto}</b> auto-sent</span>` +
      `<span class="count"><b>${appr}</b> need approval</span>` +
      `<span class="count"><b>${eng}</b> to engineering</span>`;
  }

  function renderInbox() {
    const routes = {};
    for (const t of TICKETS) routes[t.id] = routeFor(t.id);
    renderCounts(routes);
    $("#inbox").innerHTML = TICKETS.map((t) => {
      const r = routes[t.id];
      const prev = state.lastRoutes[t.id];
      const moved = prev && prev !== r.route;
      return `<button class="item${t.id === state.selected ? " active" : ""}" data-id="${t.id}" aria-current="${t.id === state.selected}">
        <div class="row1"><span>${esc(t.company)} · ${esc(t.from)}</span><span>${esc(t.time)}</span></div>
        <div class="subj">${esc(t.subject)}</div>
        <div class="chips">${chipsFor(t.id, r, moved)}</div></button>`;
    }).join("");
    for (const t of TICKETS) state.lastRoutes[t.id] = routes[t.id].route;
  }

  function renderDetail() {
    const t = TICKETS.find((x) => x.id === state.selected);
    const run = RUNS[t.id];
    const r = routeFor(t.id);
    const d = state.decisions[t.id];
    const kb = run.kb ? kbById[run.kb] : null;

    const traceRows = run.trace.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("") +
      `<div class="decision"><span>Rules</span><span>${r.reasons.length ? esc(r.reasons.join(" · ")) : "none fired"}</span></div>` +
      `<div class="decision"><span>Decision</span><span>${r.route === "auto" ? "Send automatically" : "Wait for a person to approve"}${r.engineering ? " · file to engineering" : ""}${r.feedback ? " · log for product" : ""}</span></div>`;

    let outcome;
    if (r.route === "auto") {
      outcome = `<div class="sent">${check} Sent automatically at ${esc(t.time)}${kb ? " · cites " + esc(kb.id) : ""}</div>`;
    } else if (d) {
      outcome = `<div class="sent" style="${d === "denied" ? "color:var(--muted)" : ""}">${d === "approved" ? check + " Approved by you and sent" : "Held. Reply not sent"} <button class="btn-deny" data-undo="${t.id}" style="margin-left:8px;padding:3px 10px">Undo</button></div>`;
    } else {
      outcome = `<div class="approval-card">
        <div class="t">${shield} Approval needed</div>
        <div class="s">Send this reply to the ${esc(t.from)}, ${esc(t.company)}?</div>
        <ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div class="actions"><button class="btn-approve" data-approve="${t.id}">Approve</button><button class="btn-deny" data-deny="${t.id}">Deny</button></div>
      </div>`;
    }

    const eng = r.engineering && run.eng ? `<div class="section-label"><span>Filed to engineering</span></div>
      <div class="eng-card"><b>${esc(run.eng.severity)}</b> · ${esc(run.eng.summary)}<p><b>Ask:</b> ${esc(run.eng.ask)}</p><p><b>Attached:</b> ticket, agent trace, customer reply draft</p></div>` : "";
    const fb = r.feedback ? `<div class="section-label"><span>Logged for product</span></div>
      <div class="card" style="font-size:13px">${esc(t.company)} · ${esc(t.from)}: "${esc(t.subject)}". Follow-up questions asked in the reply.</div>` : "";

    $("#detail").innerHTML = `
      <div class="dhead">
        <div class="meta">${esc(t.company)} · ${esc(t.from)} · ${esc(t.channel)} · ${esc(t.time)} · ${esc(t.id)}</div>
        <h2>${esc(t.subject)}</h2>
        <div class="chips" style="margin-bottom:14px">${chipsFor(t.id, r, false)}</div>
      </div>
      <div class="body">${esc(t.body)}</div>
      <div class="section-label"><span>Agent trace</span><span>pre-run · 9 Nov 2026</span></div>
      <div class="trace">${traceRows}</div>
      <div class="section-label"><span>Drafted reply</span><span>confidence ${run.confidence.toFixed(2)}</span></div>
      <div class="draft">${esc(run.draft)}</div>
      ${outcome}${eng}${fb}`;
  }

  function renderAll() { renderInbox(); renderDetail(); }

  // ---- events: inbox + approvals ----
  $("#inbox").addEventListener("click", (e) => {
    const b = e.target.closest(".item"); if (!b) return;
    state.selected = b.dataset.id; renderAll();
    if (window.matchMedia("(max-width: 900px)").matches) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#detail").addEventListener("click", (e) => {
    const a = e.target.closest("[data-approve]"), dn = e.target.closest("[data-deny]"), u = e.target.closest("[data-undo]");
    if (a) state.decisions[a.dataset.approve] = "approved";
    else if (dn) state.decisions[dn.dataset.deny] = "denied";
    else if (u) delete state.decisions[u.dataset.undo];
    else return;
    renderAll();
  });

  // ---- controls ----
  $("#threshold").addEventListener("input", (e) => {
    state.settings.threshold = parseFloat(e.target.value);
    $("#thresholdOut").textContent = state.settings.threshold.toFixed(2);
    renderAll();
  });
  $("#rulesBtn").addEventListener("click", (e) => {
    const open = $("#rulesPanel").classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  $("#rulesGrid").innerHTML = RULES.map((r) => `<label class="toggle"><input type="checkbox" data-rule="${r.id}" checked> ${esc(r.label)}</label>`).join("");
  $("#rulesGrid").addEventListener("change", (e) => {
    const id = e.target.dataset.rule; if (!id) return;
    state.settings.rules[id] = e.target.checked; renderAll();
  });

  // ---- tabs ----
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t === tab));
    document.querySelectorAll(".tabpanel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + tab.dataset.tab));
  }));

  // ---- evals (run live on load, default rules) ----
  (function renderEvals() {
    let pass = 0;
    const rows = EVALS.map((ev) => {
      const c = classify(ev.from, ev.text, KB);
      const r = route(c, DEFAULTS);
      const ok = r.route === ev.expect; if (ok) pass++;
      const lbl = (x) => (x === "auto" ? "Auto-send" : "Approval");
      return `<tr><td class="mono">${ev.id}</td><td>${esc(ev.note)}<div class="hint">"${esc(ev.text)}"</div></td><td>${esc(ev.from)}</td><td class="mono">${lbl(ev.expect)}</td><td class="mono">${lbl(r.route)}<div class="hint">${esc(c.category)}${r.reasons.length ? " · " + esc(r.reasons[0]) : ""}</div></td><td class="${ok ? "pass" : "fail"}">${ok ? "Pass" : "Fail"}</td></tr>`;
    }).join("");
    $("#evalTable tbody").innerHTML = rows;
    $("#evalLede").textContent = `${pass} of ${EVALS.length} pass, run just now in your browser against the default rules. These cases include deliberately awkward tickets (an exec asking something simple, a prompt injection, churn hidden inside a how-to). They're a regression check written alongside the rubric, not a measure of real-world accuracy.`;
  })();

  // ---- help docs ----
  $("#docsList").innerHTML = KB.map((a) => `<div class="card"><h4>${esc(a.id)} · ${esc(a.title)}</h4><div style="font-size:14px">${esc(a.body)}</div></div>`).join("");

  // ---- try your own ticket (rules only, no model call) ----
  function renderTry(c, r) {
    const kb = c.kb ? kbById[c.kb] : null;
    const sig = Object.entries(c.signals).filter(([k, v]) => v && k !== "adminVerified").map(([k]) => k.replace(/([A-Z])/g, " $1").toLowerCase());
    let html = `<div class="chips" style="margin-bottom:10px">${r.route === "auto" ? '<span class="chip auto">Would auto-send</span>' : '<span class="chip approval">Needs approval</span>'}${r.engineering ? '<span class="chip eng">→ Engineering</span>' : ""}${r.feedback ? '<span class="chip fb">Product idea</span>' : ""}</div>
      <div class="trace">
        <div><span>Category</span><span>${esc(c.category)}</span></div>
        <div><span>Signals</span><span>${sig.length ? esc(sig.join(" · ")) : "none"}</span></div>
        <div><span>Help doc</span><span>${kb ? esc(kb.id + " · " + kb.title) : "none"}</span></div>
        <div><span>Confidence</span><span>${c.confidence.toFixed(2)} (rules estimate)</span></div>
        <div class="decision"><span>Rules</span><span>${r.reasons.length ? esc(r.reasons.join(" · ")) : "none fired"}</span></div>
        <div class="decision"><span>Decision</span><span>${r.route === "auto" ? "Send automatically" : "Wait for a person to approve"}</span></div>
      </div>
      <div class="hint" style="margin-top:6px">Uses the threshold and rule toggles currently set above the inbox.</div>`;
    $("#tryResult").innerHTML = html;
  }

  $("#tryBtn").addEventListener("click", () => {
    const from = $("#tryFrom").value.trim(), text = $("#tryText").value.trim();
    if (!text) return;
    const c = classify(from, text, KB);
    renderTry(c, route(c, state.settings));
  });

  renderAll();
})();
