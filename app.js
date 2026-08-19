const STORAGE_KEY = "idea-patch-v1";
const TUTORIAL_KEY = "idea-patch-tutorial-seen";
const COLORS = ["#f6d76c", "#ff9b89", "#8bc8ea", "#c0a6ee", "#90d5ab", "#f3a6c5"];

const defaultState = {
  ideas: [],
  groups: [{ id: "inbox", name: "Inbox", color: "#f6d76c" }],
  activeGroup: "all"
};

let state = loadState();
let selectedColor = COLORS[0];
let toastTimer;
let pendingWallPosition = null;

const $ = (selector) => document.querySelector(selector);
const els = {
  ideaInput: $("#ideaInput"), tagInput: $("#tagInput"), groupSelect: $("#groupSelect"),
  addButton: $("#addButton"), voiceButton: $("#voiceButton"), searchInput: $("#searchInput"),
  filterSelect: $("#filterSelect"), groupTabs: $("#groupTabs"), ideaGrid: $("#ideaGrid"),
  emptyState: $("#emptyState"), noResults: $("#noResults"), ideaCount: $("#ideaCount"),
  ideaTemplate: $("#ideaTemplate"), toast: $("#toast"), saveState: $("#saveState"),
  helpDialog: $("#helpDialog"), groupDialog: $("#groupDialog"), doodleDialog: $("#doodleDialog"),
  backupDialog: $("#backupDialog"), newGroupName: $("#newGroupName"), colorPicks: $("#colorPicks"), doodleCanvas: $("#doodleCanvas"),
  charCount: $("#charCount"), tourOverlay: $("#tourOverlay"), tourCard: $("#tourCard"),
  ideasSection: $(".ideas-section"), placeIdeaDialog: $("#placeIdeaDialog"), placeIdeaInput: $("#placeIdeaInput"),
  placeGroupSelect: $("#placeGroupSelect"), placeTagInput: $("#placeTagInput"), placeCharCount: $("#placeCharCount")
};

const tourSteps = [
  { target: ".capture-card", title: "Catch a thought", copy: "Type anything here—or tap Speak to say it out loud." },
  { target: ".quick-fields", title: "Give it a home", copy: "Pick a group or add a short tag. You can always organize it later." },
  { target: ".ideas-section", title: "Find it again", copy: "Every idea lands here. Search or tap a group when you come back." }
];
let tourIndex = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.ideas) && Array.isArray(saved.groups)) return { ...defaultState, ...saved };
  } catch (_) {}
  return structuredClone(defaultState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveState.innerHTML = '<span class="save-dot"></span> Saved on this device';
}

function safeId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function groupById(id) { return state.groups.find(group => group.id === id) || state.groups[0]; }
function escapeText(text) { const node = document.createElement("span"); node.textContent = text; return node.innerHTML; }

