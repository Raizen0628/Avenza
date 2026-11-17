import { auth, db } from "./firebase-config.js";
import { checkFile, uploadPrivate, extOf, signedUrl } from "./files.js";
import { mountChat } from "./chatbot.js";
import { logAudit } from "./audit.js";
import { icon } from "./icons.js";
import { esc, tag, when, toast, ask, entry, cap, reqText, isOpen, meets, coverage, coverText, tierText, tiersOf, TIER_NAME } from "./core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, getDocs, collection, query, where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

/* Content supplied by the project owner. Admins can override it in Scholarship Management (settings/scholarship). */
const DEF = {
  benefits: ["Full Tuition: 100% coverage of college tuition and school fees.", "Monthly Allowance: Financial stipend for daily expenses.", "Part-Time Work: Opportunities for work during semestral and Christmas breaks.", "Enrichment and Internships: Developmental activities and career training.", "Job Opportunities: Potential employment opportunities with the SM Group after graduation."],
  courses: ["BS in Computer Science", "Engineering: Computer, Mechanical, Civil, Electrical, Electronics", "Information Technology", "Accountancy, Accounting, Internal Auditing, Information Systems", "BSBA: Management and Financial Management", "Elementary or Secondary Education"],
  quals: ["Must be a Filipino citizen.", "Incoming college freshman; Grade 12 graduate (public or private) or ALS completer, subject to program rules.", "Completed Grade 10 in a public high school; private school graduates must meet the applicable DepEd voucher requirement.", "General Weighted Average of at least 92% (or equivalent) for the first semester of Grade 12.", "Total annual family household income of ₱250,000 or less."],
  docs: ["Report card", "Proof of household income", "Birth certificate"],
  instructions: "1. Complete your profile.  2. Submit the examination application.  3. Wait for admin review.  4. Take the exam on your published schedule.  5. If you pass, upload your documents.  6. Wait for the final decision.",
  deadlines: "No deadline has been published yet. Check Announcements."
};
const S = { };
const $ = id => document.getElementById(id);
const TITLES = { announcements: "Announcements", home: "Home", profile: "Profile", apply: "Apply for Exam", browse: "Browse Scholarships", scholarship: "Scholarship" };
let page = "home";

const ICON = Object.fromEntries(Object.keys(TITLES).map(k => [k, icon(k)]));
const navHtml = () => Object.entries(TITLES).map(([k, v]) => `<button data-p="${k}"><span class="ic">${ICON[k]}</span>${v}</button>`).join("");
$("nav").innerHTML = navHtml();

onAuthStateChanged(auth, async u => {
  if (!u) return;
  S.u = u;
  try { await load(); render(); mountChat(() => ({ docs: S.set?.docs || [] })); popups().catch(console.warn); } catch (e) { console.error(e); $("view").innerHTML = `<div class="card"><p class="note">Could not load your data (${esc(e.code || e.message)}). Check that Firestore is enabled and the rules are published.</p></div>`; }
});

async function load() {
  const u = S.u;
  let p = await getDoc(doc(db, "users", u.uid));
  if (!p.exists()) {
    await setDoc(doc(db, "users", u.uid), { role: "student", name: u.displayName || "", email: u.email, createdAt: serverTimestamp() });
    p = await getDoc(doc(db, "users", u.uid));
  }
  S.prof = p.data();
  if (S.prof.photoPath && S.photoFor !== S.prof.photoPath) {
    try { S.photoUrl = await signedUrl(S.prof.photoPath); S.photoFor = S.prof.photoPath; } catch (e) { console.warn("Photo not loaded:", e.message); S.photoUrl = ""; }
  }
  S.chg = (await getDocs(query(collection(db, "changeRequests"), where("uid", "==", u.uid)))).docs.map(x => ({ id: x.id, ...x.data() })).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
  S.app = (await getDoc(doc(db, "applications", u.uid))).data() || null;
  S.schos = (await getDocs(collection(db, "scholarships"))).docs.map(d => ({ id: d.id, ...d.data() }));
  S.sapps = {};
  (await getDocs(query(collection(db, "scholarshipApps"), where("uid", "==", u.uid)))).forEach(d => S.sapps[d.data().schoId] = d.data());
  const st = await getDoc(doc(db, "settings", "scholarship"));
  S.set = { ...DEF, ...(st.exists() ? st.data() : {}) };
  const byTime = (a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0);
  S.ann = (await getDocs(query(collection(db, "announcements"), where("status", "==", "published")))).docs.map(d => d.data()).sort(byTime);
  S.docs = {};
  (await getDocs(query(collection(db, "documents"), where("uid", "==", u.uid)))).forEach(d => S.docs[d.data().key] = d.data());
  S.notes = (await getDocs(query(collection(db, "notifications"), where("uid", "==", u.uid)))).docs.map(d => d.data()).sort(byTime);
  const seen = +localStorage.getItem("avz_seen_" + u.uid) || 0;
  $("dot").hidden = !(S.notes.some(n => (n.ts?.seconds || 0) * 1000 > seen) || S.ann.some(n => (n.ts?.seconds || 0) * 1000 > seen));
}

