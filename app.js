// Assessment Scoring App — minimal client-side engine.
// Loads a skill catalog (instrument > domains > subdomains > skills),
// renders it as a scoring grid, and computes rollups live.
// No build step, no framework — just fetch + DOM.
//
// Scores belong to an assessment, and assessments belong to a client, so the
// UI has two screens: pick a client, then work inside one of that client's
// assessments. Persistence lives in store.js.

const NEW_ASSESSMENT = "__new__";

const state = {
  catalog: null,
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
  const scores = Store.scores();
  let earned = 0;
  let max = 0;
  for (const skill of subdomain.skills) {
    max += skillMax();
    const score = scores[skill.id];
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
  const current = Store.scores()[skillId];
  const disabled = Store.activeAssessment() ? "" : "disabled";
  let options = `<option value="">–</option>`;
  for (let i = 0; i <= 5; i++) {
    const selected = current === i ? "selected" : "";
    options += `<option value="${i}" ${selected}>${i}</option>`;
  }
  return `<select class="score-input" data-skill-id="${skillId}" ${disabled}>${options}</select>`;
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

  const value = target.value;
  Store.setScore(target.dataset.skillId, value === "" ? undefined : Number(value));

  renderDashboard();
  renderAssessmentMeta();
}

// --- clients -----------------------------------------------------------

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderClientScreen() {
  const list = document.getElementById("client-list");
  const clients = Store.clients();
  list.innerHTML = "";

  document.getElementById("client-list-empty").hidden = clients.length > 0;

  for (const client of clients) {
    const count = client.assessments.length;
    const detail =
      count === 0
        ? "No assessments yet"
        : `${count} assessment${count === 1 ? "" : "s"} · last edited ${formatDate(Store.lastActivity(client))}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "client-button";
    button.dataset.clientId = client.id;
    button.innerHTML = `<strong></strong><span class="client-detail"></span>`;
    button.querySelector("strong").textContent = client.name;
    button.querySelector(".client-detail").textContent = detail;

    const li = document.createElement("li");
    li.appendChild(button);
    list.appendChild(li);
  }
}

function handleClientListClick(event) {
  const button = event.target.closest(".client-button");
  if (!button) return;
  Store.openClient(button.dataset.clientId);
  showAssessmentScreen();
}

function handleNewClient(event) {
  event.preventDefault();
  const input = document.getElementById("new-client-name");
  const name = input.value.trim();
  if (!name) return;

  const client = Store.addClient(name);
  input.value = "";
  Store.openClient(client.id);
  showAssessmentScreen();
}

function handleSwitchClient() {
  Store.closeClient();
  showClientScreen();
}

// --- assessments -------------------------------------------------------

function defaultAssessmentLabel() {
  const n = Store.assessments().length + 1;
  return `Assessment ${n} — ${formatDate(Date.now())}`;
}

function optionLabel(assessment) {
  return `${assessment.label || "Untitled"} (${formatDate(assessment.createdAt)})`;
}

function renderAssessmentBar() {
  const select = document.getElementById("assessment-select");
  const active = Store.activeAssessment();
  select.innerHTML = "";

  if (!active) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— no assessments yet —";
    select.appendChild(placeholder);
  }

  for (const assessment of Store.assessments()) {
    const option = document.createElement("option");
    option.value = assessment.id;
    option.textContent = optionLabel(assessment);
    option.selected = assessment.id === active?.id;
    select.appendChild(option);
  }

  const newOption = document.createElement("option");
  newOption.value = NEW_ASSESSMENT;
  newOption.textContent = "+ New trial…";
  select.appendChild(newOption);

  const labelInput = document.getElementById("assessment-label");
  labelInput.value = active?.label ?? "";
  labelInput.disabled = !active;

  renderAssessmentMeta();
}

function renderAssessmentMeta() {
  const meta = document.getElementById("assessment-meta");
  const active = Store.activeAssessment();
  if (!active) {
    meta.textContent = "Start a new trial to begin scoring.";
    return;
  }
  const scored = Object.keys(active.scores).length;
  meta.textContent = `${scored} item${scored === 1 ? "" : "s"} scored · last edited ${formatDate(active.updatedAt)}`;
}

function handleAssessmentSelect(event) {
  const value = event.target.value;

  if (value === NEW_ASSESSMENT) {
    Store.createAssessment(defaultAssessmentLabel());
    renderAssessmentBar();
    renderDashboard();
    renderCatalog();

    // Land in the name box so the trial gets a real label straight away.
    const labelInput = document.getElementById("assessment-label");
    labelInput.focus();
    labelInput.select();
    return;
  }

  if (!value) return;

  Store.openAssessment(value);
  renderAssessmentBar();
  renderDashboard();
  renderCatalog();
}

function handleAssessmentRename(event) {
  Store.renameAssessment(event.target.value);

  const active = Store.activeAssessment();
  if (!active) return;
  const select = document.getElementById("assessment-select");
  const option = [...select.options].find((o) => o.value === active.id);
  if (option) option.textContent = optionLabel(active);
}

// --- screens -----------------------------------------------------------

function showClientScreen() {
  renderClientScreen();
  document.getElementById("client-screen").hidden = false;
  document.getElementById("assessment-screen").hidden = true;
}

function showAssessmentScreen() {
  const client = Store.activeClient();
  if (!client) return showClientScreen();

  document.getElementById("active-client-name").textContent = client.name;
  renderAssessmentBar();
  renderDashboard();
  renderCatalog();

  document.getElementById("client-screen").hidden = true;
  document.getElementById("assessment-screen").hidden = false;
}

async function init() {
  await loadCatalog();

  document.getElementById("client-list").addEventListener("click", handleClientListClick);
  document.getElementById("new-client-form").addEventListener("submit", handleNewClient);
  document.getElementById("switch-client").addEventListener("click", handleSwitchClient);
  document.getElementById("assessment-select").addEventListener("change", handleAssessmentSelect);
  document.getElementById("assessment-label").addEventListener("input", handleAssessmentRename);
  document.getElementById("catalog").addEventListener("change", handleScoreChange);

  // A reload resumes wherever the last session left off.
  if (Store.activeClient()) showAssessmentScreen();
  else showClientScreen();
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML += `<p style="color:red">Error: ${err.message}</p>`;
});
