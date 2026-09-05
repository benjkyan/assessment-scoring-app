// Persistence layer: clients, their assessment history, and the scores
// belonging to each assessment. Everything lives in the browser's
// localStorage — there is no server, so "logging in" to a client scopes the
// UI to that record, it does not authenticate anybody.
//
// Shape:
//   { version, activeClientId, clients: [
//       { id, name, createdAt, activeAssessmentId, assessments: [
//           { id, label, createdAt, updatedAt, scores: { [skillId]: 0-5 } }
//       ] }
//   ] }

const Store = (() => {
  const KEY = "assessment-scoring-app/v1";

  function emptyData() {
    return { version: 1, activeClientId: null, clients: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.clients)) {
        return emptyData();
      }
      return parsed;
    } catch (err) {
      console.warn("Saved data unreadable; starting empty.", err);
      return emptyData();
    }
  }

  let data = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Could not save to localStorage.", err);
    }
  }

  function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function findClient(clientId) {
    return data.clients.find((c) => c.id === clientId) ?? null;
  }

  function activeClient() {
    return findClient(data.activeClientId);
  }

  function activeAssessment() {
    const client = activeClient();
    if (!client) return null;
    return client.assessments.find((a) => a.id === client.activeAssessmentId) ?? null;
  }

  // Newest first — the dropdown reads as a history.
  function assessments() {
    const client = activeClient();
    if (!client) return [];
    return [...client.assessments].sort((a, b) => b.createdAt - a.createdAt);
  }

  function clients() {
    return [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
  }

  function lastActivity(client) {
    return client.assessments.reduce((latest, a) => Math.max(latest, a.updatedAt), 0);
  }

  function addClient(name) {
    const client = {
      id: newId("client"),
      name: name.trim(),
      createdAt: Date.now(),
      activeAssessmentId: null,
      assessments: [],
    };
    data.clients.push(client);
    save();
    return client;
  }

  function openClient(clientId) {
    const client = findClient(clientId);
    if (!client) return null;
    data.activeClientId = client.id;
    // Reopen whatever was last worked on, else the most recent assessment.
    if (!client.assessments.some((a) => a.id === client.activeAssessmentId)) {
      client.activeAssessmentId = assessmentsOf(client)[0]?.id ?? null;
    }
    save();
    return client;
  }

  function assessmentsOf(client) {
    return [...client.assessments].sort((a, b) => b.createdAt - a.createdAt);
  }

  function closeClient() {
    data.activeClientId = null;
    save();
  }

  function createAssessment(label) {
    const client = activeClient();
    if (!client) return null;
    const now = Date.now();
    const assessment = {
      id: newId("asmt"),
      label: label.trim(),
      createdAt: now,
      updatedAt: now,
      scores: {},
    };
    client.assessments.push(assessment);
    client.activeAssessmentId = assessment.id;
    save();
    return assessment;
  }

  function openAssessment(assessmentId) {
    const client = activeClient();
    if (!client) return null;
    const assessment = client.assessments.find((a) => a.id === assessmentId);
    if (!assessment) return null;
    client.activeAssessmentId = assessment.id;
    save();
    return assessment;
  }

  function renameAssessment(label) {
    const assessment = activeAssessment();
    if (!assessment) return;
    assessment.label = label;
    assessment.updatedAt = Date.now();
    save();
  }

  // value is 0-5, or undefined to clear the score entirely. An unscored skill
  // has no key at all, which keeps it out of the percentage denominator.
  function setScore(skillId, value) {
    const assessment = activeAssessment();
    if (!assessment) return;
    if (typeof value === "number") {
      assessment.scores[skillId] = value;
    } else {
      delete assessment.scores[skillId];
    }
    assessment.updatedAt = Date.now();
    save();
  }

  function scores() {
    return activeAssessment()?.scores ?? {};
  }

  return {
    clients,
    addClient,
    openClient,
    closeClient,
    activeClient,
    lastActivity,
    assessments,
    createAssessment,
    openAssessment,
    renameAssessment,
    activeAssessment,
    setScore,
    scores,
  };
})();
