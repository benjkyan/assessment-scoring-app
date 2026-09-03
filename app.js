// Assessment Scoring App — minimal client-side engine.
// Loads a skill catalog (instrument > domains > subdomains > skills),
// renders it as a scoring grid, and computes rollups live.
// No build step, no framework — just fetch + DOM.

const state = {
  catalog: null,
  // scores keyed by skill id -> integer 0-5 (or undefined if unscored)
  scores: {},
};

async function loadCatalog() {
  const res = await fetch("data/sample-catalog.json");
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  state.catalog = await res.json();
}

function skillMax() {
  return 5; // 0-5 scale per skill
}

function subdomainTotal(subdomain) {
  let earned = 0;
  let max = 0;
  for (const skill of subdomain.skills) {
    max += skillMax();
    const score = state.scores[skill.id];
    if (typeof score === "number") earned += score;
  }
  return { earned, max };
}

function domainTotal(domain) {
  let earned = 0;
  let max = 0;
  for (const sub of domain.subdomains) {
    const t = subdomainTotal(sub);
    earned += t.earned;
    max += t.max;
  }
  return { earned, max };
}

function renderDashboard() {
  const el = document.getElementById("domain-totals");
  el.innerHTML = "";
  for (const domain of state.catalog.domains) {
    const { earned, max } = domainTotal(domain);
    const row = document.createElement("div");
    row.className = "domain-total-row";
    row.innerHTML = `<span>${domain.name}</span><span>${earned} / ${max}</span>`;
    el.appendChild(row);
  }
}

function scoreSelectHTML(skillId) {
  const current = state.scores[skillId];
  let options = `<option value="">–</option>`;
  for (let i = 0; i <= 5; i++) {
    const selected = current === i ? "selected" : "";
    options += `<option value="${i}" ${selected}>${i}</option>`;
  }
  return `<select class="score-input" data-skill-id="${skillId}">${options}</select>`;
}

function renderCatalog() {
  const el = document.getElementById("catalog");
  el.innerHTML = "";

  document.getElementById("instrument-name").textContent = state.catalog.instrument;

  for (const domain of state.catalog.domains) {
    const domainEl = document.createElement("div");
    domainEl.className = "domain";

    const heading = document.createElement("h3");
    heading.textContent = domain.name;
    domainEl.appendChild(heading);

    for (const sub of domain.subdomains) {
      const subEl = document.createElement("div");
      subEl.className = "subdomain";
      subEl.innerHTML = `<h4>${sub.name}</h4>`;

      for (const skill of sub.skills) {
        const row = document.createElement("div");
        row.className = "skill-row";
        row.innerHTML = `
          <div class="skill-desc">
            ${skill.description}
            <span class="skill-examples">${skill.examples ?? ""}</span>
          </div>
          ${scoreSelectHTML(skill.id)}
        `;
        subEl.appendChild(row);
      }

      domainEl.appendChild(subEl);
    }

    el.appendChild(domainEl);
  }
}

function handleScoreChange(event) {
  const target = event.target;
  if (!target.matches(".score-input")) return;

  const skillId = target.dataset.skillId;
  const value = target.value;
  state.scores[skillId] = value === "" ? undefined : Number(value);

  renderDashboard();
}

async function init() {
  await loadCatalog();
  renderDashboard();
  renderCatalog();
  document.getElementById("catalog").addEventListener("change", handleScoreChange);
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML += `<p style="color:red">Error: ${err.message}</p>`;
});
