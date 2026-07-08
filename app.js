/* ---------- CONFIG ---------- */
const DEFAULT_CATEGORIES = [
  { id: "devlin",       name: "Devlin Lounges",         color: "#a86b1e" },
  { id: "chesterfield", name: "Chesterfield Lounges",   color: "#8a2f2a" },
  { id: "marketing",    name: "Maximum Marketing",      color: "#2f56a3" },
  { id: "therapy",      name: "Small Business Therapy", color: "#4a7358" },
];
const SWATCHES = ["#a86b1e","#8a2f2a","#2f56a3","#4a7358","#7a4fa3","#c0632f","#2f8a8a","#9c2f6b","#5c6470","#b08d2f"];
const NAG_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const MAX_RECURRING_INSTANCES = 300;

/* ---------- STATE ---------- */
let tasks = load("cc_tasks", []);
let blocks = load("cc_blocks", []);
let categories = load("cc_categories", DEFAULT_CATEGORIES);
let activeFilter = "all";
let pickedSwatch = SWATCHES[0];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveTasks() { localStorage.setItem("cc_tasks", JSON.stringify(tasks)); if (typeof sb !== "undefined" && sb) pushToCloud(); }
function saveBlocks() { localStorage.setItem("cc_blocks", JSON.stringify(blocks)); if (typeof sb !== "undefined" && sb) pushToCloud(); }
function saveCategories() { localStorage.setItem("cc_categories", JSON.stringify(categories)); if (typeof sb !== "undefined" && sb) pushToCloud(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function bizById(id) { return categories.find(b => b.id === id) || categories[0] || DEFAULT_CATEGORIES[0]; }

/* ---------- SIDEBAR ---------- */
function renderSidebar() {
  const nav = document.getElementById("bizNav");
  nav.innerHTML = '<div class="nav-label">Categories</div>';

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "biz-item" + (activeFilter === "all" ? " active" : "");
  allBtn.style.setProperty("--dot", "#8f97a3");
  allBtn.innerHTML = `<span class="dot"></span> All tasks <span class="count">${tasks.filter(t=>t.status!=='done').length}</span>`;
  allBtn.onclick = () => { activeFilter = "all"; renderAll(); };
  nav.appendChild(allBtn);

  categories.forEach(b => {
    const count = tasks.filter(t => t.business === b.id && t.status !== "done").length;
    const row = document.createElement("div");
    row.className = "biz-row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "biz-item" + (activeFilter === b.id ? " active" : "");
    btn.style.setProperty("--dot", b.color);
    btn.innerHTML = `<span class="dot"></span> ${b.name} <span class="count">${count}</span>`;
    btn.onclick = () => { activeFilter = b.id; renderAll(); };
    const del = document.createElement("button");
    del.type = "button";
    del.className = "biz-del";
    del.textContent = "✕";
    del.title = `Remove ${b.name}`;
    del.onclick = (e) => { e.stopPropagation(); deleteCategory(b.id); };
    row.appendChild(btn);
    row.appendChild(del);
    nav.appendChild(row);
  });
}

function deleteCategory(id) {
  if (categories.length <= 1) { alert("You need to keep at least one category."); return; }
  const biz = bizById(id);
  const taskCount = tasks.filter(t => t.business === id).length;
  const blockCount = blocks.filter(b => b.business === id).length;
  const extra = (taskCount || blockCount) ? ` This will also remove ${taskCount} task(s) and ${blockCount} time block(s) linked to it.` : "";
  if (!confirm(`Remove "${biz.name}"?${extra}`)) return;
  categories = categories.filter(c => c.id !== id);
  tasks = tasks.filter(t => t.business !== id);
  blocks = blocks.filter(b => b.business !== id);
  if (activeFilter === id) activeFilter = "all";
  saveCategories(); saveTasks(); saveBlocks();
  populateBizSelects();
  renderAll();
}

function renderSwatchPicker() {
  const wrap = document.getElementById("colorSwatches");
  wrap.innerHTML = "";
  SWATCHES.forEach(hex => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "swatch" + (hex === pickedSwatch ? " selected" : "");
    dot.style.background = hex;
    dot.onclick = () => { pickedSwatch = hex; renderSwatchPicker(); };
    wrap.appendChild(dot);
  });
}

document.getElementById("showAddCategoryBtn").onclick = () => {
  document.getElementById("addCategoryForm").classList.toggle("show");
  renderSwatchPicker();
};
document.getElementById("saveCategoryBtn").onclick = () => {
  const nameInput = document.getElementById("newCategoryName");
  const name = nameInput.value.trim();
  if (!name) { alert("Give the category a name first."); return; }
  categories.push({ id: uid(), name, color: pickedSwatch });
  saveCategories();
  nameInput.value = "";
  document.getElementById("addCategoryForm").classList.remove("show");
  populateBizSelects();
  renderAll();
};

/* ---------- TASK FORM SELECTS ---------- */
function populateBizSelects() {
  document.getElementById("blockBiz").innerHTML = "";
  categories.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id; opt.textContent = b.name;
    document.getElementById("blockBiz").appendChild(opt);
  });

  const chipWrap = document.getElementById("bizChips");
  chipWrap.innerHTML = "";
  categories.forEach(b => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = b.name;
    chip.dataset.business = b.id;
    chip.onclick = () => {
      wizard.business = b.id;
      [...chipWrap.children].forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      showStep("stepPriority");
    };
    chipWrap.appendChild(chip);
  });
}

/* ---------- ADD-TASK WIZARD ---------- */
const DEFAULT_APPT_OFFSETS = ["1d", "1h"];
const wizard = { title: "", kind: "task", business: null, priority: null, repeatOn: false, freq: null, durationType: null, reminderOffsets: [...DEFAULT_APPT_OFFSETS] };
const STEP_IDS = ["stepTitle", "stepKind", "stepBiz", "stepPriority", "stepDate", "stepCheckin"];

