import { auth, db } from "./firebase-config.js";
import { esc, tag, when, toast, ask, entry, cap, meets, reqText } from "./core.js";
import { stageAudit, logAudit } from "./audit.js";
import { signedUrl } from "./files.js";
import { icon } from "./icons.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, getDocs, collection, arrayUnion, serverTimestamp, query, orderBy, limit, writeBatch }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const MAIL_FN = "https://oqpgvxaswfpcjonglrdy.supabase.co/functions/v1/notify-email";
async function mailIt(to, text) {
  if (!to || !text) return;
  try {
    const token = await auth.currentUser.getIdToken();
    await fetch(MAIL_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ to, text })
    });
  } catch (e) { console.warn("Email not sent:", e); }
}

const $ = id => document.getElementById(id);
const S = {};
const TITLES = { enroll: "Enrollment Review", apps: "Examination Applications", sched: "Exam Scheduling", res: "Exam Results", docs: "Document Verification", schos: "Scholarships", sapps: "Scholarship Applications", sch: "Program Information", ann: "Announcements", people: "Applicant Management", audit: "Audit Log" };
let page = "enroll";
const ICON = Object.fromEntries(Object.keys(TITLES).map(k => [k, icon(k)]));
const pend = k => k === "enroll" && S.enr ? S.enr.filter(e => e.status === "pending").length : k === "apps" && S.apps ? S.apps.filter(a => a.exam.status === "pending").length : k === "sapps" && S.sapps ? S.sapps.filter(a => a.status === "pending").length : 0;
const navHtml = () => Object.entries(TITLES).map(([k, v]) => `<button data-p="${k}"><span class="ic">${ICON[k]}</span>${v}${pend(k) ? `<em class="pill">${pend(k)}</em>` : ""}</button>`).join("");
$("nav").innerHTML = navHtml();

onAuthStateChanged(auth, async u => { if (u) { S.u = u; await load(); } });

