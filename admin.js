import { auth, db } from "./firebase-config.js";
import { esc, tag, when, toast, ask, history, cap, meets, reqText } from "./core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, getDocs, collection, arrayUnion, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const S = {};
const TITLES = { apps: "Examination Applications", sched: "Exam Scheduling", res: "Exam Results", docs: "Document Verification", schos: "Scholarships", sapps: "Scholarship Applications", sch: "Program Information", ann: "Announcements", people: "Applicant Management" };
let page = "apps";
const ICON = { apps: "", sched: "", res: "", docs: "", schos: "", sapps: "", sch: "", ann: "", people: "" };
const pend = k => k === "apps" && S.apps ? S.apps.filter(a => a.exam.status === "pending").length : k === "sapps" && S.sapps ? S.sapps.filter(a => a.status === "pending").length : 0;
const navHtml = () => Object.entries(TITLES).map(([k, v]) => `<button data-p="${k}"><span class="ic">${ICON[k]}</span>${v}${pend(k) ? `<em class="pill">${pend(k)}</em>` : ""}</button>`).join("");
$("nav").innerHTML = navHtml();

onAuthStateChanged(auth, async u => { if (u) { S.u = u; await load(); } });

async function load() {
  try {
    const rows = async c => (await getDocs(collection(db, c))).docs.map(d => ({ id: d.id, ...d.data() }));
    S.apps = await rows("applications"); S.docs = await rows("documents"); S.ann = await rows("announcements");
    S.schos = await rows("scholarships"); S.sapps = await rows("scholarshipApps");
    S.sapps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    S.ann.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0));
    const st = await getDoc(doc(db, "settings", "scholarship")); S.set = st.exists() ? st.data() : {};
    render();
  } catch (e) { console.error(e); $("view").innerHTML = `<div class="card"><p class="note">Could not load data (${esc(e.code || e.message)}). Make sure the rules are published and your user has role "admin".</p></div>`; }
}

const dstat = id => S.docs.filter(d => d.uid === id);
const need = () => (S.set.docs || ["Report card", "Proof of household income", "Birth certificate"]).length;
const docsOk = id => dstat(id).filter(d => d.status === "approved").length >= need();
const exStat = a => ({ pending: "Pending", approved: "Approved", rejected: "Rejected" }[a.exam.status]);
const resStat = a => a.result.status === "awaiting" ? "Awaiting" : a.result.status === "passed" ? "Passed" : "Failed";