const aud = o => logAudit(o).catch(e => console.warn("Audit not written:", e));
const notify = (text) => addDoc(collection(db, "notifications"), { uid: S.u.uid, text, ts: serverTimestamp() });
const profDone = () => !!(S.prof.name && S.prof.phone && S.prof.school && S.prof.course);
const a = () => S.app;
const resultOut = () => a()?.result?.published ? a().result.status : null;

/* Scholarship rules: pass the exam first, and only ONE scholarship per student.
   Any scholarship application that is not rejected counts (pending or approved). */
const passedExam = () => resultOut() === "passed";
const activeSapp = () => Object.values(S.sapps).find(m => m.status !== "rejected");
const chosenId = () => a()?.exam?.form?.schoId || "";
const chosen = () => S.schos.find(x => x.id === chosenId());
const chosenOpen = () => { const c = chosen(); return !!c && isOpen(c); };
const canApply = s => passedExam() && (activeSapp() ? activeSapp().schoId === s.id : (!chosenOpen() || chosenId() === s.id));
const gateNote = () => {
  if (!passedExam()) {
    const res = resultOut();
    return `<p class="note">${res === "failed"
      ? "You did not pass the examination, so scholarship applications are not available."
      : a() ? "Scholarship applications open after you pass the exam."
      : "Apply for the scholarship exam first. Scholarship applications open after you pass it."}</p>`;
  }
  const cur = activeSapp();
  return cur
    ? `<p class="note">You already applied for ${esc(cur.schoName)}. Only one scholarship is allowed per student.</p>`
    : chosenOpen() ? `<p class="note">You passed the exam. You chose <b>${esc(chosen().name)}</b> when you applied for the exam, so that is the scholarship you can apply for.</p>` : `<p class="note">You passed the exam. You may apply for one scholarship.</p>`;
};
const docsList = () => S.set.docs;
const CH = [["name", "Full name"], ["phone", "Mobile number"], ["address", "Home address"], ["school", "School"], ["strand", "Strand / track"], ["course", "Intended course"], ["gwa", "GWA (%)"]];
const NEED = new Set(["name", "school", "strand", "course", "gwa"]);
const PROOF = { name: "a valid ID or birth certificate showing the new name", school: "a certificate of enrollment or school ID", strand: "a report card or certificate showing the strand", course: "a certificate of enrollment showing the course", gwa: "your latest grade report showing the new GWA" };
const CHECK = {
  name: v => v.split(/\s+/).length >= 2 || "Enter your first and last name.",
  phone: v => /^(09|\+639)\d{9}$/.test(v.replace(/\s|-/g, "")) || "Use a Philippine mobile number, like 09123456789.",
  address: v => v.length >= 10 || "Enter your complete address.",
  school: v => v.length >= 3 || "Enter the school name.",
  strand: v => v.length >= 2 || "Enter your strand or track.",
  course: v => v.length >= 3 || "Enter the course.",
  gwa: v => (v !== "" && Number.isFinite(+v) && +v >= 60 && +v <= 100) || "Enter a GWA between 60 and 100."
};