async function load() {
  try {
    const rows = async c => (await getDocs(collection(db, c))).docs.map(d => ({ id: d.id, ...d.data() }));
    S.apps = await rows("applications"); S.docs = await rows("documents"); S.ann = await rows("announcements");
    S.schos = await rows("scholarships"); S.sapps = await rows("scholarshipApps");
    S.enr = await rows("enrollments"); S.enr.sort((x, y) => (y.submittedAt?.seconds || 0) - (x.submittedAt?.seconds || 0));
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

let docUser = null; /* applicant whose documents are open in Document Verification */

function docDetail(id) {
  const a = S.apps.find(x => x.id === id) || { name: id, appId: "" }, ds = dstat(id);
  const ok = ds.filter(d => d.status === "approved").length;
  return `<p>${btn("dback", "", "← Back to applicants", "alt")}</p>` +
    card(`${esc(a.name)} <small>${esc(a.appId)}</small>`, `<p class="note">${ok} of ${ds.length} documents approved.</p>` +
      table(["Document", "Status", "Actions"], ds.map(d => [
        `<a href="#" data-file="${esc(d.path || "")}" data-url="${esc(d.url || "")}" data-doc="${esc(d.id)}">${esc(d.name)}</a><br><small>${esc(d.fileName)}</small>`,
        tag(d.status === "correction" ? "Correction" : d.status[0].toUpperCase() + d.status.slice(1)) + (d.reason ? `<br><small>${esc(d.reason)}</small>` : ""),
        d.status === "submitted" ? btn("dok", d.id, "Approve") + btn("dfix", d.id, "Request correction", "bad") : ""
      ])));
}

const pages = {
  enroll() {
    const c = t => S.enr.filter(e => e.status === t).length, n = (l, v, col) => `<div class="stat" style="--c:${col}"><small>${l}</small><b>${v}</b></div>`;
    return `<section class="stats">${n("Submissions", S.enr.length, "var(--brand2)")}${n("Pending", c("pending"), "var(--wait)")}${n("Approved", c("approved"), "var(--ok)")}${n("Declined", c("declined"), "var(--bad)")}</section>`
      + card("Student enrollment", table(["Student", "School · Course", "Submitted", "Status", "Action"],
        S.enr.map(e => { const f = e.form || {};
          return [`<b>${esc(f.name)}</b><br><small>${esc(e.email)}</small>`, `${esc(f.school)}<br><small>${esc(f.course)}</small>`, when(e.submittedAt),
            tag(cap(e.status)) + (e.reason ? `<br><small>${esc(e.reason)}</small>` : ""),
            btn("enrview", e.id, e.status === "pending" ? "Review" : "View", e.status === "pending" ? "" : "alt")]; }), ["Pending", "Approved", "Declined"]));
  },
  audit() {
    const L = S.audit || [], acts = [...new Set(L.map(x => x.action))].sort();
    return `<p><button class="btn alt" data-a="auditcsv">Export CSV</button></p>` + card("Audit log", `<p class="note">Entries cannot be edited or deleted, not even by admins. Showing the latest ${L.length}.</p>`
      + table(["Time", "Actor", "Action", "Target", "Details"], L.map(x => [
        `<small>${x.ts?.seconds ? new Date(x.ts.seconds * 1000).toLocaleString() : ""}</small>`,
        `${esc(x.actorEmail)}<br><small>${esc(x.actorRole)}</small>`, `<code>${esc(x.action)}</code>`,
        `${esc(x.targetType)}<br><small>${esc(x.targetId)}</small>`, esc(x.summary) + (x.reason ? `<br><small>Reason: ${esc(x.reason)}</small>` : "")]), acts));
  },
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
    if (docUser) return docDetail(docUser);
    const pending = id => dstat(id).filter(d => d.status === "submitted").length;
    const ids = [...new Set(S.docs.map(d => d.uid))].sort((x, y) => pending(y) - pending(x));
    return card("Applicants with submitted documents", table(["Applicant", "Approved", "Status", "Action"], ids.map(id => {
      const a = S.apps.find(x => x.id === id) || { name: id, appId: "" }, ds = dstat(id);
      const n = st => ds.filter(d => d.status === st).length, p = pending(id);
      const tg = p ? tag("Submitted") + `<br><small>${p} to review</small>`
        : n("correction") ? tag("Correction") + `<br><small>Waiting for resubmission</small>`
        : n("rejected") ? tag("Rejected")
        : tag("Approved");
      return [nm(a), `${n("approved")} / ${ds.length}`, tg, btn("dview", id, "View documents")];
    }), ["Submitted", "Correction", "Rejected", "Approved"]));
  },
  ann() {
    return `<p><button class="btn" data-a="newann">+ New announcement</button></p>` + card("Announcements", table(["Title", "Date", "Status", "Actions"], S.ann.map(n => [`<b>${esc(n.title)}</b><br><small>${esc(n.body)}</small>`, when(n.ts), tag(n.status === "published" ? "Published" : "Archived"), btn("editann", n.id, "Edit", "alt") + btn("togann", n.id, n.status === "published" ? "Archive" : "Publish")])));
  },
  people() {
    return card("Applicants", table(["Applicant", "Email", "Stage", "Action"], S.apps.map(a => [nm(a), esc(a.email), a.result.published ? "Documents" : a.schedule ? "Exam" : a.exam.status === "rejected" ? "Rejected" : a.exam.status === "approved" ? "Approved" : "Pending review", btn("hist", a.id, "History", "alt")])));
  },
};

/* ---------- audit + review helpers ---------- */
const aud = (action, targetType, targetId, summary, o = {}) =>
  logAudit({ action, targetType, targetId, summary, role: "admin", ...o }).catch(e => console.warn("Audit not written:", e));
const flat = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/\./g, "_"), v]));
const FLD = [["name", "Name"], ["provider", "Provider"], ["description", "Description"], ["minGwa", "Minimum GWA"], ["maxIncome", "Max income"], ["slots", "Slots"], ["deadline", "Deadline"]];
const diff = (o, n) => [...FLD.map(([k, l]) => [l, o[k], n[k]]), ["Courses", (o.courses || []).join(", "), (n.courses || []).join(", ")]]
  .map(([l, x, y]) => [l, String(x || ""), String(y || "")]).filter(([, x, y]) => x !== y);

async function loadAudit() {
  try { S.audit = (await getDocs(query(collection(db, "auditLogs"), orderBy("ts", "desc"), limit(500)))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { console.error(e); S.audit = []; toast("Could not load the audit log: " + (e.code || e.message)); }
}

function exportAudit() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Time", "Actor", "Role", "Action", "Target type", "Target id", "Summary", "Reason"], ...(S.audit || []).map(x =>
    [x.ts?.seconds ? new Date(x.ts.seconds * 1000).toISOString() : "", x.actorEmail, x.actorRole, x.action, x.targetType, x.targetId, x.summary, x.reason])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
  a.download = "avenza-audit-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click(); URL.revokeObjectURL(a.href);
  aud("audit.exported", "auditLog", "csv", `Exported ${(S.audit || []).length} entries`);
}