function showStep(stepId) {
  STEP_IDS.forEach(id => document.getElementById(id).classList.toggle("hidden", id !== stepId));
  document.getElementById("wizardCancelBtn").classList.toggle("hidden", stepId === "stepTitle");
}
document.getElementById("wizardCancelBtn").onclick = () => resetWizard();
function resetWizard() {
  wizard.title = ""; wizard.kind = "task"; wizard.business = null; wizard.priority = null;
  wizard.repeatOn = false; wizard.freq = null; wizard.durationType = null;
  wizard.reminderOffsets = [...DEFAULT_APPT_OFFSETS];
  document.getElementById("taskInput").value = "";
  document.getElementById("dueDateInput").value = "";
  document.getElementById("dueTimeInput").value = "";
  document.getElementById("locationInput").value = "";
  document.getElementById("checkinDays").value = "3";
  document.getElementById("repeatCount").value = "4";
  document.getElementById("repeatOptions").classList.add("hidden");
  document.getElementById("repeatDuration").classList.add("hidden");
  document.getElementById("repeatCountFields").classList.add("hidden");
  document.getElementById("repeatToggleBtn").classList.remove("selected");
  document.getElementById("repeatToggleBtn").textContent = "🔁 Make this repeat";
  document.getElementById("notesInput").value = "";
  document.getElementById("noteField").classList.add("hidden");
  document.getElementById("noteToggleBtn").classList.remove("selected");
  document.getElementById("noteToggleBtn").textContent = "📝 Add a note";
  document.getElementById("checkinNotesInput").value = "";
  document.getElementById("checkinNoteField").classList.add("hidden");
  document.getElementById("checkinNoteToggleBtn").classList.remove("selected");
  document.getElementById("checkinNoteToggleBtn").textContent = "📝 Add a note";
  document.querySelectorAll("#bizChips .chip, [data-priority], [data-freq], [data-duration], [data-kind]").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll("[data-offset]").forEach(c => c.classList.toggle("selected", DEFAULT_APPT_OFFSETS.includes(c.dataset.offset)));
  showStep("stepTitle");
  document.getElementById("taskInput").focus();
}

document.querySelectorAll("[data-offset]").forEach(btn => {
  btn.classList.toggle("selected", DEFAULT_APPT_OFFSETS.includes(btn.dataset.offset));
  btn.onclick = () => {
    const key = btn.dataset.offset;
    if (wizard.reminderOffsets.includes(key)) {
      wizard.reminderOffsets = wizard.reminderOffsets.filter(k => k !== key);
      btn.classList.remove("selected");
    } else {
      wizard.reminderOffsets.push(key);
      btn.classList.add("selected");
    }
  };
});

function advanceFromTitle() {
  const val = document.getElementById("taskInput").value.trim();
  if (!val) { alert("Type a task first, or use the mic."); return; }
  wizard.title = val;
  showStep("stepKind");
}
document.getElementById("taskInput").addEventListener("keydown", e => {
  if (e.key === "Enter") advanceFromTitle();
});
document.getElementById("titleNextBtn").onclick = advanceFromTitle;