function addIdea({ text, doodle = "", position = null, groupId = null, tag = null } = {}) {
  const cleanText = (text ?? els.ideaInput.value).trim();
  if (!cleanText && !doodle) {
    els.ideaInput.focus();
    showToast("Write or speak an idea first.");
    return;
  }
  state.ideas.unshift({
    id: safeId(), text: cleanText, doodle, position, groupId: groupId || els.groupSelect.value || "inbox",
    tag: (tag ?? els.tagInput.value).trim().replace(/^#/, ""), createdAt: new Date().toISOString()
  });
  els.ideaInput.value = "";
  els.tagInput.value = "";
  updateCharCount();
  saveState();
  render();
  els.ideaInput.focus();
  showToast("Idea caught! ✦");
}

function render() {
  renderGroupControls();
  ensureIdeaPositions();
  const query = els.searchInput.value.trim().toLowerCase();
  const groupFilter = els.filterSelect.value === "all" ? state.activeGroup : els.filterSelect.value;
  const visible = state.ideas.filter(idea => {
    const group = groupById(idea.groupId);
    const inGroup = groupFilter === "all" || idea.groupId === groupFilter;
    const matches = !query || `${idea.text} ${idea.tag} ${group.name}`.toLowerCase().includes(query);
    return inGroup && matches;
  });

  els.ideaCount.textContent = `${state.ideas.length} ${state.ideas.length === 1 ? "idea" : "ideas"}`;
  els.ideaGrid.replaceChildren(...visible.map(makeIdeaCard));
  const trulyEmpty = state.ideas.length === 0;
  els.emptyState.hidden = !trulyEmpty;
  els.ideaGrid.hidden = trulyEmpty;
  els.noResults.hidden = trulyEmpty || visible.length > 0;
  $("#wallHint").hidden = trulyEmpty;
  if (!trulyEmpty) requestAnimationFrame(layoutWall);
}

function ensureIdeaPositions() {
  let positioned = state.ideas.filter(idea => idea.position && Number.isFinite(idea.position.x) && Number.isFinite(idea.position.y)).length;
  let changed = false;
  const boardWidth = els.ideaGrid.clientWidth || 1000;
  const cardWidth = boardWidth < 540 ? Math.max(240, boardWidth - 24) : 270;
  const columns = Math.max(1, Math.floor((boardWidth - 20) / (cardWidth + 26)));
  state.ideas.forEach(idea => {
    if (idea.position && Number.isFinite(idea.position.x) && Number.isFinite(idea.position.y)) return;
    const slot = positioned++;
    idea.position = {
      x: 14 + (slot % columns) * (cardWidth + 28) + (slot % 2 ? 8 : 0),
      y: 18 + Math.floor(slot / columns) * 238 + (slot % 3) * 11
    };
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function layoutWall() {
  const cards = [...els.ideaGrid.querySelectorAll(".idea-card")];
  let bottom = 0;
  cards.forEach(card => {
    const idea = state.ideas.find(item => item.id === card.dataset.id);
    if (!idea) return;
    const maxX = Math.max(12, els.ideaGrid.clientWidth - card.offsetWidth - 12);
    const x = Math.max(12, Math.min(idea.position.x, maxX));
    const y = Math.max(18, idea.position.y);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    bottom = Math.max(bottom, y + card.offsetHeight + 35);
  });
  els.ideaGrid.style.minHeight = `${Math.max(window.innerWidth < 760 ? 720 : 620, bottom)}px`;
}

function renderGroupControls() {
  const currentCapture = els.groupSelect.value || "inbox";
  const currentFilter = els.filterSelect.value || "all";
  els.groupSelect.innerHTML = state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
  els.filterSelect.innerHTML = '<option value="all">All groups</option>' + state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
  els.placeGroupSelect.innerHTML = state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
  if (state.groups.some(g => g.id === currentCapture)) els.groupSelect.value = currentCapture;
  if (currentFilter === "all" || state.groups.some(g => g.id === currentFilter)) els.filterSelect.value = currentFilter;

  const allButton = makeGroupTab("all", "All", state.ideas.length);
  const groupButtons = state.groups.map(group => makeGroupTab(group.id, group.name, state.ideas.filter(i => i.groupId === group.id).length));
  const newButton = document.createElement("button");
  newButton.className = "group-tab new";
  newButton.type = "button";
  newButton.textContent = "+ New group";
  newButton.addEventListener("click", () => els.groupDialog.showModal());
  els.groupTabs.replaceChildren(allButton, ...groupButtons, newButton);
}

function makeGroupTab(id, name, count) {
  const button = document.createElement("button");
  button.className = `group-tab${state.activeGroup === id ? " active" : ""}`;
  button.type = "button";
  button.textContent = `${name} ${count}`;
  button.addEventListener("click", () => { state.activeGroup = id; els.filterSelect.value = "all"; saveState(); render(); });
  return button;
}

function makeIdeaCard(idea) {
  const fragment = els.ideaTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".idea-card");
  const group = groupById(idea.groupId);
  card.style.setProperty("--card-color", group.color);
  const tilt = ((idea.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7) - 3) * 0.35;
  card.style.setProperty("--tilt", `${tilt}deg`);
  card.dataset.id = idea.id;
  fragment.querySelector(".card-group").textContent = group.name;
  const textEl = fragment.querySelector(".card-text");
  textEl.textContent = idea.text;
  if (!idea.text) textEl.hidden = true;
  if (idea.doodle) { const image = fragment.querySelector(".card-doodle"); image.src = idea.doodle; image.hidden = false; }
  fragment.querySelector(".card-tag").textContent = idea.tag ? `#${idea.tag}` : "";
  fragment.querySelector(".card-time").textContent = relativeDate(idea.createdAt);
  const menu = fragment.querySelector(".card-menu");
  const actions = fragment.querySelector(".card-actions");
  menu.addEventListener("click", event => { event.stopPropagation(); closeMenus(actions); actions.hidden = !actions.hidden; });
  actions.addEventListener("click", event => handleCardAction(event, idea));
  card.addEventListener("pointerdown", event => startCardDrag(event, card, idea));
  return fragment;
}

function startCardDrag(event, card, idea) {
  if (event.button !== 0 || event.target.closest("button, input, select, .card-actions")) return;
  event.preventDefault();
  closeMenus();
  const boardRect = els.ideaGrid.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const offsetX = event.clientX - cardRect.left;
  const offsetY = event.clientY - cardRect.top;
  card.classList.add("dragging");
  card.setPointerCapture(event.pointerId);

  const move = moveEvent => {
    const maxX = Math.max(12, els.ideaGrid.clientWidth - card.offsetWidth - 12);
    const x = Math.max(12, Math.min(maxX, moveEvent.clientX - boardRect.left - offsetX));
    const y = Math.max(18, moveEvent.clientY - boardRect.top - offsetY);
    idea.position = { x: Math.round(x), y: Math.round(y) };
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    const neededHeight = y + card.offsetHeight + 40;
    if (neededHeight > els.ideaGrid.offsetHeight) els.ideaGrid.style.minHeight = `${neededHeight}px`;
  };

  const stop = () => {
    card.classList.remove("dragging");
    card.removeEventListener("pointermove", move);
    card.removeEventListener("pointerup", stop);
    card.removeEventListener("pointercancel", stop);
    saveState();
    layoutWall();
  };

  card.addEventListener("pointermove", move);
  card.addEventListener("pointerup", stop);
  card.addEventListener("pointercancel", stop);
}

function relativeDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function handleCardAction(event, idea) {
  const action = event.target.dataset.action;
  if (!action) return;
  if (action === "delete") {
    if (!confirm("Delete this idea?")) return;
    state.ideas = state.ideas.filter(item => item.id !== idea.id);
    showToast("Idea deleted.");
  }
  if (action === "edit") {
    const updated = prompt("Edit your idea:", idea.text);
    if (updated === null) return;
    idea.text = updated.trim();
    showToast("Idea updated.");
  }
  if (action === "move") {
    const names = state.groups.map((g, index) => `${index + 1}. ${g.name}`).join("\n");
    const choice = prompt(`Move to which group?\n${names}`, "1");
    const group = state.groups[Number(choice) - 1];
    if (!group) return;
    idea.groupId = group.id;
    showToast(`Moved to ${group.name}.`);
  }
  saveState(); render();
}

function closeMenus(except) {
  document.querySelectorAll(".card-actions").forEach(menu => { if (menu !== except) menu.hidden = true; });
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    els.voiceButton.addEventListener("click", () => showToast("Voice input isn’t supported in this browser."));
    $("#placeVoiceButton").addEventListener("click", () => showToast("Voice input isn’t supported in this browser."));
    return;
  }
  const connectVoice = (button, input, onUpdate = () => {}) => {
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    let startingText = "";
    recognition.onstart = () => { startingText = input.value; button.classList.add("listening"); button.querySelector(".voice-label").textContent = "Listening…"; };
    recognition.onresult = event => {
      const words = Array.from(event.results).map(result => result[0].transcript).join("");
      input.value = `${startingText}${startingText ? " " : ""}${words}`.slice(0, 500);
      onUpdate();
    };
    recognition.onend = () => { button.classList.remove("listening"); button.querySelector(".voice-label").textContent = "Speak"; input.focus(); };
    recognition.onerror = () => showToast("I couldn’t hear that. Try again or type it.");
    button.addEventListener("click", async () => {
      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: "microphone" });
          if (permission.state === "denied") { showToast("Microphone is blocked. Allow it in your browser’s site settings."); return; }
        }
      } catch (_) {}
      try { recognition.start(); } catch (_) {}
    });
  };
  connectVoice(els.voiceButton, els.ideaInput, updateCharCount);
  connectVoice($("#placeVoiceButton"), els.placeIdeaInput, updatePlaceCharCount);
}