/* Enrollment review: details and ID documents side by side, then approve or decline. */
function reviewEnroll(id) {
  const e = S.enr.find(x => x.id === id); if (!e) return;
  const f = e.form || {}, row = (l, v) => `<dt>${l}</dt><dd>${esc(v || "-")}</dd>`, pending = e.status === "pending";
  const d = document.createElement("dialog"); d.className = "wide";
  d.innerHTML = `<div class="dlg"><h3>Enrollment review</h3>
    <div class="cols2"><div><h4>Personal</h4><dl class="sum">${row("Name", f.name)}${row("Birthdate", f.birthdate)}${row("Mobile", f.phone)}${row("Address", f.address)}</dl>
    <h4>Household</h4><dl class="sum">${row("Annual income", f.income ? "₱" + (+f.income).toLocaleString() : "")}${row("Guardian", f.guardian)}${row("Guardian mobile", f.guardianPhone)}</dl></div>
    <div><h4>Academic</h4><dl class="sum">${row("School", f.school)}${row("Strand", f.strand)}${row("LRN", f.lrn)}${row("Course", f.course)}${row("GWA", f.gwa ? f.gwa + "%" : "")}</dl>
    <h4>Documents</h4><ul class="plain files">${(e.files || []).map(x => `<li><a href="#" data-file="${esc(x.path)}" data-doc="${esc(e.id)}">${esc(x.label)}</a> <small>${esc(x.name)}</small></li>`).join("") || "<li>No files</li>"}</ul></div></div>
    ${pending ? "" : `<p class="note">${esc(cap(e.status))}${e.reviewedBy ? " by " + esc(e.reviewedBy) : ""}${e.reason ? ". Reason: " + esc(e.reason) : ""}</p>`}
    <div class="acts"><button class="alt" data-x="close">Close</button>${pending ? `<button class="bad" data-x="declined">Decline</button><button data-x="approved">Approve</button>` : ""}</div></div>`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-x]"); if (!b) return;
    if (b.dataset.x === "close") { d.close(); return; }
    if (b.dataset.x === "approved") {
      if (!await ask("Approve " + f.name + "?", [], "Approve", `<p class="note">This verifies their details and unlocks the student portal.</p>`)) return;
      d.close(); decideEnroll(e, "approved", "");
    } else {
      const r = await ask("Decline enrollment", [{ k: "r", label: "Reason (required, the student will see it)", area: 1, req: 1 }], "Decline");
      if (r) { d.close(); decideEnroll(e, "declined", r.r.trim()); }
    }
  });
  d.showModal();
}

/* One atomic write: decision + verified profile + audit entry + notification. */
async function decideEnroll(e, status, reason) {
  const f = e.form || {}, now = serverTimestamp(), batch = writeBatch(db);
  const msg = status === "approved" ? "Your enrollment was approved. You can now use Avenza." : "Your enrollment was declined. Reason: " + reason + " Please fix it and resubmit.";
  batch.update(doc(db, "enrollments", e.id), { status, reason, reviewedBy: S.u.email, reviewedByUid: S.u.uid, reviewedAt: now });
  if (status === "approved") batch.set(doc(db, "users", e.id), { name: f.name, phone: f.phone, address: f.address, school: f.school, strand: f.strand, course: f.course, birthdate: f.birthdate, verified: true, verifiedAt: now }, { merge: true });
  stageAudit(batch, { action: "enrollment." + status, targetType: "enrollment", targetId: e.id, summary: `${f.name}: enrollment ${status}`, reason, before: { status: e.status }, after: { status }, role: "admin" });
  batch.set(doc(collection(db, "notifications")), { uid: e.id, text: msg, ts: now });
  try { await batch.commit(); mailIt(e.email, msg); await load(); toast("Enrollment " + status + "."); }
  catch (er) { console.error(er); toast("Failed: " + (er.code || er.message) + ". Nothing was changed."); }
}

function render() {
  $("ptitle").textContent = TITLES[page];
  $("nav").innerHTML = navHtml();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.p === page));
  $("view").innerHTML = pages[page]();
}