document.querySelectorAll("[data-kind]").forEach(btn => {
  btn.onclick = () => {
    wizard.kind = btn.dataset.kind;
    document.querySelectorAll("[data-kind]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    showStep("stepBiz");
  };
});

document.querySelectorAll("[data-priority]").forEach(btn => {
  btn.onclick = () => {
    wizard.priority = btn.dataset.priority;
    document.querySelectorAll("[data-priority]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    if (wizard.kind === "followup") {
      showStep("stepCheckin");
      return;
    }
    // Task or appointment: show the date step, adjusted per kind
    const isAppt = wizard.kind === "appointment";
    document.getElementById("dateStepLabel").textContent = isAppt ? "When is it?" : "Due date & time (optional)";
    document.getElementById("locationField").classList.toggle("hidden", !isAppt);
    document.getElementById("reminderField").classList.toggle("hidden", !isAppt);
    document.getElementById("skipDateBtn").classList.toggle("hidden", isAppt);
    showStep("stepDate");
  };
});

document.getElementById("repeatToggleBtn").onclick = () => {
  wizard.repeatOn = !wizard.repeatOn;
  const btn = document.getElementById("repeatToggleBtn");
  btn.classList.toggle("selected", wizard.repeatOn);
  btn.textContent = wizard.repeatOn ? "🔁 Repeating — tap to turn off" : "🔁 Make this repeat";
  document.getElementById("repeatOptions").classList.toggle("hidden", !wizard.repeatOn);
};

document.getElementById("noteToggleBtn").onclick = () => {
  const field = document.getElementById("noteField");
  const nowOpen = field.classList.toggle("hidden") === false;
  document.getElementById("noteToggleBtn").classList.toggle("selected", nowOpen);
  document.getElementById("noteToggleBtn").textContent = nowOpen ? "📝 Note added" : "📝 Add a note";
  if (nowOpen) document.getElementById("notesInput").focus();
};
document.getElementById("checkinNoteToggleBtn").onclick = () => {
  const field = document.getElementById("checkinNoteField");
  const nowOpen = field.classList.toggle("hidden") === false;
  document.getElementById("checkinNoteToggleBtn").classList.toggle("selected", nowOpen);
  document.getElementById("checkinNoteToggleBtn").textContent = nowOpen ? "📝 Note added" : "📝 Add a note";
  if (nowOpen) document.getElementById("checkinNotesInput").focus();
};

document.querySelectorAll("[data-freq]").forEach(btn => {
  btn.onclick = () => {
    wizard.freq = btn.dataset.freq;
    document.querySelectorAll("[data-freq]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.getElementById("repeatDuration").classList.remove("hidden");
  };
});
document.querySelectorAll("[data-duration]").forEach(btn => {
  btn.onclick = () => {
    wizard.durationType = btn.dataset.duration;
    document.querySelectorAll("[data-duration]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.getElementById("repeatCountFields").classList.toggle("hidden", wizard.durationType !== "count");
  };
});

function addUnitToDate(date, freq) {
  const d = new Date(date);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}
function addDurationToDate(date, count, unit) {
  const d = new Date(date);
  if (unit === "weeks") d.setDate(d.getDate() + count * 7);
  if (unit === "months") d.setMonth(d.getMonth() + count);
  if (unit === "years") d.setFullYear(d.getFullYear() + count);
  return d;
}

document.getElementById("finishCheckinBtn").onclick = () => {
  if (!wizard.title || !wizard.business || !wizard.priority) return;
  const days = parseInt(document.getElementById("checkinDays").value, 10) || 3;
  const notes = document.getElementById("checkinNotesInput").value.trim() || null;
  tasks.push({
    id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
    kind: "followup", due: null, checkinDays: days, nextCheckin: Date.now() + days * 86400000,
    status: "open", subtasks: [], lastNotified: null, recurring: null, notes,
  });
  saveTasks();
  resetWizard();
  renderAll();
};

function finishAdd(withDate) {
  if (!wizard.title || !wizard.business || !wizard.priority) return;

  let due = null;
  if (withDate) {
    const d = document.getElementById("dueDateInput").value;
    const t = document.getElementById("dueTimeInput").value || "09:00";
    if (d) due = new Date(`${d}T${t}`);
  }

  if (wizard.kind === "appointment" && !due) {
    alert("Appointments need a date and time.");
    return;
  }

  const location = document.getElementById("locationInput").value.trim() || null;
  const notes = document.getElementById("notesInput").value.trim() || null;
  const reminderOffsets = wizard.kind === "appointment" ? [...wizard.reminderOffsets] : null;
  const useRepeat = due && wizard.repeatOn && wizard.freq;

  if (!useRepeat) {
    tasks.push({
      id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
      kind: wizard.kind, location, reminderOffsets, notes,
      due: due ? due.toISOString() : null, status: "open", subtasks: [], lastNotified: null,
      recurring: null, remindersFired: [],
    });
  } else {
    const seriesId = uid();
    let endDate;
    if (wizard.durationType === "ongoing") {
      endDate = addDurationToDate(due, 2, "years"); // effectively ongoing, capped for storage sanity
    } else {
      const count = parseInt(document.getElementById("repeatCount").value, 10) || 1;
      const unit = document.getElementById("repeatUnit").value;
      endDate = addDurationToDate(due, count, unit);
    }
    let cur = new Date(due);
    let i = 0;
    while (cur <= endDate && i < MAX_RECURRING_INSTANCES) {
      tasks.push({
        id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
        kind: wizard.kind, location, reminderOffsets, notes,
        due: cur.toISOString(), status: "open", subtasks: [], lastNotified: null,
        recurring: wizard.freq, seriesId, remindersFired: [],
      });
      cur = addUnitToDate(cur, wizard.freq);
      i++;
    }
  }
  saveTasks();
  resetWizard();
  renderAll();
}
document.getElementById("finishAddBtn").onclick = () => finishAdd(true);
document.getElementById("skipDateBtn").onclick = () => finishAdd(false);

/* ---------- VOICE ---------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById("micBtn");
if (SpeechRecognition) {
  const rec = new SpeechRecognition();
  rec.lang = "en-AU";
  rec.interimResults = false;
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById("taskInput").value = text;
    micBtn.classList.remove("listening");
    if (text.trim()) {
      wizard.title = text.trim();
      showStep("stepKind");
    }
  };
  rec.onerror = (e) => {
    micBtn.classList.remove("listening");
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      alert("Microphone access was blocked. Check your browser's site settings and allow microphone access for this app, then try again.");
    } else if (e.error === "no-speech") {
      alert("Didn't catch that — tap the mic and try speaking again.");
    } else {
      alert("Voice input hit a problem (" + e.error + "). You can still type the task instead.");
    }
  };
  rec.onend = () => micBtn.classList.remove("listening");
  micBtn.onclick = () => {
    micBtn.classList.add("listening");
    rec.start();
  };
} else {
  micBtn.title = "Voice input isn't supported in this browser — try typing instead.";
  micBtn.onclick = () => alert("Voice input isn't supported in this browser. Your phone/desktop keyboard mic button will still work in the text field.");
}

/* ---------- TASK LIST ---------- */
function overdueInfo(task) {
  if (task.kind === "appointment") return null; // appointments use their own upcoming reminders, not overdue nagging
  if (!task.due || task.status === "done") return null;
  const dueTime = new Date(task.due).getTime();
  const now = Date.now();
  if (now <= dueTime) return null;
  const hoursOverdue = Math.floor((now - dueTime) / 3600000);
  const lastNotified = task.lastNotified || dueTime;
  const nextNagMs = NAG_INTERVAL_MS - ((now - lastNotified) % NAG_INTERVAL_MS);
  const nextNagH = Math.max(1, Math.ceil(nextNagMs / 3600000));
  return { hoursOverdue, nextNagH };
}

function followupInfo(task) {
  if (task.kind !== "followup" || task.status === "done" || !task.nextCheckin) return null;
  const now = Date.now();
  if (now < task.nextCheckin) return null;
  const daysOverdue = Math.floor((now - task.nextCheckin) / 86400000);
  const lastNotified = task.lastNotified || task.nextCheckin;
  const nextNagMs = NAG_INTERVAL_MS - ((now - lastNotified) % NAG_INTERVAL_MS);
  const nextNagH = Math.max(1, Math.ceil(nextNagMs / 3600000));
  return { daysOverdue, nextNagH };
}

function apptCountdown(task) {
  if (task.kind !== "appointment" || !task.due || task.status === "done") return null;
  const now = Date.now();
  const dueTime = new Date(task.due).getTime();
  if (now >= dueTime) return "Already happened";
  const diffMin = Math.round((dueTime - now) / 60000);
  if (diffMin < 60) return `Starts in ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Starts in ${diffH}h`;
  return `Starts in ${Math.floor(diffH / 24)}d`;
}

function subtaskProgress(task) {
  if (!task.subtasks || !task.subtasks.length) return null;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) };
}

const FREQ_LABEL = { daily: "🔁 Daily", weekly: "🔁 Weekly", monthly: "🔁 Monthly" };

function editCard(task) {
  const biz = bizById(task.business);
  const card = document.createElement("div");
  card.className = "task-card editing";
  card.dataset.taskId = task.id;
  card.style.setProperty("--dot", biz.color);

  const body = document.createElement("div");
  body.className = "task-body";

  const titleField = document.createElement("input");
  titleField.type = "text"; titleField.value = task.title;
  titleField.style.cssText = "font-size:15px; padding:8px 10px; border:1px solid var(--hairline); border-radius:6px; width:100%; margin-bottom:10px; background:var(--panel-2);";

  const bizSelect = document.createElement("select");
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id; opt.textContent = c.name;
    if (c.id === task.business) opt.selected = true;
    bizSelect.appendChild(opt);
  });

  const prioritySelect = document.createElement("select");
  [["high","High"],["med","Medium"],["low","Low"]].forEach(([val,label]) => {
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = label;
    if (val === task.priority) opt.selected = true;
    prioritySelect.appendChild(opt);
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  const timeInput = document.createElement("input");
  timeInput.type = "time";
  if (task.due) {
    const d = new Date(task.due);
    dateInput.value = d.toISOString().slice(0,10);
    timeInput.value = d.toTimeString().slice(0,5);
  }

  const row = document.createElement("div");
  row.className = "date-row";
  row.style.marginBottom = "10px";
  [bizSelect, prioritySelect].forEach(el => { el.className = "edit-select"; row.appendChild(wrapField(el)); });

  const dateRow = document.createElement("div");
  dateRow.className = "date-row";
  dateRow.style.marginBottom = "10px";
  dateRow.appendChild(wrapField(dateInput, "Date"));
  dateRow.appendChild(wrapField(timeInput, "Time"));

  const notesLabel = document.createElement("label");
  notesLabel.textContent = "Note";
  notesLabel.style.cssText = "font-size:11px; color:var(--ink-faint); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:4px;";
  const notesInput = document.createElement("textarea");
  notesInput.rows = 3;
  notesInput.value = task.notes || "";
  notesInput.placeholder = "Any extra details…";
  notesInput.style.cssText = "width:100%; padding:8px 10px; border:1px solid var(--hairline); border-radius:6px; background:var(--panel-2); font-family:inherit; font-size:13px; resize:vertical; margin-bottom:10px;";

  let locationInput = null;
  let reminderState = [...(task.reminderOffsets && task.reminderOffsets.length ? task.reminderOffsets : DEFAULT_APPT_OFFSETS)];
  let reminderSection = null;
  if (task.kind === "appointment") {
    locationInput = document.createElement("input");
    locationInput.type = "text";
    locationInput.value = task.location || "";
    locationInput.placeholder = "Location / notes (optional)";
    locationInput.style.cssText = "font-size:13px; padding:8px 10px; border:1px solid var(--hairline); border-radius:6px; width:100%; margin-bottom:10px; background:var(--panel-2);";

    reminderSection = document.createElement("div");
    reminderSection.style.marginBottom = "10px";

    const reminderLabel = document.createElement("div");
    reminderLabel.className = "step-label";
    reminderLabel.textContent = "Remind me (pick any)";
    reminderLabel.style.marginBottom = "6px";
    reminderSection.appendChild(reminderLabel);

    const reminderChipsWrap = document.createElement("div");
    reminderChipsWrap.className = "chip-row";
    APPT_OFFSETS.forEach(off => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (reminderState.includes(off.key) ? " selected" : "");
      chip.textContent = off.label.replace("in ", "") + " before";
      chip.onclick = () => {
        if (reminderState.includes(off.key)) { reminderState = reminderState.filter(k => k !== off.key); chip.classList.remove("selected"); }
        else { reminderState.push(off.key); chip.classList.add("selected"); }
      };
      reminderChipsWrap.appendChild(chip);
    });
    reminderSection.appendChild(reminderChipsWrap);
  }

  const actions = document.createElement("div");
  actions.className = "wizard-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button"; saveBtn.className = "add-btn"; saveBtn.textContent = "Save changes";
  saveBtn.onclick = () => {
    if (!titleField.value.trim()) { alert("A task needs a title."); return; }
    task.title = titleField.value.trim();
    task.business = bizSelect.value;
    task.priority = prioritySelect.value;
    if (dateInput.value) {
      const t = timeInput.value || "09:00";
      task.due = new Date(`${dateInput.value}T${t}`).toISOString();
    } else {
      task.due = null;
    }
    if (task.kind === "appointment") {
      task.location = locationInput.value.trim() || null;
      task.reminderOffsets = [...reminderState];
      task.remindersFired = []; // dates/reminders changed — allow reminders to fire again on the new schedule
    }
    task.notes = notesInput.value.trim() || null;
    task._editing = false;
    saveTasks(); renderAll();
  };
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button"; cancelBtn.className = "ghost-btn"; cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => { task._editing = false; renderAll(); };
  actions.appendChild(cancelBtn); actions.appendChild(saveBtn);

  body.appendChild(titleField);
  body.appendChild(row);
  body.appendChild(dateRow);
  body.appendChild(notesLabel);
  body.appendChild(notesInput);
  if (task.kind === "appointment") {
    body.appendChild(locationInput);
    body.appendChild(reminderSection);
  }
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}
function wrapField(el, labelText) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  if (labelText) {
    const lab = document.createElement("label");
    lab.textContent = labelText;
    wrap.appendChild(lab);
  }
  wrap.appendChild(el);
  return wrap;
}