function updatePlaceCharCount() {
  const count = els.placeIdeaInput.value.length;
  els.placeCharCount.value = `${count} / 500`;
  els.placeCharCount.textContent = `${count} / 500`;
}

function openPlaceIdea(event) {
  if (event.target !== els.ideaGrid) return;
  const rect = els.ideaGrid.getBoundingClientRect();
  const noteWidth = Math.min(270, Math.max(240, els.ideaGrid.clientWidth - 24));
  pendingWallPosition = {
    x: Math.round(Math.max(12, Math.min(els.ideaGrid.clientWidth - noteWidth - 12, event.clientX - rect.left - noteWidth / 2))),
    y: Math.round(Math.max(18, event.clientY - rect.top - 40))
  };
  els.placeGroupSelect.value = els.groupSelect.value || "inbox";
  els.placeIdeaInput.value = "";
  els.placeTagInput.value = "";
  updatePlaceCharCount();
  els.placeIdeaDialog.showModal();
  setTimeout(() => els.placeIdeaInput.focus(), 0);
}

function toggleWallFullscreen(enabled) {
  els.ideasSection.classList.toggle("wall-fullscreen", enabled);
  document.body.classList.toggle("wall-is-fullscreen", enabled);
  if (enabled && state.ideas.length === 0) {
    els.emptyState.hidden = true;
    els.ideaGrid.hidden = false;
    $("#wallHint").hidden = false;
  } else if (!enabled) {
    render();
  }
  setTimeout(layoutWall, 0);
}