/* Write a change, log it in history, notify the student. Only reports success if the write worked. */
async function act(id, changes, log, note) {
  try {
    await updateDoc(doc(db, "applications", id), { ...changes, history: arrayUnion(entry(S.u.email, log)) });
    if (note) {
      await addDoc(collection(db, "notifications"), { uid: id, text: note, ts: serverTimestamp() });
      mailIt((S.apps.find(a => a.id === id) || {}).email, note);
    }
    aud("application.updated", "application", id, log, { after: flat(changes) });
    await load(); toast("Saved: " + log);
  } catch (e) { console.error(e); toast("Failed: " + (e.code || e.message) + ". Nothing was changed."); }
}
async function docAct(id, status, reason, note) {
  try {
    const d = S.docs.find(x => x.id === id);
    await updateDoc(doc(db, "documents", id), { status, reason, reviewedBy: S.u.email });
    const msg = note.replace("{n}", d.name) + (reason ? " Reason: " + reason : "");
    await addDoc(collection(db, "notifications"), { uid: d.uid, text: msg, ts: serverTimestamp() });
    mailIt((S.apps.find(a => a.id === d.uid) || {}).email, msg);
    await updateDoc(doc(db, "applications", d.uid), { history: arrayUnion(entry(S.u.email, `${d.name}: ${status}`)) });
    aud("document." + status, "document", id, `${d.name}: ${status}`, { reason });
    await load(); toast("Saved.");
  } catch (e) { console.error(e); toast("Failed: " + (e.code || e.message)); }
}

