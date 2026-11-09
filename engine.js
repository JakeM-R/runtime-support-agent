// Routing engine. Pure functions, no network. Used by the page and by tests (node).
(function (root) {
  const RULES = [
    { id: "exec", label: "Exec senders (CEO, COO, CFO…) always go to a person", test: (s) => s.exec, reason: "Exec sender" },
    { id: "money", label: "Money movement or an agent acting without approval", test: (s) => s.moneyMovement || s.agentUnapproved, reason: "Money movement / agent acted without approval" },
    { id: "security", label: "Security, compliance and data requests", test: (s) => s.security, reason: "Security or compliance request" },
    { id: "bug", label: "Production bugs and outages", test: (s) => s.productionBug, reason: "Production bug" },
    { id: "billing", label: "Billing disputes", test: (s) => s.billingDispute, reason: "Billing dispute" },
    { id: "churn", label: "Renewal or churn language", test: (s) => s.churn, reason: "Renewal or churn language" }
  ];

  const DEFAULTS = { threshold: 0.8, rules: { exec: true, money: true, security: true, bug: true, billing: true, churn: true } };

  // run: { category, confidence, kb, signals, productTag }
  function route(run, settings) {
    const st = settings || DEFAULTS;
    const s = run.signals;
    const reasons = [];
    for (const r of RULES) if (st.rules[r.id] && r.test(s)) reasons.push(r.reason);
    if (run.category === "access" && !s.adminVerified) reasons.push("Access request from a sender who isn't a verified admin");
    if (run.category === "how-to" && !run.kb) reasons.push("No help article to cite");
    if (run.confidence < st.threshold) reasons.push(`Confidence ${run.confidence.toFixed(2)} is below ${st.threshold.toFixed(2)}`);
    return {
      route: reasons.length ? "approval" : "auto",
      reasons,
      engineering: run.productTag === "bug" || !!s.productionBug,
      feedback: run.productTag === "feature"
    };
  }

  // ---- Rules-only classifier for pasted tickets (no model) ----
  const has = (re, t) => re.test(t);
  function classify(fromRole, text, kb) {
    const t = (text || "").toLowerCase();
    const role = (fromRole || "").toLowerCase();
    const signals = {
      exec: has(/\b(ceo|coo|cfo|cto|cro|cco|chief|founder|president)\b/, role),
      moneyMovement: has(/\b(refunds?|chargebacks?|ach|wires?|payouts?|reserves?|funds|reversed?|reversal|ledger entr|money)\b/, t) && has(/\b(closed|issued|sent|moved|posted|reverse|reversed|went to|without|wrong|released)\b/, t),
      agentUnapproved: has(/(without (any )?(approval|sign-?off)|nobody approved|no one approved|didn'?t approve|unauthori[sz]ed)/, t),
      security: has(/(soc ?2|iso ?27001|pen ?test|penetration|data residency|\bdpa\b|gdpr|vendor (review|assessment)|security questionnaire|breach|api keys?|credentials|password|ignore (your|all|previous|the)[^.]{0,20}(rules|instructions)|other customers'? data)/, t),
      productionBug: has(/(timing out|timed? ?out|timeout|\berrors?\b|failing|failed|outage|\bdown\b|\b5\d\d\b|crash|cited the wrong|wrong (merchant|value|id|mid)|incorrect|not working|stuck runs?)/, t),
      billingDispute: has(/(invoice|billing|billed|charged|overcharg|credit note)/, t) && has(/(wrong|extra|incorrect|shouldn'?t|dispute|overcharg|correct it|too many|refund)/, t),
      churn: has(/(renewal|cancel|terminate|alternatives|other vendors|reviewing (all )?vendors|switch(ing)? (to|providers)|churn)/, t),
      adminVerified: false
    };
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    const vague = wordCount < 8 && !has(/(how|where|can|invoice|soc|sftp|approv|invite|error|timeout)/, t);

    // help article match
    let best = null, bestScore = 0;
    for (const a of kb) {
      const score = a.keys.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
      if (score > bestScore) { best = a; bestScore = score; }
    }

    const isHowTo = has(/(how (do|can|to|would)|where (do|can|is)|is it possible|can (the agent|it|i|we)|is there a way)/, t);
    const isFeature = has(/(would love|feature request|could you add|on the roadmap|roadmap|it would be great if|any plans)/, t);
    const isAccess = has(/\b(invite|add (them|him|her|\w+ analysts?|new)|give access|access for|new (analyst|hire|member)s?)\b/, t);

    let category = "general";
    if (vague) category = "unclear";
    else if (signals.security) category = "security";
    else if (signals.agentUnapproved || signals.moneyMovement) category = "incident";
    else if (signals.productionBug) category = "bug";
    else if (signals.billingDispute) category = "billing";
    else if (isFeature) category = "feature";
    else if (isAccess) category = "access";
    else if (isHowTo) category = "how-to";

    const kbId = bestScore >= 1 && category !== "general" && category !== "unclear" ? best.id : null;
    let confidence = 0.7;
    if (category === "unclear") confidence = 0.9;
    else if (category === "feature") confidence = 0.86;
    else if (category === "how-to") confidence = kbId ? (bestScore >= 2 ? 0.88 : 0.82) : 0.5;
    else if (category === "access") confidence = 0.9;
    else if (category === "general") confidence = 0.55;

    const productTag = category === "bug" || (category === "incident" && signals.productionBug) ? "bug" : category === "feature" ? "feature" : null;
    return { category, confidence, kb: kbId, signals, productTag, kbScore: bestScore };
  }

  const api = { RULES, DEFAULTS, route, classify };
  if (typeof module !== "undefined") module.exports = api; else root.Engine = api;
})(this);
