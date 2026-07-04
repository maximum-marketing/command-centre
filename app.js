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
function saveTasks() { localStorage.setItem("cc_tasks", JSON.stringify(tasks)); }
function saveBlocks() { localStorage.setItem("cc_blocks", JSON.stringify(blocks)); }
function saveCategories() { localStorage.setItem("cc_categories", JSON.stringify(categories)); }
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
const wizard = { title: "", business: null, priority: null, freq: null, durationType: null };
const STEP_IDS = ["stepTitle", "stepBiz", "stepPriority", "stepDate", "stepRepeat"];

function showStep(stepId) {
  STEP_IDS.forEach(id => document.getElementById(id).classList.toggle("hidden", id !== stepId));
}
function resetWizard() {
  wizard.title = ""; wizard.business = null; wizard.priority = null;
  wizard.freq = null; wizard.durationType = null;
  document.getElementById("taskInput").value = "";
  document.getElementById("dueDateInput").value = "";
  document.getElementById("dueTimeInput").value = "";
  document.getElementById("repeatCount").value = "";
  document.getElementById("repeatDuration").classList.add("hidden");
  document.getElementById("repeatCountFields").classList.add("hidden");
  document.getElementById("finishRepeatBtn").classList.add("hidden");
  document.querySelectorAll("#bizChips .chip, [data-priority], [data-freq], [data-duration]").forEach(c => c.classList.remove("selected"));
  showStep("stepTitle");
  document.getElementById("taskInput").focus();
}

document.getElementById("taskInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && document.getElementById("taskInput").value.trim()) {
    wizard.title = document.getElementById("taskInput").value.trim();
    showStep("stepBiz");
  }
});