async function sAct(x, status, reason) {
  try {
    await updateDoc(doc(db, "scholarshipApps", x.id), { status, reason, reviewedBy: S.u.email, history: arrayUnion(entry(S.u.email, `Scholarship application ${status}`)) });
    const msg = `Your application for ${x.schoName} was ${status}.` + (reason ? " Reason: " + reason : "");
    await addDoc(collection(db, "notifications"), { uid: x.uid, text: msg, ts: serverTimestamp() });
    mailIt(x.email, msg);
    aud("scholarship_app." + status, "scholarshipApp", x.id, `${x.name}: ${x.schoName} ${status}`, { reason });
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
  if (n) { page = n.dataset.p; docUser = null; if (page === "audit") await loadAudit(); render(); return; }
  const fl = e.target.closest("[data-file]");
  if (fl) {
    e.preventDefault();
    const w = window.open("", "_blank"); if (w) w.opener = null;
    try {
      const url = fl.dataset.file ? await signedUrl(fl.dataset.file) : fl.dataset.url;
      if (!url) throw new Error("No file attached");
      if (w) w.location.href = url; else location.href = url;
      aud("document.viewed", "document", fl.dataset.doc || "", "Opened " + (fl.textContent || "a file"));
    } catch (er) { if (w) w.close(); toast("Could not open the file: " + er.message); }
    return;
  }
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = b.dataset.id, A = S.apps.find(x => x.id === id), k = b.dataset.a;
  if (k === "dview") { docUser = id; render(); scrollTo(0, 0); return; }
  if (k === "dback") { docUser = null; render(); return; }
  if (k === "enrview") { reviewEnroll(id); return; }
  if (k === "auditcsv") { exportAudit(); return; }
  if (k === "approve" && await ask("Approve this application?", [], "Approve")) act(id, { "exam.status": "approved", "exam.reason": "" }, "Exam application approved", "Your examination application was approved. Your schedule will be posted soon.");
  if (k === "reject") { const r = await ask("Reject application", [{ k: "r", label: "Reason (required)", area: 1, req: 1 }], "Reject"); if (r) act(id, { "exam.status": "rejected", "exam.reason": r.r.trim() }, "Exam application rejected", "Your examination application was rejected. Reason: " + r.r.trim()); }
  if (k === "sched") { const v = A.schedule || {}, r = await ask("Exam schedule · " + A.name, [{ k: "date", label: "Date", type: "date", v: v.date, req: 1 }, { k: "time", label: "Time", type: "time", v: v.time, req: 1 }, { k: "location", label: "Location / meeting link", v: v.location, req: 1 }, { k: "notes", label: "Instructions", area: 1, v: v.notes }], "Publish"); if (r) act(id, { schedule: { ...r, published: true } }, A.schedule ? "Exam schedule changed" : "Exam schedule published", A.schedule ? "Your exam schedule was changed. Check Application Status." : "Your exam schedule is published. Check Application Status."); }
  if ((k === "pass" || k === "fail") && await ask(`Record ${k === "pass" ? "PASS" : "FAIL"} for ${A.name}?`, [], "Record", `<p class="note">It stays hidden from the student until you publish it.</p>`)) act(id, { "result.status": k === "pass" ? "passed" : "failed" }, "Result recorded: " + (k === "pass" ? "passed" : "failed"));
  if (k === "pubres" && await ask("Publish result for " + A.name + "?", [], "Publish")) act(id, { "result.published": true }, "Exam result published", A.result.status === "passed" ? "Your exam result is out: you passed. Document submission is now open." : "Your exam result is out. Check Application Status.");
  if (k === "dok" && await ask("Approve this document?", [], "Approve")) docAct(id, "approved", "", "Document approved: {n}.");
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
      const ch = s.id ? diff(s, data) : [];
      if (s.id && !ch.length) { toast("No changes to save."); return; }
      const detail = s.id ? `<ul class="plain">${ch.map(c => `<li><b>${esc(c[0])}</b>: ${esc(c[1] || "none")} → ${esc(c[2] || "none")}</li>`).join("")}</ul>` : `<p class="note">${esc(data.name)}: ${esc(reqText(data))}. It opens to students immediately.</p>`;
      if (!await ask(s.id ? "Save these changes?" : "Publish this scholarship?", [], "Confirm", detail)) return;
      try {
        let sid = id;
        if (s.id) await updateDoc(doc(db, "scholarships", id), data); else sid = (await addDoc(collection(db, "scholarships"), { ...data, status: "open", createdAt: serverTimestamp() })).id;
        aud(s.id ? "scholarship.updated" : "scholarship.created", "scholarship", sid, data.name, { before: s.id ? Object.fromEntries(ch.map(c => [c[0], c[1]])) : null, after: s.id ? Object.fromEntries(ch.map(c => [c[0], c[2]])) : data });
        await load(); toast("Scholarship saved.");
      } catch (er) { toast("Failed: " + (er.code || er.message)); }
    }
  }
  if (k === "togsch") {
    const s = S.schos.find(x => x.id === id), to = s.status === "open" ? "closed" : "open";
    if (!await ask(`${to === "closed" ? "Close" : "Reopen"} "${s.name}"?`, [], "Confirm", `<p class="note">${to === "closed" ? "Students will no longer be able to apply." : "Students will be able to apply again."}</p>`)) return;
    try { await updateDoc(doc(db, "scholarships", id), { status: to }); aud("scholarship." + (to === "closed" ? "closed" : "reopened"), "scholarship", id, s.name, { before: { status: s.status }, after: { status: to } }); await load(); toast("Updated."); } catch (er) { toast("Failed: " + (er.code || er.message)); }
  }
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
    if (r) try { n.id ? await updateDoc(doc(db, "announcements", id), { title: r.title, body: r.body }) : await addDoc(collection(db, "announcements"), { ...r, status: "published", ts: serverTimestamp() }); aud(n.id ? "announcement.updated" : "announcement.created", "announcement", id || "new", r.title); await load(); toast("Announcement saved."); } catch (er) { toast("Failed: " + er.code); }
  }
  if (k === "togann") { const n = S.ann.find(x => x.id === id); try { await updateDoc(doc(db, "announcements", id), { status: n.status === "published" ? "archived" : "published" }); aud("announcement." + (n.status === "published" ? "archived" : "published"), "announcement", id, n.title); await load(); toast("Updated."); } catch (er) { toast("Failed: " + er.code); } }
});

document.addEventListener("submit", async e => {
  if (e.target.id !== "sf") return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), out = {};
  for (const k of ["benefits", "courses", "quals", "docs"]) if (f[k].trim()) out[k] = f[k].split("\n").map(s => s.trim()).filter(Boolean);
  if (f.instructions.trim()) out.instructions = f.instructions.trim();
  if (f.deadlines.trim()) out.deadlines = f.deadlines.trim();
  if (!await ask("Publish these changes?", [], "Publish", `<p class="note">This changes what every student sees on the Scholarship page.</p>`)) return;
  try { const before = S.set || {}; await setDoc(doc(db, "settings", "scholarship"), out); aud("settings.updated", "settings", "scholarship", "Program information updated", { before, after: out }); await load(); toast("Scholarship information saved."); } catch (er) { toast("Failed: " + er.code); }
});