function taskCard(task) {
  if (task._editing) return editCard(task);
  const biz = bizById(task.business);
  const card = document.createElement("div");
  card.className = "task-card" + (task.status === "done" ? " done" : "");
  card.dataset.taskId = task.id;
  card.style.setProperty("--dot", biz.color);

  const cb = document.createElement("button");
  cb.type = "button";
  cb.className = "checkbox" + (task.status === "done" ? " checked" : "");
  cb.textContent = task.status === "done" ? "✓" : "";
  cb.onclick = () => { task.status = task.status === "done" ? "open" : "done"; saveTasks(); renderAll(); };

  const body = document.createElement("div");
  body.className = "task-body";

  const titleRow = document.createElement("div");
  titleRow.className = "title-row";
  const title = document.createElement("div");
  title.className = "title";
  const KIND_ICON = { followup: "👋 ", appointment: "🗓️ " };
  title.textContent = (KIND_ICON[task.kind] || "") + task.title;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "del-btn"; del.textContent = "✕"; del.title = "Delete task";
  del.onclick = () => { tasks = tasks.filter(t => t.id !== task.id); saveTasks(); renderAll(); };

  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "mute-btn";
  mute.textContent = task.muted ? "🔕" : "🔔";
  mute.title = task.muted ? "Reminders muted — click to re-enable" : "Mute repeat reminders for this task";
  mute.onclick = () => { task.muted = !task.muted; saveTasks(); renderAll(); };

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "mute-btn";
  edit.textContent = "✏️";
  edit.title = "Edit task";
  edit.onclick = () => { task._editing = true; renderAll(); };

  titleRow.appendChild(title); titleRow.appendChild(edit); titleRow.appendChild(mute); titleRow.appendChild(del);

  if (task.kind === "followup" && task.status !== "done") {
    const snooze = document.createElement("button");
    snooze.type = "button";
    snooze.className = "mute-btn";
    snooze.textContent = "⏭️";
    snooze.title = `Not yet — check in again in ${task.checkinDays || 3} days`;
    snooze.onclick = () => {
      task.nextCheckin = Date.now() + (task.checkinDays || 3) * 86400000;
      task.lastNotified = null;
      saveTasks(); renderAll();
    };
    titleRow.appendChild(snooze);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  let metaHtml = `<span class="biz-chip" style="color:${biz.color}">${biz.name}</span>`;
  if (task.due) {
    const d = new Date(task.due);
    metaHtml += ` · ${task.kind === "appointment" ? "" : "Due "}${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}, ${d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
  }
  if (task.location) metaHtml += ` · 📍 ${task.location}`;
  if (task.recurring && FREQ_LABEL[task.recurring]) metaHtml += ` · ${FREQ_LABEL[task.recurring]}`;

  const appt = apptCountdown(task);
  if (appt) metaHtml += ` · <span style="color:var(--marketing); font-weight:600;">${appt}</span>`;

  const fu = followupInfo(task);
  if (fu) {
    metaHtml += task.muted
      ? ` · <span class="overdue">Follow up — ${fu.daysOverdue}d overdue — reminders muted</span>`
      : ` · <span class="overdue">Follow up now — ${fu.daysOverdue}d overdue — next nag in ${fu.nextNagH}h</span>`;
  } else if (task.kind === "followup" && task.status !== "done" && task.nextCheckin) {
    const daysLeft = Math.ceil((task.nextCheckin - Date.now()) / 86400000);
    metaHtml += ` · Check in again in ${daysLeft}d`;
  }

  const od = overdueInfo(task);
  if (od) {
    metaHtml += task.muted
      ? ` · <span class="overdue">Overdue ${od.hoursOverdue}h — reminders muted</span>`
      : ` · <span class="overdue">Overdue ${od.hoursOverdue}h — next nag in ${od.nextNagH}h</span>`;
  }
  meta.innerHTML = metaHtml;

  body.appendChild(titleRow);
  body.appendChild(meta);

  const prog = subtaskProgress(task);
  if (prog) {
    const bar = document.createElement("div");
    bar.className = "subtask-bar";
    bar.innerHTML = `<div class="subtask-fill" style="width:${prog.pct}%; background:${biz.color}"></div>`;
    body.appendChild(bar);
    const label = document.createElement("div");
    label.style.cssText = "font-size:10.5px;color:var(--ink-faint);margin-top:4px;";
    label.textContent = `${prog.done} of ${prog.total} steps done`;
    body.appendChild(label);
  }

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "toggle-subtasks";
  toggleBtn.textContent = (task._open ? "Hide steps" : "Steps / workflow");
  const subList = document.createElement("div");
  subList.className = "subtask-list";
  subList.style.display = task._open ? "flex" : "none";

  function renderSub() {
    subList.innerHTML = "";
    (task.subtasks || []).forEach(s => {
      const row = document.createElement("div");
      row.className = "subtask-row" + (s.done ? " done" : "");
      const scb = document.createElement("button");
      scb.type = "button";
      scb.className = "checkbox" + (s.done ? " checked" : "");
      scb.textContent = s.done ? "✓" : "";
      scb.onclick = () => { s.done = !s.done; saveTasks(); renderAll(); };
      const label = document.createElement("span");
      label.textContent = s.title;
      row.appendChild(scb); row.appendChild(label);
      subList.appendChild(row);
    });
    const addRow = document.createElement("div");
    addRow.className = "add-subtask";
    const inp = document.createElement("input");
    inp.placeholder = "Add a step…";
    const addB = document.createElement("button");
    addB.type = "button";
    addB.textContent = "Add";
    addB.onclick = () => {
      if (!inp.value.trim()) return;
      task.subtasks = task.subtasks || [];
      task.subtasks.push({ id: uid(), title: inp.value.trim(), done: false });
      saveTasks(); renderAll();
    };
    addRow.appendChild(inp); addRow.appendChild(addB);
    subList.appendChild(addRow);
  }
  renderSub();

  toggleBtn.onclick = () => { task._open = !task._open; renderAll(); };

  body.appendChild(toggleBtn);
  body.appendChild(subList);

  if (task.notes) {
    const noteToggle = document.createElement("button");
    noteToggle.type = "button";
    noteToggle.className = "toggle-subtasks";
    noteToggle.style.marginLeft = "10px";
    noteToggle.textContent = task._noteOpen ? "Hide note" : "📝 Note";
    noteToggle.onclick = () => { task._noteOpen = !task._noteOpen; renderAll(); };
    body.appendChild(noteToggle);

    if (task._noteOpen) {
      const noteText = document.createElement("div");
      noteText.style.cssText = "font-size:12.5px; color:var(--ink-dim); background:var(--panel-2); padding:8px 10px; border-radius:6px; margin-top:6px; white-space:pre-wrap;";
      noteText.textContent = task.notes;
      body.appendChild(noteText);
    }
  }

  card.appendChild(cb);
  card.appendChild(body);
  return card;
}

let groupExpanded = { high: true, med: false, low: false };

function jumpToTask(taskId) {
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  // Make sure the task will actually be visible: right category filter, and its priority group expanded
  if (activeFilter !== "all" && activeFilter !== t.business) activeFilter = "all";
  if (t.priority !== "high") groupExpanded[t.priority] = true;
  renderAll();
  setTimeout(() => {
    const el = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash-highlight");
    setTimeout(() => el.classList.remove("flash-highlight"), 1600);
  }, 50);
}

function renderTasks() {
  const col = document.getElementById("taskCol");
  col.innerHTML = "";
  const filtered = tasks.filter(t => activeFilter === "all" || t.business === activeFilter);

  const groups = [
    { key: "high", label: "High priority", cls: "high", collapsible: false },
    { key: "med",  label: "Medium priority", cls: "med", collapsible: true },
    { key: "low",  label: "Low priority — still worth doing", cls: "low", collapsible: true },
  ];

  let anything = false;
  groups.forEach(g => {
    const items = filtered
      .filter(t => t.priority === g.key)
      .sort((a,b) => (a.status==='done')-(b.status==='done') || (a.due||'9999').localeCompare(b.due||'9999'));
    if (!items.length) return;
    anything = true;
    const wrap = document.createElement("div");
    wrap.className = "priority-group";

    if (!g.collapsible) {
      wrap.innerHTML = `<div class="priority-head ${g.cls}"><span class="bar"></span> ${g.label}</div>`;
      items.forEach(t => wrap.appendChild(taskCard(t)));
    } else {
      const expanded = groupExpanded[g.key];
      const head = document.createElement("button");
      head.type = "button";
      head.className = `priority-head ${g.cls} collapsible`;
      head.innerHTML = `<span class="bar"></span> ${g.label} <span class="group-count">(${items.length})</span> <span class="chevron">${expanded ? "▾" : "▸"}</span>`;
      head.onclick = () => { groupExpanded[g.key] = !groupExpanded[g.key]; renderTasks(); };
      wrap.appendChild(head);
      if (expanded) items.forEach(t => wrap.appendChild(taskCard(t)));
    }
    col.appendChild(wrap);
  });

  if (!anything) {
    col.innerHTML = '<div class="empty-msg">No tasks here yet — add one above, or pick another category.</div>';
  }
}

/* ---------- TIME BLOCKS ---------- */
function hourLabel(h) {
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}
function timeOptions(selectEl, selected) {
  selectEl.innerHTML = "";
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const opt = document.createElement("option");
    opt.value = `${String(h).padStart(2,"0")}:00`;
    opt.textContent = hourLabel(h);
    if (opt.value === selected) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function tasksDueThisHour(hStr) {
  return tasks.filter(t => {
    if (!t.due || t.status === "done") return false;
    const d = new Date(t.due);
    if (d.toDateString() !== selectedDate.toDateString()) return false;
    const taskHour = String(d.getHours()).padStart(2, "0") + ":00";
    return taskHour === hStr;
  });
}

function renderSchedule() {
  const label = document.getElementById("scheduleDayLabel");
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  label.textContent = (isToday ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })) + " — Time Blocks";

  const sched = document.getElementById("schedule");
  sched.innerHTML = "";
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const hStr = String(h).padStart(2, "0") + ":00";
    const row = document.createElement("div");
    row.className = "hour-row";
    const hr = document.createElement("div");
    hr.className = "hr"; hr.textContent = hourLabel(h);
    row.appendChild(hr);

    const dayStr = selectedDate.getFullYear() + "-" + String(selectedDate.getMonth()+1).padStart(2,"0") + "-" + String(selectedDate.getDate()).padStart(2,"0");
    const coveringBlocks = blocks.filter(b => hStr >= b.start && hStr < b.end && blockAppliesToDay(b, dayStr));
    const dueTasks = tasksDueThisHour(hStr);

    if (!coveringBlocks.length && !dueTasks.length) {
      const blk = document.createElement("button");
      blk.type = "button";
      blk.className = "block empty";
      blk.textContent = "Open";
      blk.onclick = () => toggleBlockForm(true, hStr);
      row.appendChild(blk);
      sched.appendChild(row);
      continue;
    }

    const items = document.createElement("div");
    items.className = "hour-items";

    coveringBlocks.forEach(covering => {
      const biz = bizById(covering.business);
      const blk = document.createElement("div");
      blk.className = "block";
      blk.style.background = biz.color;
      const isStart = hStr === covering.start;
      const rangeTag = covering.fromDate ? (covering.toDate ? "" : " · one day") : "";
      blk.innerHTML = `<span>${isStart ? covering.label + rangeTag : "↳ continued"}</span>`;
      if (isStart) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "rm"; editBtn.textContent = "✏️";
        editBtn.title = "Edit this block";
        editBtn.onclick = () => openBlockForEdit(covering);
        blk.appendChild(editBtn);
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "rm"; rm.textContent = "✕";
        rm.onclick = () => { blocks = blocks.filter(b => b.id !== covering.id); saveBlocks(); renderAll(); };
        blk.appendChild(rm);
      }
      items.appendChild(blk);
    });

    dueTasks.forEach(t => {
      const biz = bizById(t.business);
      const blk = document.createElement("button");
      blk.type = "button";
      blk.className = "block task-block";
      blk.style.background = biz.color;
      blk.innerHTML = `<span>📌 ${t.title}${t.status === "done" ? " ✓" : ""}</span>`;
      blk.onclick = () => jumpToTask(t.id);
      items.appendChild(blk);
    });

    row.appendChild(items);
    sched.appendChild(row);
  }
}

function blockAppliesToDay(block, dayStr) {
  if (!block.fromDate) return true; // no start date set = repeats every day
  if (dayStr < block.fromDate) return false;
  if (block.toDate && dayStr > block.toDate) return false;
  if (!block.toDate && dayStr !== block.fromDate) return false; // single day only, no end date given
  return true;
}

let editingBlockId = null;
let blockRepeatChoice = null;

function toggleBlockForm(show, presetStart) {
  const form = document.getElementById("addBlockForm");
  form.classList.toggle("show", show);
  if (show && presetStart) timeOptions(document.getElementById("blockStart"), presetStart);
  if (!show) {
    editingBlockId = null;
    blockRepeatChoice = null;
    document.getElementById("blockLabel").value = "";
    document.getElementById("blockFromDate").value = "";
    document.getElementById("blockToDate").value = "";
    document.getElementById("blockPeriodFields").classList.add("hidden");
    document.getElementById("saveBlockBtn").classList.add("hidden");
    document.querySelectorAll("[data-blockrepeat]").forEach(b => b.classList.remove("selected"));
    document.getElementById("blockStepDetails").classList.remove("hidden");
    document.getElementById("blockStepRepeat").classList.add("hidden");
    document.getElementById("saveBlockBtn").textContent = "Save block";
  }
  if (show) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("blockNextBtn").onclick = () => {
  const label = document.getElementById("blockLabel").value.trim();
  const start = document.getElementById("blockStart").value;
  const end = document.getElementById("blockEnd").value;
  if (!label || start >= end) { alert("Give the block a label, and make sure the end time is after the start time."); return; }
  document.getElementById("blockStepDetails").classList.add("hidden");
  document.getElementById("blockStepRepeat").classList.remove("hidden");
};
document.getElementById("blockBackBtn").onclick = () => {
  document.getElementById("blockStepRepeat").classList.add("hidden");
  document.getElementById("blockStepDetails").classList.remove("hidden");
};

document.querySelectorAll("[data-blockrepeat]").forEach(btn => {
  btn.onclick = () => {
    blockRepeatChoice = btn.dataset.blockrepeat;
    document.querySelectorAll("[data-blockrepeat]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.getElementById("blockPeriodFields").classList.toggle("hidden", blockRepeatChoice !== "period");
    document.getElementById("saveBlockBtn").classList.remove("hidden");
  };
});

function openBlockForEdit(block) {
  editingBlockId = block.id;
  document.getElementById("blockLabel").value = block.label;
  document.getElementById("blockBiz").value = block.business;
  timeOptions(document.getElementById("blockStart"), block.start);
  timeOptions(document.getElementById("blockEnd"), block.end);
  toggleBlockForm(true);
  // Jump straight to the repeat step, pre-selected, since this is an existing block
  document.getElementById("blockStepDetails").classList.add("hidden");
  document.getElementById("blockStepRepeat").classList.remove("hidden");
  document.getElementById("saveBlockBtn").classList.remove("hidden");
  document.getElementById("saveBlockBtn").textContent = "Update block";
  if (block.toDate) blockRepeatChoice = "period";
  else if (block.fromDate) blockRepeatChoice = "once";
  else blockRepeatChoice = "daily";
  document.querySelectorAll("[data-blockrepeat]").forEach(b => b.classList.toggle("selected", b.dataset.blockrepeat === blockRepeatChoice));
  document.getElementById("blockPeriodFields").classList.toggle("hidden", blockRepeatChoice !== "period");
  document.getElementById("blockFromDate").value = block.fromDate || "";
  document.getElementById("blockToDate").value = block.toDate || "";
}

document.getElementById("addBlockBtn").onclick = () => toggleBlockForm(true);
document.getElementById("saveBlockBtn").onclick = () => {
  const label = document.getElementById("blockLabel").value.trim();
  const business = document.getElementById("blockBiz").value;
  const start = document.getElementById("blockStart").value;
  const end = document.getElementById("blockEnd").value;

  let fromDate = null, toDate = null;
  const todayStr = selectedDate.getFullYear() + "-" + String(selectedDate.getMonth()+1).padStart(2,"0") + "-" + String(selectedDate.getDate()).padStart(2,"0");

  if (blockRepeatChoice === "once") {
    fromDate = todayStr;
    toDate = todayStr;
  } else if (blockRepeatChoice === "period") {
    fromDate = document.getElementById("blockFromDate").value || null;
    toDate = document.getElementById("blockToDate").value || null;
    if (!fromDate || !toDate) { alert("Set both a 'From' and 'Until' date for a period."); return; }
  }
  // "daily" (or no choice made) leaves fromDate/toDate as null = repeats every day

  if (editingBlockId) {
    const b = blocks.find(bl => bl.id === editingBlockId);
    if (b) { b.label = label; b.business = business; b.start = start; b.end = end; b.fromDate = fromDate; b.toDate = toDate; }
  } else {
    blocks.push({ id: uid(), label, business, start, end, fromDate, toDate });
  }
  saveBlocks();
  toggleBlockForm(false);
  renderAll();
};

/* ---------- MINI CALENDAR ---------- */
let selectedDate = new Date();
let calendarMonthOffset = 0;
document.getElementById("prevMonthBtn").onclick = () => { calendarMonthOffset--; renderCalendar(); };
document.getElementById("nextMonthBtn").onclick = () => { calendarMonthOffset++; renderCalendar(); };
document.getElementById("prevDayBtn").onclick = () => { selectedDate = new Date(selectedDate.getTime() - 86400000); renderAll(); };
document.getElementById("nextDayBtn").onclick = () => { selectedDate = new Date(selectedDate.getTime() + 86400000); renderAll(); };

function renderCalendar() {
  const realNow = new Date();
  const viewDate = new Date(realNow.getFullYear(), realNow.getMonth() + calendarMonthOffset, 1);
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  document.getElementById("calMonthLabel").textContent =
    viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const dowEl = document.getElementById("calDow");
  dowEl.innerHTML = "";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const el = document.createElement("div"); el.className = "dow"; el.textContent = d;
    dowEl.appendChild(el);
  });

  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dueByDay = {};
  tasks.forEach(t => {
    if (!t.due) return;
    const d = new Date(t.due);
    if (d.getFullYear() === year && d.getMonth() === month) {
      dueByDay[d.getDate()] = dueByDay[d.getDate()] || [];
      dueByDay[d.getDate()].push(t.business);
    }
  });

  for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div"));
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.textContent = d;
    cell.style.cursor = "pointer";
    if (calendarMonthOffset === 0 && d === realNow.getDate()) cell.classList.add("today");
    if (selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d) {
      cell.classList.add("selected");
    }
    if (dueByDay[d]) {
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.style.background = bizById(dueByDay[d][0]).color;
      cell.appendChild(mark);
    }
    cell.onclick = () => { selectedDate = new Date(year, month, d); renderAll(); };
    grid.appendChild(cell);
  }

  renderSelectedDayTasks();
}

function renderSelectedDayTasks() {
  const label = document.getElementById("selectedDayLabel");
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  label.textContent = isToday ? "Today" : selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const wrap = document.getElementById("selectedDayTasks");
  wrap.innerHTML = "";
  const dayTasks = tasks
    .filter(t => t.due && new Date(t.due).toDateString() === selectedDate.toDateString())
    .sort((a,b) => a.due.localeCompare(b.due));

  if (!dayTasks.length) {
    wrap.innerHTML = '<div class="empty-msg" style="padding:8px 0;">No tasks due this day.</div>';
    return;
  }
  dayTasks.forEach(t => wrap.appendChild(taskCard(t)));
}

/* ---------- PRINTABLE CALENDAR ---------- */
document.getElementById("printCalBtn").onclick = () => {
  document.getElementById("printForm").classList.toggle("show");
};
document.querySelectorAll("[data-print]").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("printForm").classList.remove("show");
    buildAndPrint(btn.dataset.print);
  };
});

function tasksForDay(date) {
  return tasks
    .filter(t => t.due && new Date(t.due).toDateString() === date.toDateString())
    .sort((a,b) => a.due.localeCompare(b.due));
}

function buildAndPrint(range) {
  const area = document.getElementById("printArea");
  let days = [];
  let title = "";

  if (range === "day") {
    days = [selectedDate];
    title = selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } else if (range === "week") {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    title = `Week of ${start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  } else {
    const y = selectedDate.getFullYear(), m = selectedDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(y, m, d));
    title = selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  let html = `<h1>Command Centre — ${title}</h1>`;
  days.forEach(day => {
    const dayTasks = tasksForDay(day);
    html += `<div class="print-day"><h2>${day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h2>`;
    if (!dayTasks.length) {
      html += `<div class="print-item">— nothing scheduled —</div>`;
    } else {
      dayTasks.forEach(t => {
        const time = new Date(t.due).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        const biz = bizById(t.business).name;
        html += `<div class="print-item"><span class="pi-time">${time}</span> ${t.title} — ${biz}</div>`;
      });
    }
    html += `</div>`;
  });

  area.innerHTML = html;
  window.print();
}

/* ---------- REMINDERS ---------- */
const APPT_OFFSETS = [
  { key: "1w", ms: 7 * 24 * 3600000, label: "in 1 week" },
  { key: "2d", ms: 2 * 24 * 3600000, label: "in 2 days" },
  { key: "1d", ms: 24 * 3600000, label: "in 1 day" },
  { key: "2h", ms: 2 * 3600000, label: "in 2 hours" },
  { key: "1h", ms: 3600000, label: "in 1 hour" },
  { key: "15m", ms: 15 * 60000, label: "in 15 minutes" },
];

function checkReminders() {
  let changed = false;
  tasks.forEach(t => {
    if (t.muted) return;

    // Overdue tasks (kind 'task' or undefined)
    const od = overdueInfo(t);
    if (od) {
      const last = t.lastNotified || new Date(t.due).getTime();
      if (Date.now() - last >= NAG_INTERVAL_MS) {
        t.lastNotified = Date.now();
        changed = true;
        notify(`Overdue: ${t.title}`, `${bizById(t.business).name} · ${od.hoursOverdue}h overdue. Complete it or update the due date to stop these reminders.`);
      }
    }

    // Follow-ups past their check-in date
    const fu = followupInfo(t);
    if (fu) {
      const last = t.lastNotified || t.nextCheckin;
      if (Date.now() - last >= NAG_INTERVAL_MS) {
        t.lastNotified = Date.now();
        changed = true;
        notify(`Follow up: ${t.title}`, `${bizById(t.business).name} · Time to check in on this — ${fu.daysOverdue}d since it was due.`);
      }
    }

    // Appointments — remind ahead of time, once per chosen offset
    if (t.kind === "appointment" && t.due && t.status !== "done") {
      const dueTime = new Date(t.due).getTime();
      const now = Date.now();
      if (now < dueTime) {
        t.remindersFired = t.remindersFired || [];
        const chosen = (t.reminderOffsets && t.reminderOffsets.length) ? t.reminderOffsets : DEFAULT_APPT_OFFSETS;
        APPT_OFFSETS.filter(off => chosen.includes(off.key)).forEach(off => {
          const fireAt = dueTime - off.ms;
          if (now >= fireAt && !t.remindersFired.includes(off.key)) {
            t.remindersFired.push(off.key);
            changed = true;
            notify(`Appointment ${off.label}: ${t.title}`, `${bizById(t.business).name}${t.location ? " · " + t.location : ""}`);
          }
        });
      }
    }
  });
  if (changed) { saveTasks(); renderAll(); }
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "icons/icon-192.png" });
  }
}
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}
setInterval(checkReminders, 5 * 60 * 1000); // check every 5 min