document.querySelectorAll("[data-priority]").forEach(btn => {
  btn.onclick = () => {
    wizard.priority = btn.dataset.priority;
    document.querySelectorAll("[data-priority]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    showStep("stepDate");
  };
});

document.querySelectorAll("[data-freq]").forEach(btn => {
  btn.onclick = () => {
    wizard.freq = btn.dataset.freq;
    document.querySelectorAll("[data-freq]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    if (wizard.freq === "none") {
      finishAdd(true);
    } else {
      document.getElementById("repeatDuration").classList.remove("hidden");
    }
  };
});
document.querySelectorAll("[data-duration]").forEach(btn => {
  btn.onclick = () => {
    wizard.durationType = btn.dataset.duration;
    document.querySelectorAll("[data-duration]").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.getElementById("repeatCountFields").classList.toggle("hidden", wizard.durationType !== "count");
    document.getElementById("finishRepeatBtn").classList.remove("hidden");
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

function finishAdd(withDate) {
  if (!wizard.title || !wizard.business || !wizard.priority) return;
  let due = null;
  if (withDate) {
    const d = document.getElementById("dueDateInput").value;
    const t = document.getElementById("dueTimeInput").value || "09:00";
    if (d) due = new Date(`${d}T${t}`);
  }

  if (!due) {
    tasks.push({ id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
      due: null, status: "open", subtasks: [], lastNotified: null, recurring: null });
    saveTasks(); resetWizard(); renderAll();
    return;
  }

  // No date given but user hit "Add task" without repeat step yet -> single task, no repeat offer
  if (withDate === true && wizard.freq === null) {
    showStep("stepRepeat");
    wizard._pendingDue = due;
    return;
  }

  const startDate = wizard._pendingDue || due;
  const freq = wizard.freq;
  if (!freq || freq === "none") {
    tasks.push({ id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
      due: startDate.toISOString(), status: "open", subtasks: [], lastNotified: null, recurring: null });
  } else {
    const seriesId = uid();
    let endDate;
    if (wizard.durationType === "ongoing") {
      endDate = addDurationToDate(startDate, 2, "years"); // effectively ongoing, capped for storage sanity
    } else {
      const count = parseInt(document.getElementById("repeatCount").value, 10) || 1;
      const unit = document.getElementById("repeatUnit").value;
      endDate = addDurationToDate(startDate, count, unit);
    }
    let cur = new Date(startDate);
    let i = 0;
    while (cur <= endDate && i < MAX_RECURRING_INSTANCES) {
      tasks.push({
        id: uid(), title: wizard.title, business: wizard.business, priority: wizard.priority,
        due: cur.toISOString(), status: "open", subtasks: [], lastNotified: null,
        recurring: freq, seriesId,
      });
      cur = addUnitToDate(cur, freq);
      i++;
    }
  }
  saveTasks();
  wizard._pendingDue = null;
  resetWizard();
  renderAll();
}
document.getElementById("finishAddBtn").onclick = () => finishAdd(true);
document.getElementById("skipDateBtn").onclick = () => finishAdd(false);
document.getElementById("finishRepeatBtn").onclick = () => finishAdd(true);

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
      showStep("stepBiz");
    }
  };
  rec.onerror = () => micBtn.classList.remove("listening");
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

function subtaskProgress(task) {
  if (!task.subtasks || !task.subtasks.length) return null;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total: task.subtasks.length, pct: Math.round((done / task.subtasks.length) * 100) };
}

const FREQ_LABEL = { daily: "🔁 Daily", weekly: "🔁 Weekly", monthly: "🔁 Monthly" };

function taskCard(task) {
  const biz = bizById(task.business);
  const card = document.createElement("div");
  card.className = "task-card" + (task.status === "done" ? " done" : "");
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
  title.textContent = task.title;
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

  titleRow.appendChild(title); titleRow.appendChild(mute); titleRow.appendChild(del);

  const meta = document.createElement("div");
  meta.className = "meta";
  let metaHtml = `<span class="biz-chip" style="color:${biz.color}">${biz.name}</span>`;
  if (task.due) {
    const d = new Date(task.due);
    metaHtml += ` · Due ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}, ${d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
  }
  if (task.recurring && FREQ_LABEL[task.recurring]) metaHtml += ` · ${FREQ_LABEL[task.recurring]}`;
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

  card.appendChild(cb);
  card.appendChild(body);
  return card;
}

function renderTasks() {
  const col = document.getElementById("taskCol");
  col.innerHTML = "";
  const filtered = tasks.filter(t => activeFilter === "all" || t.business === activeFilter);

  const groups = [
    { key: "high", label: "High priority", cls: "high" },
    { key: "med",  label: "Medium priority", cls: "med" },
    { key: "low",  label: "Low priority — still worth doing", cls: "low" },
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
    wrap.innerHTML = `<div class="priority-head ${g.cls}"><span class="bar"></span> ${g.label}</div>`;
    items.forEach(t => wrap.appendChild(taskCard(t)));
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

function renderSchedule() {
  const sched = document.getElementById("schedule");
  sched.innerHTML = "";
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const hStr = String(h).padStart(2, "0") + ":00";
    const row = document.createElement("div");
    row.className = "hour-row";
    const hr = document.createElement("div");
    hr.className = "hr"; hr.textContent = hourLabel(h);
    row.appendChild(hr);

    const covering = blocks.find(b => hStr >= b.start && hStr < b.end);
    if (covering) {
      const biz = bizById(covering.business);
      const blk = document.createElement("div");
      blk.className = "block";
      blk.style.background = biz.color;
      const isStart = hStr === covering.start;
      blk.innerHTML = `<span>${isStart ? covering.label : "↳ continued"}</span>`;
      if (isStart) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "rm"; rm.textContent = "✕";
        rm.onclick = () => { blocks = blocks.filter(b => b.id !== covering.id); saveBlocks(); renderAll(); };
        blk.appendChild(rm);
      }
      row.appendChild(blk);
    } else {
      const blk = document.createElement("button");
      blk.type = "button";
      blk.className = "block empty";
      blk.textContent = "Open";
      blk.onclick = () => toggleBlockForm(true, hStr);
      row.appendChild(blk);
    }
    sched.appendChild(row);
  }
}

function toggleBlockForm(show, presetStart) {
  const form = document.getElementById("addBlockForm");
  form.classList.toggle("show", show);
  if (show && presetStart) timeOptions(document.getElementById("blockStart"), presetStart);
  if (show) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
document.getElementById("addBlockBtn").onclick = () => toggleBlockForm(true);
document.getElementById("saveBlockBtn").onclick = () => {
  const label = document.getElementById("blockLabel").value.trim();
  const business = document.getElementById("blockBiz").value;
  const start = document.getElementById("blockStart").value;
  const end = document.getElementById("blockEnd").value;
  if (!label || start >= end) { alert("Give the block a label, and make sure the end time is after the start time."); return; }
  blocks.push({ id: uid(), label, business, start, end });
  saveBlocks();
  document.getElementById("blockLabel").value = "";
  toggleBlockForm(false);
  renderAll();
};

/* ---------- MINI CALENDAR ---------- */
function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  document.getElementById("calMonthLabel").textContent =
    now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

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
    if (d === now.getDate()) cell.classList.add("today");
    if (dueByDay[d]) {
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.style.background = bizById(dueByDay[d][0]).color;
      cell.appendChild(mark);
    }
    grid.appendChild(cell);
  }
}

/* ---------- REMINDERS ---------- */
function checkReminders() {
  let changed = false;
  tasks.forEach(t => {
    if (t.muted) return;
    const od = overdueInfo(t);
    if (!od) return;
    const last = t.lastNotified || new Date(t.due).getTime();
    if (Date.now() - last >= NAG_INTERVAL_MS) {
      t.lastNotified = Date.now();
      changed = true;
      notify(`Overdue: ${t.title}`, `${bizById(t.business).name} · ${od.hoursOverdue}h overdue. Complete it or update the due date to stop these reminders.`);
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
