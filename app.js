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

// Two denominators, because they answer different questions:
//   max           — every skill in the catalog, whether or not it was scored.
//   applicableMax — only the skills actually scored on this occasion.
// A skill left on "–" was not administered, so counting it against the client
// understates performance. Percentages should use applicableMax.
function subdomainTotal(subdomain) {
  const scores = Store.scores();
  let earned = 0;
  let max = 0;
  let applicableMax = 0;
  for (const skill of subdomain.skills) {
    max += skillMax();
    const score = scores[skill.id];
    if (typeof score === "number") {
      earned += score;
      applicableMax += skillMax();
    }
  }
  return { earned, max, applicableMax };
}

function domainTotal(domain) {
  let earned = 0;
  let max = 0;
  let applicableMax = 0;
  for (const sub of domain.subdomains) {
    const t = subdomainTotal(sub);
    earned += t.earned;
    max += t.max;
    applicableMax += t.applicableMax;
  }
  return { earned, max, applicableMax };
}

function percent(earned, max) {
  if (max === 0) return "—";
  return `${Math.round((earned / max) * 100)}%`;
}

// --- stoplight ramp ----------------------------------------------------
// One colour scale, shared by the dashboard percentages and the score
// dropdowns: 0 is red, the midpoint is amber, the top of the scale is green.
// The amber stop is explicit because a straight red-to-green blend passes
// through a muddy olive right where most scores land.

const RAMP_STOPS = [
  { at: 0, rgb: [200, 60, 45] }, // red
  { at: 0.5, rgb: [214, 158, 46] }, // amber
  { at: 1, rgb: [36, 141, 78] }, // green
];