/* Pop-ups: exam passed, and the newest announcement. Each is shown once per device. */
async function popups() {
  const key = "avz_pop_" + S.u.uid; let seen = {};
  try { seen = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { /* ignore */ }
  const mark = id => { seen[id] = 1; localStorage.setItem(key, JSON.stringify(seen)); };
  if (resultOut() === "passed" && !seen.passed) {
    mark("passed");
    await ask("Congratulations, you passed!", [], "", `<p class="note good">Your exam result is out. You can now upload your documents and apply for your scholarship.</p>`);
  }
  const l = S.ann[0];
  if (l) { const id = "a" + (l.ts?.seconds || l.title); if (!seen[id]) { mark(id); await ask(l.title, [], "", `<p>${esc(l.body)}</p><small>${esc(when(l.ts))}</small>`); } }
}

const setAvatar = () => {
  const av = document.querySelector(".top .avatar");
  if (av && S.photoUrl && !av.dataset.p) { av.dataset.p = "1"; av.textContent = ""; av.style.cssText += `;background:center/cover url("${S.photoUrl}")`; }
};
{ const box = document.querySelector(".user"); if (box) new MutationObserver(setAvatar).observe(box, { childList: true }); }
const allDocs = st => docsList().length && docsList().every((_, i) => st.includes(S.docs["d" + i]?.status));

function steps() {
  const A = a(), x = A?.exam?.status, res = resultOut();
  return [
    ["Application submitted", !!A, A ? "Submitted" : "Fill in the form in Apply for Exam."],
    ["Admin review", x === "approved", x === "rejected" ? "Rejected: " + A.exam.reason : x === "approved" ? "Approved" : A ? "Pending review" : "Waiting for your application"],
    ["Exam schedule", !!A?.schedule?.published, A?.schedule?.published ? `${A.schedule.date} ${A.schedule.time}` : "Not yet published"],
    ["Exam result", !!res, res ? (res === "passed" ? "Passed" : "Did not pass") : "Awaiting result"],
    ["Documents submitted", res === "passed" && allDocs(["submitted", "approved"]), res === "passed" ? "Upload all required documents" : "Opens after you pass"],
    ["Documents verified", res === "passed" && allDocs(["approved"]), "Checked by the admin"]
  ];
}
const stage = () => { const s = steps(), i = s.findIndex(x => !x[1]); return i < 0 ? "Complete" : s[i][0]; };

const list = arr => `<ul class="plain">${arr.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
const NOTE = `<p class="note">Supplied project information. Verify against the latest official SM Foundation guidelines before applying.</p>`;

const pages = {
  home() {
    const l = S.ann[0], A = a();
    return `<section class="banner"><div><h1>Welcome, ${esc((S.prof.name || "Student").split(" ")[0])}</h1><p>Track your scholarship application in one place.</p></div></section>
    ${A ? "" : `<section class="card cta"><div><h2>Apply for the scholarship exam</h2><p>Submit your application, then wait for the admin to approve it.</p></div><button class="btn" data-p="apply">Apply now</button></section>`}<div class="grid2"><section class="card"><div class="head"><h2>Application summary</h2></div>
      <div class="row"><div><b>Current stage</b><small>${esc(stage())}</small></div></div>
      <div class="row"><div><b>Application ID</b><small>${esc(A?.appId || "Not submitted yet")}</small></div></div>
      <p><button class="btn" data-p="apply">${A ? "View application status" : "Apply for exam"}</button></p></section>
    <section class="card"><div class="head"><h2>Latest announcement</h2></div>${l ? `<b>${esc(l.title)}</b><p style="font-size:.85rem">${esc(l.body)}</p><small>${when(l.ts)}</small>` : `<p class="empty">No announcements yet.</p>`}</section></div>`;
  },
  scholarship() {
    return `<section class="card"><div class="head"><h2>SM Foundation College Scholarship Program</h2></div>${NOTE}</section>
    <div class="grid2"><section class="card"><div class="head"><h2>Benefits</h2></div>${list(S.set.benefits)}</section>
    <section class="card"><div class="head"><h2>Priority courses</h2></div>${list(S.set.courses)}</section>
    <section class="card"><div class="head"><h2>Basic qualifications</h2></div>${list(S.set.quals)}</section>
    <section class="card"><div class="head"><h2>Required documents</h2></div>${list(docsList())}<p class="note">Admin-confirmed list; opens only after you pass the exam.</p></section></div>
    <div class="grid2"><section class="card"><div class="head"><h2>How to apply</h2></div><p style="font-size:.85rem;line-height:1.7">${esc(S.set.instructions)}</p></section>
    <section class="card"><div class="head"><h2>Deadlines</h2></div><p style="font-size:.85rem;line-height:1.7">${esc(S.set.deadlines)}</p></section></div>`;
  },
  browse() {
    const list = S.schos.filter(s => isOpen(s) || S.sapps[s.id]);
    return `<section class="card"><div class="head"><h2>Available scholarships</h2></div><p class="note">Choose a scholarship, check the requirements, then apply. An admin will review your application and notify you.</p>${gateNote()}</section>` +
      `<section class="card"><div class="tools"><input id="sq" type="search" placeholder="Search scholarships" aria-label="Search scholarships"><select id="sf" aria-label="Filter"><option value="all">All</option><option value="open">Open only</option><option value="ok">I qualify</option></select></div><p class="empty" id="snone" hidden>No scholarships match your search.</p></section>` +
      (list.length ? list.map(s => {
        const m = S.sapps[s.id], open = isOpen(s);
        const mine = S.prof.gwaVerified ? coverage(s, S.prof.gwa) : 0;
        return `<section class="card sch" data-q="${esc((s.name + " " + s.provider + " " + s.description).toLowerCase())}" data-open="${open ? 1 : 0}" data-ok="${mine ? 1 : 0}"><div class="head"><h2><span class="hico">${icon("scholarship", 20)}</span>${esc(s.name)}</h2>${m ? tag(cap(m.status)) : tag(open ? "Open" : "Closed")}</div>
        <small>${esc(s.provider)}</small><p style="font-size:.85rem;line-height:1.7">${esc(s.description)}</p>
        <div class="row"><div><b>Requirements</b><small>${esc(reqText(s))}</small></div></div>
        <div class="row"><div><b>Your coverage</b><small>${S.prof.gwaVerified ? esc(coverText(mine)) + " (based on your verified GWA of " + esc(S.prof.gwa) + "%)" : "Shown after your GWA is verified"}</small></div></div>
        <div class="row"><div><b>Deadline</b><small>${s.deadline ? esc(s.deadline) : "No deadline"}${s.slots ? " · " + s.slots + " slots" : ""}</small></div></div>
        ${m ? (m.status === "rejected" && m.reason ? `<p class="note">Reason: ${esc(m.reason)}</p>` : m.status === "approved" ? `<p class="note">Congratulations! You were approved for this scholarship.</p>` : `<p class="note">Your application is pending review.</p>`) : open && canApply(s) ? `<p><button class="btn" data-sa="${esc(s.id)}">Apply</button></p>` : ""}</section>`;
      }).join("") : `<section class="card"><p class="empty">No scholarships are open right now.</p></section>`);
  },
  announcements() {
    return `<section class="card">${S.ann.length ? S.ann.map(n => `<div class="row"><div><b>${esc(n.title)}</b><small>${esc(n.body)}</small></div><small>${when(n.ts)}</small></div>`).join("") : `<p class="empty">No announcements yet.</p>`}</section>`;
  },
  apply() {
    const A = a(), s = steps(), cur = s.findIndex(x => !x[1]), X = A?.exam, f = X?.form || {}, lab = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
    let h = `<section class="card"><div class="head"><h2>Progress</h2>${A ? tag(lab[X.status]) : ""}</div><ol class="steps">${s.map((x, i) => `<li class="${x[1] ? "done" : i === cur ? "now" : ""}"><i>${x[1] ? "✓" : i + 1}</i><div><b>${x[0]}</b><small>${esc(x[2])}</small></div></li>`).join("")}</ol></section>`;
    if (!A) return h + `<section class="card"><div class="head"><h2>Exam application</h2></div><form class="fm" id="ef">
      <label>Full name<input name="name" required readonly value="${esc(S.prof.name)}"></label>
      <label>Mobile number<input name="phone" type="tel" required readonly value="${esc(S.prof.phone)}"></label>
      <label>Senior high school<input name="school" required readonly value="${esc(S.prof.school)}"></label>
      <label>Strand / track<input name="strand" required readonly value="${esc(S.prof.strand)}"></label>
      <label>Grade 12 1st-semester GWA (%)<input name="gwa" type="number" step="0.01" min="0" max="100" required value="${esc(S.prof.gwa ?? "")}" ${S.prof.gwaVerified ? "readonly" : ""}></label>
      <label>Annual household income (₱)<input name="income" type="number" min="0" required value="${esc(S.prof.income ?? "")}" ${S.prof.gwaVerified ? "readonly" : ""}></label>
      <label>First-choice course<input name="course" required readonly value="${esc(S.prof.course)}"></label>
      ${(() => { const open = S.schos.filter(isOpen); return open.length ? `<label>Scholarship you are applying for<select name="schoId" required><option value="">Choose a scholarship</option>${open.map(s => `<option value="${esc(s.id)}">${esc(s.name)}${S.prof.gwaVerified ? " · you would get " + esc(coverText(coverage(s, S.prof.gwa))) : ""}</option>`).join("")}</select></label>` : `<p class="note">No scholarships are open right now. You can still apply for the exam.</p>`; })()}
      <label class="chk"><input type="checkbox" name="cit" required> I am a Filipino citizen and the information above is true.</label>
      <button class="btn" type="submit">Submit application</button></form></section>`;
    h += `<p class="note">Application ID ${esc(A.appId)}${f.schoName ? " · Scholarship: " + esc(f.schoName) : ""}</p>`;
    if (X.status === "rejected") h += `<p class="note">Your application was rejected. Reason: ${esc(X.reason)}</p>`;
    if (X.status === "approved" && A.schedule?.published) { const c = A.schedule; h += `<section class="card"><div class="head"><h2>Your exam schedule</h2></div><div class="row"><div><b>${esc(c.date)} · ${esc(c.time)}</b><small>${esc(c.location)}</small></div></div><p style="font-size:.85rem">${esc(c.notes)}</p></section>`; }
    if (resultOut() === "passed") {
      h += `<section class="card"><div class="head"><h2>Documents</h2></div><p class="note">Accepted: PDF, JPG or PNG, up to 5 MB each.</p>${docsList().map((n, i) => {
        const d = S.docs["d" + i], st = d?.status, redo = !d || st === "rejected" || st === "correction";
        return `<div class="row"><div><b>${esc(n)}</b><small>${st === "rejected" || st === "correction" ? "Reason: " + esc(d.reason) : d ? "Uploaded" : "Not uploaded"}</small></div>${tag(d ? (st === "correction" ? "Correction" : st[0].toUpperCase() + st.slice(1)) : "Not started")}${redo ? `<input type="file" data-k="${i}" accept=".pdf,.jpg,.jpeg,.png">` : ""}</div>`;
      }).join("")}</section>`;
    }
    if (resultOut() === "failed") h += `<section class="card"><p class="note">You did not pass the examination, so document submission is not available.</p></section>`;
    return h;
  },
  profile() {
    const p = S.prof, f = (k, l, t = "text") => `<label>${l}<input name="${k}" type="${t}" value="${esc(p[k])}" required></label>`;
    const pendG = S.chg.find(c => c.field === "gwa" && c.status === "pending");
    return `<section class="card"><div class="head"><h2>Profile photo</h2></div><div class="pp"><div class="pp-img">${S.photoUrl ? `<img src="${esc(S.photoUrl)}" alt="Your profile photo">` : esc((p.name || "S")[0].toUpperCase())}</div>
      <div><label class="btn alt pick">${S.photoUrl ? "Change photo" : "Upload photo"}<input type="file" id="photo" accept=".jpg,.jpeg,.png" hidden></label><br><small>JPG or PNG, up to 5 MB.</small></div></div></section>
    <section class="card"><div class="head"><h2>Your details</h2></div><form class="fm" id="pf"><label>Email<input value="${esc(p.email)}" disabled></label>${f("name", "Full name")}${f("phone", "Mobile number", "tel")}${f("address", "Home address")}${f("school", "School")}${f("strand", "Strand / track")}${f("course", "Intended course")}<button class="btn" type="submit">Save profile</button></form></section>
    <section class="card"><div class="head"><h2>Verified GWA</h2></div><p class="note">Your GWA was checked against your grade report, so it can only be changed with new proof. An admin reviews the request.</p>
      <div class="row"><div><b>GWA</b><small>${p.gwa != null ? esc(p.gwa) + "%" : "-"}</small></div>${pendG ? tag("Pending") : `<button class="sm alt" data-chg="gwa">Request change</button>`}</div></section>
    ${S.chg.length ? `<section class="card"><div class="head"><h2>Your GWA change requests</h2></div>${S.chg.map(c => `<div class="row"><div><b>${esc(c.label)}</b><small>${esc(c.oldValue)} → ${esc(c.newValue)}${c.decision ? " · " + esc(c.decision) : ""}</small></div>${tag(cap(c.status))}</div>`).join("")}</section>` : ""}`;
  },
};

function render() {
  $("ptitle").textContent = TITLES[page];
  $("nav").innerHTML = navHtml();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.p === page));
  $("view").innerHTML = pages[page]();
  setAvatar();
}
const go = p => { page = p; render(); scrollTo(0, 0); };
const reload = async () => { await load(); render(); };

const filterCards = () => {
  const q = ($("sq")?.value || "").toLowerCase().trim(), f = $("sf")?.value || "all"; let n = 0;
  document.querySelectorAll(".sch").forEach(c => {
    const show = (!q || c.dataset.q.includes(q)) && (f === "all" || (f === "open" && c.dataset.open === "1") || (f === "ok" && c.dataset.ok === "1"));
    c.hidden = !show; if (show) n++;
  });
  const none = $("snone"); if (none) none.hidden = n > 0;
};
document.addEventListener("input", e => { if (e.target.id === "sq") filterCards(); });
document.addEventListener("change", e => { if (e.target.id === "sf") filterCards(); });

document.addEventListener("click", async e => {
  const sa = e.target.closest("[data-sa]");
  if (sa) {
    const s = S.schos.find(x => x.id === sa.dataset.sa);
    if (!s || S.sapps[s.id]) return;
    if (!passedExam()) { toast("Pass the scholarship exam first."); return; }
    const cur = activeSapp();
    if (!cur && !canApply(s)) { toast("You chose " + (chosen()?.name || "another scholarship") + " when you applied for the exam."); return; }
    if (cur && cur.schoId !== s.id) { toast("You already applied for " + cur.schoName + ". Only one scholarship is allowed."); return; }
    if (!profDone()) { toast("Complete your profile first."); go("profile"); return; }
    if (!S.prof.gwaVerified || S.prof.gwa == null) { toast("Your GWA has not been verified yet."); return; }
    const f = { gwa: +S.prof.gwa, income: +S.prof.income || 0, course: S.prof.course || "", school: S.prof.school || "", coverage: coverage(s, S.prof.gwa) };
    const miss = meets(s, f);
    const summary = `<dl class="sum"><dt>Scholarship</dt><dd>${esc(s.name)}</dd><dt>Verified GWA</dt><dd>${esc(f.gwa)}%</dd><dt>You would receive</dt><dd>${esc(coverText(f.coverage))}</dd><dt>Household income</dt><dd>₱${f.income.toLocaleString()}</dd><dt>Course</dt><dd>${esc(f.course)}</dd></dl>`
      + (miss.length ? `<p class="note warn">You do not meet: ${esc(miss.join("; "))}. You can still submit, and an admin makes the final decision.</p>` : `<p class="note good">You meet the listed requirements.</p>`)
      + `<label class="chk"><input type="checkbox" required> I confirm these details are true and I understand that false information can disqualify me.</label>`;
    if (!await ask("Review before you submit", [], "Submit application", summary)) return;
    try {
      await setDoc(doc(db, "scholarshipApps", `${S.u.uid}_${s.id}`), {
        uid: S.u.uid, schoId: s.id, schoName: s.name, name: S.prof.name, email: S.prof.email, form: f,
        status: "pending", reason: "", createdAt: serverTimestamp(),
        history: [entry("student", "Applied for " + s.name)]
      });
      aud({ action: "scholarship_app.submitted", targetType: "scholarshipApp", targetId: `${S.u.uid}_${s.id}`, summary: "Applied for " + s.name, after: f });
      await notify(`Your application for ${s.name} was submitted and is pending review.`);
      await reload(); toast("Application submitted. Status: Pending.");
    } catch (err) { console.error(err); toast("Failed: " + (err.code || err.message)); }
    return;
  }
  const t = e.target.closest("[data-p]");
  if (t) { e.preventDefault(); go(t.dataset.p); }
  if (e.target.closest("#bell")) {
    const items = [...S.notes.map(n => [n.ts, n.text]), ...S.ann.slice(0, 5).map(n => [n.ts, "Announcement: " + n.title])].sort((x, y) => (y[0]?.seconds || 0) - (x[0]?.seconds || 0));
    localStorage.setItem("avz_seen_" + S.u.uid, Date.now()); $("dot").hidden = true;
    ask("Notifications", [], "", items.length ? `<ul class="plain">${items.map(i => `<li>${esc(i[1])}<br><small>${when(i[0])}</small></li>`).join("")}</ul>` : `<p class="empty">Nothing yet.</p>`);
  }
});

document.addEventListener("submit", async e => {
  if (e.target.id !== "pf" && e.target.id !== "ef") return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    if (e.target.id === "pf") {
      const keys = ["name", "phone", "address", "school", "strand", "course"], ch = [], label = k => CH.find(x => x[0] === k)[1];
      for (const k of keys) {
        const v = String(f[k] ?? "").trim(), bad = CHECK[k](v);
        if (bad !== true) throw { message: bad };
        if (v !== String(S.prof[k] ?? "").trim()) ch.push([k, v]);
      }
      if (!ch.length) { toast("No changes to save."); btn.disabled = false; return; }
      const list = `<ul class="plain">${ch.map(([k, v]) => `<li><b>${esc(label(k))}</b>: ${esc(S.prof[k] || "none")} → ${esc(v)}</li>`).join("")}</ul>`;
      if (!await ask("Are you sure you want to save these changes?", [], "Yes, save", list)) { btn.disabled = false; return; }
      await updateDoc(doc(db, "users", S.u.uid), Object.fromEntries(ch));
      aud({ action: "profile.updated", targetType: "user", targetId: S.u.uid, summary: "Updated " + ch.map(([k]) => label(k)).join(", "), before: Object.fromEntries(ch.map(([k]) => [k, S.prof[k] || ""])), after: Object.fromEntries(ch) });
      await reload(); toast("Profile saved.");
    }
    if (e.target.id === "ef") {
      const P = S.prof, sch = S.schos.find(x => x.id === f.schoId);
      if (S.schos.some(isOpen) && !sch) throw { message: "Choose the scholarship you are applying for." };
      const gwa = S.prof.gwaVerified ? +S.prof.gwa : +f.gwa, income = S.prof.gwaVerified ? +S.prof.income : +f.income;
      if (!(gwa >= 0 && gwa <= 100) || !(income >= 0)) throw { message: "Check your GWA and income values." };
      const appId = "AVZ-" + new Date().getFullYear() + "-" + S.u.uid.slice(0, 6).toUpperCase();
      await setDoc(doc(db, "applications", S.u.uid), {
        uid: S.u.uid, appId, name: P.name, email: S.prof.email, createdAt: serverTimestamp(),
        exam: { status: "pending", reason: "", form: { school: P.school, strand: P.strand, gwa, income, course: P.course, schoId: sch?.id || "", schoName: sch?.name || "" } },
        schedule: null, result: { status: "awaiting", published: false }, final: { decision: "pending", published: false },
        history: [entry("student", "Submitted examination application")]
      });
      aud({ action: "exam_app.submitted", targetType: "application", targetId: S.u.uid, summary: "Submitted examination application", after: { school: P.school, course: P.course, gwa, income, scholarship: sch?.name || "" } });
      await notify("Your examination application was submitted and is pending review.");
      await reload(); toast("Application submitted. Status: Pending Review.");
    }
  } catch (err) { console.error(err); toast("Failed: " + (err.message || err.code)); btn.disabled = false; }
});

document.addEventListener("change", async e => {
  const inp = e.target.closest("input[type=file][data-k]");
  if (!inp || !inp.files[0]) return;
  const file = inp.files[0], k = inp.dataset.k, ext = extOf(file);
  const bad = await checkFile(file);
  if (bad) { toast(bad); inp.value = ""; return; }
  inp.disabled = true; toast("Uploading…");
  try {
    const path = `${S.u.uid}/d${k}-${Date.now()}.${ext}`;
    await uploadPrivate(path, file);
    await setDoc(doc(db, "documents", `${S.u.uid}_d${k}`), { uid: S.u.uid, key: "d" + k, name: docsList()[k], path, fileName: file.name, status: "submitted", reason: "", ts: serverTimestamp() });
    aud({ action: "document.uploaded", targetType: "document", targetId: `${S.u.uid}_d${k}`, summary: `Uploaded ${docsList()[k]}`, after: { fileName: file.name } });
    await notify(`Document submitted: ${docsList()[k]}`);
    await reload(); toast("Upload successful. Waiting for review.");
  } catch (err) { console.error(err); toast("Upload failed: " + (err.code || err.message)); inp.disabled = false; }
});

/* ---------- Profile: change requests (need admin approval) and photo ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-chg]"); if (!b) return;
  const k = b.dataset.chg, def = CH.find(x => x[0] === k), cur = S.prof[k], need = NEED.has(k);
  const r = await ask("Request change: " + def[1], [], "Send request", `<p class="note">Current value: <b>${esc(cur ?? "-")}</b>. It stays until an admin approves your request.</p>
    <label>New value<input name="v" required></label>
    <label>Reason for the change<textarea name="why" rows="3" required></textarea></label>
    <label>Proof ${need ? "(required)" : "(optional)"}${need ? ": " + esc(PROOF[k]) : ""}<input type="file" name="proof" accept=".pdf,.jpg,.jpeg,.png" ${need ? "required" : ""}></label>`);
  if (!r) return;
  const v = String(r.v).trim(), bad = CHECK[k](v);
  if (bad !== true) { toast(bad); return; }
  if (String(cur ?? "").trim().toLowerCase() === v.toLowerCase()) { toast("That is already your current value."); return; }
  const file = r.proof && r.proof.size ? r.proof : null;
  if (need && !file) { toast("Proof is required for this change."); return; }
  try {
    let files = [];
    if (file) {
      const why = await checkFile(file); if (why) { toast(why); return; }
      const path = `${S.u.uid}/changes/${k}-${Date.now()}.${extOf(file)}`;
      await uploadPrivate(path, file); files = [{ label: "Proof", path, name: file.name }];
    }
    const ref = await addDoc(collection(db, "changeRequests"), { uid: S.u.uid, email: S.prof.email, name: S.prof.name, field: k, label: def[1], oldValue: String(cur ?? ""), newValue: v, reason: String(r.why).trim(), files, status: "pending", decision: "", createdAt: serverTimestamp() });
    aud({ action: "profile_change.submitted", targetType: "changeRequest", targetId: ref.id, summary: `Requested change of ${def[1]}`, before: { [k]: String(cur ?? "") }, after: { [k]: v } });
    await notify(`Your request to change ${def[1]} was sent for admin review.`);
    await reload(); toast("Request sent. An admin will review it.");
  } catch (err) { console.error(err); toast("Failed: " + (err.code || err.message)); }
});

document.addEventListener("change", async e => {
  if (e.target.id !== "photo" || !e.target.files[0]) return;
  const file = e.target.files[0], ext = extOf(file); e.target.value = "";
  if (!["jpg", "jpeg", "png"].includes(ext)) { toast("Use a JPG or PNG photo."); return; }
  const bad = await checkFile(file); if (bad) { toast(bad); return; }
  try {
    const path = `${S.u.uid}/avatar/photo-${Date.now()}.${ext}`;
    await uploadPrivate(path, file);
    await updateDoc(doc(db, "users", S.u.uid), { photoPath: path });
    aud({ action: "profile.photo_changed", targetType: "user", targetId: S.u.uid, summary: "Changed profile photo" });
    document.querySelector(".top .avatar")?.removeAttribute("data-p");
    await reload(); toast("Photo updated.");
  } catch (err) { console.error(err); toast("Failed: " + (err.code || err.message)); }
});