/* ---------- INSTALL PROMPT ---------- */
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").classList.add("show");
});
document.getElementById("installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").classList.remove("show");
};

/* ---------- SERVICE WORKER ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

document.getElementById("checkUpdateBtn").onclick = async () => {
  const btn = document.getElementById("checkUpdateBtn");
  btn.textContent = "🔄 Checking…";
  btn.disabled = true;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) { /* proceed to reload regardless */ }
  location.reload(true);
};

/* ---------- SYNC (Supabase) ---------- */
let sb = null;
let syncing = false;
let workspace = "default";

function loadSyncConfig() { return load("cc_sync_config", null); }
function saveSyncConfig(cfg) { localStorage.setItem("cc_sync_config", JSON.stringify(cfg)); }
function clearSyncConfig() { localStorage.removeItem("cc_sync_config"); }
function rowId(key) { return `${workspace}::${key}`; }

function setSyncStatus(text) {
  document.getElementById("syncStatus").innerHTML = `<span class="sync-dot"></span> ${text}`;
}

function initSync() {
  const cfg = loadSyncConfig();
  if (!cfg || !cfg.url || !cfg.key) {
    setSyncStatus("Saved on this device · offline-ready");
    return;
  }
  workspace = (cfg.workspace && cfg.workspace.trim()) || "default";
  try {
    sb = window.supabase.createClient(cfg.url, cfg.key);
    setSyncStatus("Connecting…");
    pullFromCloud(true);
    setInterval(() => pullFromCloud(false), 25000); // check for changes from other devices every 25s
  } catch (e) {
    setSyncStatus("Sync error — check settings");
  }
}