function table(cols, rows, statuses) {
  return `<div class="tools"><input class="ts" type="search" placeholder="Search…">${statuses ? `<select class="tf"><option value="">All statuses</option>${statuses.map(s => `<option>${s}</option>`).join("")}</select>` : ""}</div>
  <div class="tw"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="empty">Nothing to show.</td></tr>`}</tbody></table></div>`;
}
const btn = (act, id, label, cls = "") => `<button class="sm ${cls}" data-a="${act}" data-id="${id}">${label}</button>`;
const card = (h, body) => `<section class="card"><div class="head"><h2>${h}</h2></div>${body}</section>`;
const nm = a => `<b>${esc(a.name)}</b><br><small>${esc(a.appId)}</small>`;

const pages = {
  schos() {
    const used = s => S.sapps.filter(a => a.schoId === s.id && a.status === "approved").length;
    return `<p><button class="btn" data-a="newsch">+ New scholarship</button></p>` + card("Scholarships", table(["Scholarship", "Requirements", "Deadline · Slots", "Status", "Actions"],
      S.schos.map(s => [`<b>${esc(s.name)}</b><br><small>${esc(s.provider)}</small>`, esc(reqText(s)), `${esc(s.deadline || "No deadline")}${s.slots ? ` · ${used(s)} / ${s.slots} filled` : ""}`, tag(s.status === "open" ? "Open" : "Closed"), btn("editsch", s.id, "Edit", "alt") + btn("togsch", s.id, s.status === "open" ? "Close" : "Open")])));
  },
  sapps() {
    return card("Scholarship applications", table(["Applicant", "Scholarship", "GWA · Income · Course", "Auto-check", "Status", "Actions"],
      S.sapps.map(a => {
        const s = S.schos.find(x => x.id === a.schoId), miss = s ? meets(s, a.form) : [];
        return [`<b>${esc(a.name)}</b><br><small>${esc(a.email)}</small>`, esc(a.schoName), `${esc(a.form.gwa)}% · ₱${(+a.form.income).toLocaleString()}<br><small>${esc(a.form.course)}</small>`,
          miss.length ? tag("Not qualified") + `<br><small>${esc(miss.join("; "))}</small>` : tag("Qualified"),
          tag(cap(a.status)) + (a.reason ? `<br><small>${esc(a.reason)}</small>` : ""),
          a.status === "pending" ? btn("sok", a.id, "Approve") + btn("sno", a.id, "Reject", "bad") : ""];
      }), ["Pending", "Approved", "Rejected"]));
  },
  sch() {
    const s = S.set, v = (k, d) => (s[k] || d || []);
    const L = (k, d) => (Array.isArray(v(k, d)) ? v(k, d).join("\n") : v(k, d));
    return card("Scholarship information", `<p class="note">Review each field against the latest official SM Foundation guidelines before publishing. Leave a field empty to use the default text.</p>
    <form class="fm" id="sf" style="margin-top:12px">
    ${[["benefits", "Benefits (one per line)"], ["courses", "Priority courses (one per line)"], ["quals", "Qualifications (one per line)"], ["docs", "Required documents (one per line)"]].map(([k, l]) => `<label>${l}<textarea name="${k}" rows="5" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:12px">${esc(L(k))}</textarea></label>`).join("")}
    <label>Application instructions<input name="instructions" value="${esc(s.instructions)}"></label>
    <label>Application period / deadlines<input name="deadlines" value="${esc(s.deadlines)}"></label>
    <button class="btn" type="submit">Save</button></form>`);
  },
  apps() {
    const c = t => S.apps.filter(a => a.exam.status === t).length, n = (l, v, col) => `<div class="stat" style="--c:${col}"><small>${l}</small><b>${v}</b></div>`;
    return `<section class="stats">${n("Total applicants", S.apps.length, "var(--brand2)")}${n("Pending", c("pending"), "var(--wait)")}${n("Approved", c("approved"), "var(--ok)")}${n("Rejected", c("rejected"), "var(--bad)")}</section>` + card("Examination applications", table(["Applicant", "School · Course", "GWA / Income", "Status", "Actions"],
      S.apps.map(a => { const f = a.exam.form; return [nm(a), `${esc(f.school)}<br><small>${esc(f.course)}</small>`, `${f.gwa}% · ₱${(+f.income).toLocaleString()}`, tag(exStat(a)) + (a.exam.reason ? `<br><small>${esc(a.exam.reason)}</small>` : ""), a.exam.status === "pending" ? btn("approve", a.id, "Approve") + btn("reject", a.id, "Reject", "bad") : ""]; }), ["Pending", "Approved", "Rejected"]));
  },
  sched() {
    const ok = S.apps.filter(a => a.exam.status === "approved");
    return card("Approved applicants", table(["Applicant", "Schedule", "Action"], ok.map(a => [nm(a), a.schedule ? `${esc(a.schedule.date)} ${esc(a.schedule.time)}<br><small>${esc(a.schedule.location)}</small>` : tag("Awaiting"), btn("sched", a.id, a.schedule ? "Change" : "Set schedule")])));
  },
  res() {
    const ok = S.apps.filter(a => a.exam.status === "approved" && a.schedule);
    return card("Examination results", table(["Applicant", "Result", "Published", "Actions"], ok.map(a => [nm(a), tag(resStat(a)), a.result.published ? tag("Published") : tag("Draft"),
      a.result.published ? "" : btn("pass", a.id, "Pass") + btn("fail", a.id, "Fail", "bad") + (a.result.status !== "awaiting" ? btn("pubres", a.id, "Publish") : "")]), ["Awaiting", "Passed", "Failed"]));
  },
  docs() {
    return card("Submitted documents", table(["Applicant", "Document", "Status", "Actions"], S.docs.map(d => {
      const a = S.apps.find(x => x.id === d.uid) || { name: d.uid, appId: "" };
      return [nm(a), `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a><br><small>${esc(d.fileName)}</small>`, tag(d.status === "correction" ? "Correction" : d.status[0].toUpperCase() + d.status.slice(1)) + (d.reason ? `<br><small>${esc(d.reason)}</small>` : ""),
        d.status === "submitted" ? btn("dok", d.id, "Approve") + btn("dfix", d.id, "Request correction", "bad") : ""];
    }), ["Submitted", "Approved", "Rejected", "Correction"]));
  },
  ann() {
    return `<p><button class="btn" data-a="newann">+ New announcement</button></p>` + card("Announcements", table(["Title", "Date", "Status", "Actions"], S.ann.map(n => [`<b>${esc(n.title)}</b><br><small>${esc(n.body)}</small>`, when(n.ts), tag(n.status === "published" ? "Published" : "Archived"), btn("editann", n.id, "Edit", "alt") + btn("togann", n.id, n.status === "published" ? "Archive" : "Publish")])));
  },
  people() {
    return card("Applicants", table(["Applicant", "Email", "Stage", "Action"], S.apps.map(a => [nm(a), esc(a.email), a.result.published ? "Documents" : a.schedule ? "Exam" : a.exam.status === "rejected" ? "Rejected" : a.exam.status === "approved" ? "Approved" : "Pending review", btn("hist", a.id, "History", "alt")])));
  },
};

function render() {
  $("ptitle").textContent = TITLES[page];
  $("nav").innerHTML = navHtml();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.p === page));
  $("view").innerHTML = pages[page]();
}

/* Write a change, log it in history, notify the student. Only reports success if the write worked. */
async function act(id, changes, log, note) {
  try {
    await updateDoc(doc(db, "applications", id), { ...changes, history: arrayUnion(history(S.u.email, log)) });
    if (note) await addDoc(collection(db, "notifications"), { uid: id, text: note, ts: serverTimestamp() });
    await load(); toast("Saved: " + log);
  } catch (e) { console.error(e); toast("Failed: " + (e.code || e.message) + ". Nothing was changed."); }
}
async function docAct(id, status, reason, note) {
  try {
    const d = S.docs.find(x => x.id === id);
    await updateDoc(doc(db, "documents", id), { status, reason, reviewedBy: S.u.email });
    await addDoc(collection(db, "notifications"), { uid: d.uid, text: note.replace("{n}", d.name) + (reason ? " Reason: " + reason : ""), ts: serverTimestamp() });
    await updateDoc(doc(db, "applications", d.uid), { history: arrayUnion(history(S.u.email, `${d.name}: ${status}`)) });
    await load(); toast("Saved.");
  } catch (e) { console.error(e); toast("Failed: " + (e.code || e.message)); }
}

async function sAct(x, status, reason) {
  try {
    await updateDoc(doc(db, "scholarshipApps", x.id), { status, reason, reviewedBy: S.u.email, history: arrayUnion(history(S.u.email, `Scholarship application ${status}`)) });
    await addDoc(collection(db, "notifications"), { uid: x.uid, text: `Your application for ${x.schoName} was ${status}.` + (reason ? " Reason: " + reason : ""), ts: serverTimestamp() });
    await load(); toast("Saved.");
  } catch (e) { console.error(e); toast("Failed: " + (e.code || e.message) + ". Nothing was changed."); }
}

document.addEventListener("input", e => {
  const root = $("view"), q = (root.querySelector(".ts")?.value || "").toLowerCase(), f = (root.querySelector(".tf")?.value || "").toLowerCase();
  if (!e.target.closest(".tools")) return;
  root.querySelectorAll("tbody tr").forEach(r => { const t = r.textContent.toLowerCase(); r.hidden = !(t.includes(q) && t.includes(f)); });
});

document.addEventListener("click", async e => {
  const n = e.target.closest("#nav [data-p]");
  if (n) { page = n.dataset.p; render(); return; }
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = b.dataset.id, A = S.apps.find(x => x.id === id), k = b.dataset.a;
  if (k === "approve" && await ask("Approve this application?", [], "Approve")) act(id, { "exam.status": "approved", "exam.reason": "" }, "Exam application approved", "Your examination application was approved. Your schedule will be posted soon.");
  if (k === "reject") { const r = await ask("Reject application", [{ k: "r", label: "Reason (required)", area: 1, req: 1 }], "Reject"); if (r) act(id, { "exam.status": "rejected", "exam.reason": r.r.trim() }, "Exam application rejected", "Your examination application was rejected. Reason: " + r.r.trim()); }
  if (k === "sched") { const v = A.schedule || {}, r = await ask("Exam schedule · " + A.name, [{ k: "date", label: "Date", type: "date", v: v.date, req: 1 }, { k: "time", label: "Time", type: "time", v: v.time, req: 1 }, { k: "location", label: "Location / meeting link", v: v.location, req: 1 }, { k: "notes", label: "Instructions", area: 1, v: v.notes }], "Publish"); if (r) act(id, { schedule: { ...r, published: true } }, A.schedule ? "Exam schedule changed" : "Exam schedule published", A.schedule ? "Your exam schedule was changed. Check Application Status." : "Your exam schedule is published. Check Application Status."); }
  if (k === "pass" || k === "fail") act(id, { "result.status": k === "pass" ? "passed" : "failed" }, "Result recorded: " + (k === "pass" ? "passed" : "failed"));
  if (k === "pubres" && await ask("Publish result for " + A.name + "?", [], "Publish")) act(id, { "result.published": true }, "Exam result published", A.result.status === "passed" ? "Your exam result is out: you passed. Document submission is now open." : "Your exam result is out. Check Application Status.");
  if (k === "dok") docAct(id, "approved", "", "Document approved: {n}.");
  if (k === "dfix") { const r = await ask("Request correction", [{ k: "r", label: "Reason (required)", area: 1, req: 1 }], "Send"); if (r) docAct(id, "correction", r.r.trim(), "Correction requested for {n}."); }
  if (k === "hist") ask("History · " + A.name, [], "", `<ul class="plain">${[...A.history].reverse().map(h => `<li>${esc(h.text)}<br><small>${new Date(h.t).toLocaleString()} · ${esc(h.by)}</small></li>`).join("")}</ul>`);
  if (k === "newsch" || k === "editsch") {
    const s = S.schos.find(x => x.id === id) || {};
    const r = await ask(s.id ? "Edit scholarship" : "New scholarship", [
      { k: "name", label: "Scholarship name", v: s.name, req: 1 },
      { k: "provider", label: "Provider / sponsor", v: s.provider },
      { k: "description", label: "Description", v: s.description, area: 1, req: 1 },
      { k: "minGwa", label: "Minimum GWA % (blank = none)", v: s.minGwa || "" },
      { k: "maxIncome", label: "Max annual household income ₱ (blank = none)", v: s.maxIncome || "" },
      { k: "courses", label: "Allowed courses, comma-separated (blank = any)", v: (s.courses || []).join(", ") },
      { k: "slots", label: "Number of slots (blank = unlimited)", v: s.slots || "" },
      { k: "deadline", label: "Deadline", type: "date", v: s.deadline }
    ], "Save");
    if (r) {
      const data = { name: r.name.trim(), provider: r.provider.trim(), description: r.description.trim(), minGwa: +r.minGwa || 0, maxIncome: +r.maxIncome || 0, courses: r.courses.split(",").map(x => x.trim()).filter(Boolean), slots: +r.slots || 0, deadline: r.deadline || "" };
      try { s.id ? await updateDoc(doc(db, "scholarships", id), data) : await addDoc(collection(db, "scholarships"), { ...data, status: "open", createdAt: serverTimestamp() }); await load(); toast("Scholarship saved."); } catch (er) { toast("Failed: " + (er.code || er.message)); }
    }
  }
  if (k === "togsch") { const s = S.schos.find(x => x.id === id); try { await updateDoc(doc(db, "scholarships", id), { status: s.status === "open" ? "closed" : "open" }); await load(); toast("Updated."); } catch (er) { toast("Failed: " + (er.code || er.message)); } }
  if (k === "sok") {
    const x = S.sapps.find(y => y.id === id), s = S.schos.find(y => y.id === x.schoId);
    const full = s?.slots && S.sapps.filter(y => y.schoId === x.schoId && y.status === "approved").length >= s.slots;
    const miss = s ? meets(s, x.form) : [];
    const warn = (full ? `<p class="note">All ${s.slots} slots are already filled.</p>` : "") + (miss.length ? `<p class="note">Does not meet: ${esc(miss.join("; "))}.</p>` : "");
    if (await ask("Approve " + x.name + " for " + x.schoName + "?", [], "Approve", warn)) sAct(x, "approved", "");
  }
  if (k === "sno") { const x = S.sapps.find(y => y.id === id), r = await ask("Reject application", [{ k: "r", label: "Reason (required)", area: 1, req: 1 }], "Reject"); if (r) sAct(x, "rejected", r.r.trim()); }
  if (k === "newann" || k === "editann") {
    const n = S.ann.find(x => x.id === id) || {}, r = await ask(n.id ? "Edit announcement" : "New announcement", [{ k: "title", label: "Title", v: n.title, req: 1 }, { k: "body", label: "Message", v: n.body, area: 1, req: 1 }], "Publish");
    if (r) try { n.id ? await updateDoc(doc(db, "announcements", id), { title: r.title, body: r.body }) : await addDoc(collection(db, "announcements"), { ...r, status: "published", ts: serverTimestamp() }); await load(); toast("Announcement saved."); } catch (er) { toast("Failed: " + er.code); }
  }
  if (k === "togann") { const n = S.ann.find(x => x.id === id); try { await updateDoc(doc(db, "announcements", id), { status: n.status === "published" ? "archived" : "published" }); await load(); toast("Updated."); } catch (er) { toast("Failed: " + er.code); } }
});

document.addEventListener("submit", async e => {
  if (e.target.id !== "sf") return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), out = {};
  for (const k of ["benefits", "courses", "quals", "docs"]) if (f[k].trim()) out[k] = f[k].split("\n").map(s => s.trim()).filter(Boolean);
  if (f.instructions.trim()) out.instructions = f.instructions.trim();
  if (f.deadlines.trim()) out.deadlines = f.deadlines.trim();
  try { await setDoc(doc(db, "settings", "scholarship"), out); await load(); toast("Scholarship information saved."); } catch (er) { toast("Failed: " + er.code); }
});