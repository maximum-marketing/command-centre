/* ---------- CONFIG ---------- */
const BUSINESSES = [
  { id: "devlin",       name: "Devlin Lounges",           color: "var(--devlin)" },
  { id: "chesterfield", name: "Chesterfield Lounges",     color: "var(--chesterfield)" },
  { id: "marketing",    name: "Maximum Marketing",        color: "var(--marketing)" },
  { id: "therapy",      name: "Small Business Therapy",   color: "var(--therapy)" },
];
const NAG_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

/* ---------- STATE ---------- */
let tasks = load("cc_tasks", []);
let blocks = load("cc_blocks", []);
let activeFilter = "all";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveTasks() { localStorage.setItem("cc_tasks", JSON.stringify(tasks)); }
function saveBlocks() { localStorage.setItem("cc_blocks", JSON.stringify(blocks)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function bizById(id) { return BUSINESSES.find(b => b.id === id) || BUSINESSES[0]; }

/* ---------- SIDEBAR ---------- */
function renderSidebar() {
  const nav = document.getElementById("bizNav");
  nav.innerHTML = '<div class="nav-label">Businesses</div>';

  const allBtn = document.createElement("button");
  allBtn.className = "biz-item" + (activeFilter === "all" ? " active" : "");
  allBtn.style.setProperty("--dot", "#8f97a3");
  allBtn.innerHTML = `<span class="dot"></span> All tasks <span class="count">${tasks.filter(t=>t.status!=='done').length}</span>`;
  allBtn.onclick = () => { activeFilter = "all"; renderAll(); };
  nav.appendChild(allBtn);

  BUSINESSES.forEach(b => {
    const count = tasks.filter(t => t.business === b.id && t.status !== "done").length;
    const btn = document.createElement("button");
    btn.className = "biz-item" + (activeFilter === b.id ? " active" : "");
    btn.style.setProperty("--dot", b.color);
    btn.innerHTML = `<span class="dot"></span> ${b.name} <span class="count">${count}</span>`;
    btn.onclick = () => { activeFilter = b.id; renderAll(); };
    nav.appendChild(btn);
  });
}

/* ---------- TASK FORM SELECTS ---------- */
function populateBizSelects() {
  const selects = [document.getElementById("bizSelect"), document.getElementById("blockBiz")];
  selects.forEach(sel => {
    sel.innerHTML = "";
    BUSINESSES.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id; opt.textContent = b.name;
      sel.appendChild(opt);
    });
  });
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

function taskCard(task) {
  const biz = bizById(task.business);
  const card = document.createElement("div");
  card.className = "task-card" + (task.status === "done" ? " done" : "");
  card.style.setProperty("--dot", biz.color);

  const cb = document.createElement("button");
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
  del.className = "del-btn"; del.textContent = "✕"; del.title = "Delete task";
  del.onclick = () => { tasks = tasks.filter(t => t.id !== task.id); saveTasks(); renderAll(); };
  titleRow.appendChild(title); titleRow.appendChild(del);

  const meta = document.createElement("div");
  meta.className = "meta";
  let metaHtml = `<span class="biz-chip" style="color:${biz.color}">${biz.name}</span>`;
  if (task.due) {
    const d = new Date(task.due);
    metaHtml += ` · Due ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}, ${d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
  }
  const od = overdueInfo(task);
  if (od) metaHtml += ` · <span class="overdue">Overdue ${od.hoursOverdue}h — next nag in ${od.nextNagH}h</span>`;
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
    col.innerHTML = '<div class="empty-msg">No tasks here yet — add one above, or pick another business.</div>';
  }
}

/* ---------- ADD TASK ---------- */
function addTask(titleOverride) {
  const input = document.getElementById("taskInput");
  const title = (titleOverride || input.value).trim();
  if (!title) return;
  const business = document.getElementById("bizSelect").value;
  const priority = document.getElementById("prioritySelect").value;
  const dueRaw = document.getElementById("dueInput").value;
  tasks.push({
    id: uid(), title, business, priority,
    due: dueRaw ? new Date(dueRaw).toISOString() : null,
    status: "open", subtasks: [], lastNotified: null,
  });
  saveTasks();
  input.value = "";
  document.getElementById("dueInput").value = "";
  renderAll();
}
document.getElementById("addBtn").onclick = () => addTask();
document.getElementById("taskInput").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

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
      blk.style.background = biz.color.startsWith("var") ? getComputedStyle(document.documentElement).getPropertyValue(biz.color.slice(4,-1)) : biz.color;
      const isStart = hStr === covering.start;
      blk.innerHTML = `<span>${isStart ? covering.label : "↳ continued"}</span>`;
      if (isStart) {
        const rm = document.createElement("button");
        rm.className = "rm"; rm.textContent = "✕";
        rm.onclick = () => { blocks = blocks.filter(b => b.id !== covering.id); saveBlocks(); renderAll(); };
        blk.appendChild(rm);
      }
      row.appendChild(blk);
    } else {
      const blk = document.createElement("div");
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
      const biz = bizById(dueByDay[d][0]);
      mark.style.background = getComputedStyle(document.documentElement).getPropertyValue(biz.color.slice(4,-1)) || "#888";
      cell.appendChild(mark);
    }
    grid.appendChild(cell);
  }
}

/* ---------- REMINDERS ---------- */
function checkReminders() {
  let changed = false;
  tasks.forEach(t => {
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