async function pushToCloud() {
  if (!sb) return;
  syncing = true;
  setSyncStatus("Syncing…");
  try {
    await sb.from("app_state").upsert([
      { id: rowId("tasks"), data: tasks, updated_at: new Date().toISOString() },
      { id: rowId("blocks"), data: blocks, updated_at: new Date().toISOString() },
      { id: rowId("categories"), data: categories, updated_at: new Date().toISOString() },
    ]);
    setSyncStatus("Synced just now" + (workspace !== "default" ? ` · ${workspace}` : ""));
  } catch (e) {
    setSyncStatus("Sync failed — will retry");
  }
  syncing = false;
}

async function pullFromCloud(isInitial) {
  if (!sb || syncing) return;
  try {
    const { data, error } = await sb.from("app_state")
      .select("id,data")
      .in("id", [rowId("tasks"), rowId("blocks"), rowId("categories")]);
    if (error) throw error;
    if (data && data.length) {
      data.forEach(row => {
        if (row.id === rowId("tasks") && row.data) { tasks = row.data; saveTasksLocalOnly(); }
        if (row.id === rowId("blocks") && row.data) { blocks = row.data; saveBlocksLocalOnly(); }
        if (row.id === rowId("categories") && row.data) { categories = row.data; saveCategoriesLocalOnly(); }
      });
      populateBizSelects();
      renderAll();
    } else if (isInitial) {
      // Nothing in the cloud yet for this workspace — push what we have locally to seed it
      await pushToCloud();
    }
    setSyncStatus("Synced · " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + (workspace !== "default" ? ` · ${workspace}` : ""));
  } catch (e) {
    setSyncStatus("Sync error — check settings");
  }
}