function rampRGB(ratio) {
  const t = Math.min(Math.max(ratio, 0), 1);
  let lo = RAMP_STOPS[0];
  let hi = RAMP_STOPS[RAMP_STOPS.length - 1];
  for (let i = 0; i < RAMP_STOPS.length - 1; i++) {
    if (t >= RAMP_STOPS[i].at && t <= RAMP_STOPS[i + 1].at) {
      lo = RAMP_STOPS[i];
      hi = RAMP_STOPS[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const k = (t - lo.at) / span;
  return lo.rgb.map((c, i) => Math.round(c + (hi.rgb[i] - c) * k));
}

// darken: 0 is the ramp colour itself, 1 is black. Text sitting on a tint
// needs a step or two of darkening to stay readable, amber most of all.
function rampColor(ratio, darken = 0) {
  const [r, g, b] = rampRGB(ratio).map((c) => Math.round(c * (1 - darken)));
  return `rgb(${r}, ${g}, ${b})`;
}

// The same hue washed toward white, for use as a background.
function rampTint(ratio, strength = 0.16) {
  const [r, g, b] = rampRGB(ratio).map((c) => Math.round(255 + (c - 255) * strength));
  return `rgb(${r}, ${g}, ${b})`;
}

function pctChipHTML(earned, max) {
  if (max === 0) return `<span class="pct pct-none">—</span>`;
  const ratio = earned / max;
  const style = `background:${rampTint(ratio)};color:${rampColor(ratio, 0.38)}`;
  return `<span class="pct" style="${style}">${Math.round(ratio * 100)}%</span>`;
}

function totalsRowHTML(name, { earned, max, applicableMax }) {
  return `
    <span class="domain-total-name">${name}</span>
    <span class="domain-total-figures">
      <span class="applicable"><strong>${earned} / ${applicableMax}</strong> applicable
        ${pctChipHTML(earned, applicableMax)}</span>
      <span class="overall">${earned} / ${max} total
        <span class="pct pct-plain">${percent(earned, max)}</span></span>
    </span>
  `;
}

function renderDashboard() {
  const el = document.getElementById("domain-totals");
  el.innerHTML = "";

  const overall = { earned: 0, max: 0, applicableMax: 0 };

  for (const domain of state.catalog.domains) {
    const totals = domainTotal(domain);
    overall.earned += totals.earned;
    overall.max += totals.max;
    overall.applicableMax += totals.applicableMax;

    const row = document.createElement("div");
    row.className = "domain-total-row";
    row.innerHTML = totalsRowHTML(domain.name, totals);
    el.appendChild(row);
  }

  const totalRow = document.createElement("div");
  totalRow.className = "domain-total-row grand-total";
  totalRow.innerHTML = totalsRowHTML("All domains", overall);
  el.appendChild(totalRow);
}

// "–" (not administered) stays neutral grey; 0-5 ride the same red-to-green
// ramp as the dashboard, so a column of dropdowns reads at a glance.
function scoreStyle(score) {
  if (typeof score !== "number") return "background:#f3f3f3;color:#777;border-color:#ddd";
  const ratio = score / skillMax();
  return `background:${rampTint(ratio, 0.22)};color:${rampColor(ratio, 0.42)};border-color:${rampColor(ratio, 0.05)}`;
}

// Called on every change as well as on render — the select carries the colour
// of whatever is currently picked, so it has to be restyled in place.
function styleScoreSelect(select) {
  const value = select.value;
  select.setAttribute("style", scoreStyle(value === "" ? undefined : Number(value)));
}

function scoreSelectHTML(skillId) {
  const current = Store.scores()[skillId];
  const disabled = Store.activeAssessment() ? "" : "disabled";
  let options = `<option value="" style="${scoreStyle(undefined)}">–</option>`;
  for (let i = 0; i <= 5; i++) {
    const selected = current === i ? "selected" : "";
    options += `<option value="${i}" style="${scoreStyle(i)}" ${selected}>${i}</option>`;
  }
  const style = scoreStyle(typeof current === "number" ? current : undefined);
  return `<select class="score-input" data-skill-id="${skillId}" style="${style}" ${disabled}>${options}</select>`;
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

  styleScoreSelect(target);
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
  document.getElementById("export-csv").disabled = !active;

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

// --- CSV export --------------------------------------------------------
// Laid out like the clinic's scoring workbook: an identifying header block
// (client, occasion, dates), then domain subtotals, then one row per skill.

function isoDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

function buildAssessmentCSV() {
  const client = Store.activeClient();
  const assessment = Store.activeAssessment();
  if (!client || !assessment) return null;

  const scores = assessment.scores;
  const rows = [];

  rows.push(csvRow(["Client", client.name]));
  rows.push(csvRow(["Assessment", assessment.label]));
  rows.push(csvRow(["Instrument", state.catalog.instrument]));
  rows.push(csvRow(["Started", isoDate(assessment.createdAt)]));
  rows.push(csvRow(["Last edited", isoDate(assessment.updatedAt)]));
  rows.push(csvRow(["Exported", isoDate(Date.now())]));
  rows.push("");

  rows.push(csvRow(["Domain", "Score", "Applicable", "Possible"]));
  for (const domain of state.catalog.domains) {
    const { earned, max, applicableMax } = domainTotal(domain);
    rows.push(csvRow([domain.name, earned, applicableMax, max]));
  }
  rows.push("");

  rows.push(csvRow(["Domain", "Subdomain", "Skill ID", "Skill", "Score", "Possible", "Examples"]));
  for (const domain of state.catalog.domains) {
    for (const sub of domain.subdomains) {
      for (const skill of sub.skills) {
        const score = scores[skill.id];
        rows.push(
          csvRow([
            domain.name,
            sub.name,
            skill.id,
            skill.description,
            typeof score === "number" ? score : "",
            skillMax(),
            skill.examples ?? "",
          ])
        );
      }
    }
  }

  return rows.join("\r\n");
}

function exportFilename() {
  const parts = [Store.activeClient().name, Store.activeAssessment().label, isoDate(Date.now())];
  const stem = parts
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${stem}.csv`;
}

function handleExport() {
  const csv = buildAssessmentCSV();
  if (csv === null) return;

  // The BOM keeps Excel from mangling non-ASCII characters on open.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  document.getElementById("export-csv").addEventListener("click", handleExport);
  document.getElementById("catalog").addEventListener("change", handleScoreChange);

  // A reload resumes wherever the last session left off.
  if (Store.activeClient()) showAssessmentScreen();
  else showClientScreen();
}

init().catch((err) => {
  console.error(err);
  document.body.innerHTML += `<p style="color:red">Error: ${err.message}</p>`;
});