function setupGroups() {
  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = `color-pick${index === 0 ? " selected" : ""}`;
    button.style.background = color; button.setAttribute("aria-label", `Color ${index + 1}`);
    button.addEventListener("click", () => { selectedColor = color; document.querySelectorAll(".color-pick").forEach(b => b.classList.remove("selected")); button.classList.add("selected"); });
    els.colorPicks.append(button);
  });
  $("#groupForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = els.newGroupName.value.trim();
    if (!name) return;
    const group = { id: safeId(), name, color: selectedColor };
    state.groups.push(group); saveState(); render();
    els.groupSelect.value = group.id; els.newGroupName.value = ""; els.groupDialog.close();
    showToast(`${name} group created.`);
  });
}

function setupDoodle() {
  const canvas = els.doodleCanvas;
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "#242420";
  const eraserButton = $("#doodleEraser");
  const sizeInput = $("#doodleSize");
  const sizeValue = $("#doodleSizeValue");
  const chooseDrawTool = button => {
    ctx.globalCompositeOperation = "source-over";
    eraserButton.classList.remove("selected");
    eraserButton.setAttribute("aria-pressed", "false");
    document.querySelectorAll(".doodle-color").forEach(choice => {
      const selected = choice === button;
      choice.classList.toggle("selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });
  };
  document.querySelectorAll(".doodle-color").forEach(button => {
    button.addEventListener("click", () => {
      ctx.strokeStyle = button.dataset.doodleColor;
      chooseDrawTool(button);
    });
  });
  eraserButton.addEventListener("click", () => {
    ctx.globalCompositeOperation = "destination-out";
    eraserButton.classList.add("selected");
    eraserButton.setAttribute("aria-pressed", "true");
    document.querySelectorAll(".doodle-color").forEach(choice => {
      choice.classList.remove("selected");
      choice.setAttribute("aria-pressed", "false");
    });
  });
  sizeInput.addEventListener("input", () => {
    ctx.lineWidth = Number(sizeInput.value);
    sizeValue.value = sizeInput.value;
    sizeValue.textContent = sizeInput.value;
  });
  let drawing = false;
  const point = event => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
  canvas.addEventListener("pointerdown", event => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener("pointermove", event => { if (!drawing) return; const p = point(event); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener("pointerup", () => drawing = false);
  $("#clearDoodle").addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  $("#saveDoodle").addEventListener("click", () => { addIdea({ text: "Doodle", doodle: canvas.toDataURL("image/png") }); ctx.clearRect(0, 0, canvas.width, canvas.height); els.doodleDialog.close(); });
}

function updateCharCount() {
  const length = els.ideaInput.value.length;
  els.charCount.value = `${length} / 500`;
  els.charCount.textContent = `${length} / 500`;
  els.charCount.classList.toggle("near-limit", length >= 450);
}

function positionTour() {
  const step = tourSteps[tourIndex];
  const target = document.querySelector(step.target);
  if (!target) return;
  document.querySelectorAll(".tour-focus").forEach(node => node.classList.remove("tour-focus"));
  target.classList.add("tour-focus");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const cardWidth = Math.min(360, window.innerWidth - 28);
    const left = Math.max(14, Math.min(window.innerWidth - cardWidth - 14, rect.left + 20));
    const cardHeight = els.tourCard.offsetHeight;
    const belowFits = rect.bottom + 18 + cardHeight < window.innerHeight;
    const top = belowFits ? rect.bottom + 18 : Math.max(14, rect.top - cardHeight - 18);
    els.tourCard.style.left = `${left}px`;
    els.tourCard.style.top = `${top}px`;
    els.tourCard.classList.toggle("above", !belowFits);
  }, 260);
}

function showTourStep() {
  const step = tourSteps[tourIndex];
  $("#tourStepLabel").textContent = `QUICK TOUR · ${tourIndex + 1} OF ${tourSteps.length}`;
  $("#tourTitle").textContent = step.title;
  $("#tourCopy").textContent = step.copy;
  $("#tourNext").textContent = tourIndex === tourSteps.length - 1 ? "Start jotting ✦" : "Next →";
  positionTour();
}

function startTour() {
  tourIndex = 0;
  els.tourOverlay.hidden = false;
  showTourStep();
}

function finishTour() {
  els.tourOverlay.hidden = true;
  document.querySelectorAll(".tour-focus").forEach(node => node.classList.remove("tour-focus"));
  localStorage.setItem(TUTORIAL_KEY, "true");
  els.ideaInput.focus();
}

function nextTourStep() {
  if (tourIndex < tourSteps.length - 1) {
    tourIndex += 1;
    showTourStep();
  } else {
    finishTour();
  }
}

function setupBackup() {
  $("#exportBackup").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `idea-patch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Backup downloaded.");
  });
  $("#importBackup").addEventListener("click", () => $("#backupFile").click());
  $("#backupFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!Array.isArray(backup.ideas) || !Array.isArray(backup.groups)) throw new Error("Invalid backup");
        state = { ...defaultState, ideas: backup.ideas, groups: backup.groups, activeGroup: "all" };
        saveState(); render(); els.backupDialog.close(); showToast("Backup restored.");
      } catch (_) { showToast("That file isn’t an Idea Patch backup."); }
    };
    reader.readAsText(file);
    event.target.value = "";
  });
}

els.addButton.addEventListener("click", () => addIdea());
els.ideaInput.addEventListener("input", updateCharCount);
els.placeIdeaInput.addEventListener("input", updatePlaceCharCount);
els.ideaGrid.addEventListener("click", openPlaceIdea);
$("#placeIdeaForm").addEventListener("submit", event => {
  event.preventDefault();
  addIdea({ text: els.placeIdeaInput.value, position: pendingWallPosition, groupId: els.placeGroupSelect.value, tag: els.placeTagInput.value });
  els.placeIdeaDialog.close();
  pendingWallPosition = null;
});
els.ideaInput.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) addIdea(); });
els.searchInput.addEventListener("input", render);
els.filterSelect.addEventListener("change", () => { state.activeGroup = "all"; render(); });
$("#emptyAddButton").addEventListener("click", () => { els.ideaInput.focus(); window.scrollTo({ top: 200, behavior: "smooth" }); });
$("#helpButton").addEventListener("click", startTour);
$("#backupButton").addEventListener("click", () => els.backupDialog.showModal());
$("#fullWallButton").addEventListener("click", () => toggleWallFullscreen(true));
$("#exitFullWall").addEventListener("click", () => toggleWallFullscreen(false));
$("#doodleButton").addEventListener("click", () => els.doodleDialog.showModal());
window.addEventListener("resize", () => { if (!els.tourOverlay.hidden) positionTour(); });
window.addEventListener("resize", () => { if (!els.ideaGrid.hidden) layoutWall(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && els.ideasSection.classList.contains("wall-fullscreen") && !document.querySelector("dialog[open]")) toggleWallFullscreen(false); });
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
document.addEventListener("click", () => closeMenus());

setupVoice(); setupGroups(); setupDoodle(); setupBackup(); updateCharCount(); render();
if (!localStorage.getItem(TUTORIAL_KEY)) setTimeout(startTour, 550);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