// Local-only save helpers, used when pulling from the cloud so we don't immediately push back
function saveTasksLocalOnly() { localStorage.setItem("cc_tasks", JSON.stringify(tasks)); }
function saveBlocksLocalOnly() { localStorage.setItem("cc_blocks", JSON.stringify(blocks)); }
function saveCategoriesLocalOnly() { localStorage.setItem("cc_categories", JSON.stringify(categories)); }

document.getElementById("showSyncBtn").onclick = () => {
  const cfg = loadSyncConfig();
  if (cfg) {
    document.getElementById("supabaseUrl").value = cfg.url;
    document.getElementById("supabaseKey").value = cfg.key;
    document.getElementById("syncWorkspace").value = cfg.workspace || "";
  }
  document.getElementById("syncForm").classList.toggle("show");
};
document.getElementById("saveSyncBtn").onclick = () => {
  const url = document.getElementById("supabaseUrl").value.trim();
  const key = document.getElementById("supabaseKey").value.trim();
  const ws = document.getElementById("syncWorkspace").value.trim();
  if (!url || !key) { alert("Paste both your Supabase Project URL and anon key."); return; }
  saveSyncConfig({ url, key, workspace: ws });
  document.getElementById("syncForm").classList.remove("show");
  initSync();
};
document.getElementById("disconnectSyncBtn").onclick = () => {
  if (!confirm("Disconnect sync? This device will keep its tasks locally, but stop syncing with other devices.")) return;
  clearSyncConfig();
  sb = null;
  document.getElementById("syncForm").classList.remove("show");
  setSyncStatus("Saved on this device · offline-ready");
};

/* ---------- INIT ---------- */
function renderAll() {
  renderSidebar();
  renderTasks();
  renderSchedule();
  renderCalendar();
}
populateBizSelects();
timeOptions(document.getElementById("blockStart"), "09:00");
timeOptions(document.getElementById("blockEnd"), "12:00");
renderAll();
checkReminders();
initSync();
