import { auth, db } from "./firebase-config.js";
import { supabase } from "./supabase-config.js";
import { esc, tag, when, toast, ask, history, cap, reqText, isOpen } from "./core.js";
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
const TITLES = { home: "Home", apply: "Apply for Exam", browse: "Browse Scholarships", scholarship: "Scholarship", announcements: "Announcements", profile: "Profile" };
let page = "home";

const ICON = { home: "", apply: "", browse: "", scholarship: "", announcements: "📢", profile: "" };
const navHtml = () => Object.entries(TITLES).map(([k, v]) => `<button data-p="${k}"><span class="ic">${ICON[k]}</span>${v}</button>`).join("");
$("nav").innerHTML = navHtml();

onAuthStateChanged(auth, async u => {
  if (!u) return;
  S.u = u;
  try { await load(); render(); } catch (e) { console.error(e); $("view").innerHTML = `<div class="card"><p class="note">Could not load your data (${esc(e.code || e.message)}). Check that Firestore is enabled and the rules are published.</p></div>`; }
});

async function load() {
  const u = S.u;
  let p = await getDoc(doc(db, "users", u.uid));
  if (!p.exists()) {
    await setDoc(doc(db, "users", u.uid), { role: "student", name: u.displayName || "", email: u.email, createdAt: serverTimestamp() });
    p = await getDoc(doc(db, "users", u.uid));
  }
  S.prof = p.data();
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

const notify = (text) => addDoc(collection(db, "notifications"), { uid: S.u.uid, text, ts: serverTimestamp() });
const profDone = () => !!(S.prof.name && S.prof.phone && S.prof.school && S.prof.course);
const a = () => S.app;
const resultOut = () => a()?.result?.published ? a().result.status : null;
const docsList = () => S.set.docs;
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
    return `<section class="banner"><div><h1>Welcome, ${esc((S.prof.name || "Student").split(" ")[0])}</h1><p>Track your scholarship application in one place.</p></div><span class="cap">🎓</span></section>
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
    return `<section class="card"><div class="head"><h2>Available scholarships</h2></div><p class="note">Choose a scholarship, check the requirements, then apply. An admin will review your application and notify you.</p></section>` +
      (list.length ? list.map(s => {
        const m = S.sapps[s.id], open = isOpen(s);
        return `<section class="card"><div class="head"><h2>${esc(s.name)}</h2>${m ? tag(cap(m.status)) : tag(open ? "Open" : "Closed")}</div>
        <small>${esc(s.provider)}</small><p style="font-size:.85rem;line-height:1.7">${esc(s.description)}</p>
        <div class="row"><div><b>Requirements</b><small>${esc(reqText(s))}</small></div></div>
        <div class="row"><div><b>Deadline</b><small>${s.deadline ? esc(s.deadline) : "No deadline"}${s.slots ? " · " + s.slots + " slots" : ""}</small></div></div>
        ${m ? (m.status === "rejected" && m.reason ? `<p class="note">Reason: ${esc(m.reason)}</p>` : m.status === "approved" ? `<p class="note">Congratulations! You were approved for this scholarship.</p>` : `<p class="note">Your application is pending review.</p>`) : open ? `<p><button class="btn" data-sa="${esc(s.id)}">Apply</button></p>` : ""}</section>`;
      }).join("") : `<section class="card"><p class="empty">No scholarships are open right now.</p></section>`);
  },
  announcements() {
    return `<section class="card">${S.ann.length ? S.ann.map(n => `<div class="row"><div><b>${esc(n.title)}</b><small>${esc(n.body)}</small></div><small>${when(n.ts)}</small></div>`).join("") : `<p class="empty">No announcements yet.</p>`}</section>`;
  },
  apply() {
    const A = a(), s = steps(), cur = s.findIndex(x => !x[1]), X = A?.exam, f = X?.form || {}, lab = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
    let h = `<section class="card"><div class="head"><h2>Progress</h2>${A ? tag(lab[X.status]) : ""}</div><ol class="steps">${s.map((x, i) => `<li class="${x[1] ? "done" : i === cur ? "now" : ""}"><i>${x[1] ? "✓" : i + 1}</i><div><b>${x[0]}</b><small>${esc(x[2])}</small></div></li>`).join("")}</ol></section>`;
    if (!A) return h + `<section class="card"><div class="head"><h2>Exam application</h2></div><form class="fm" id="ef">
      <label>Full name<input name="name" required value="${esc(S.prof.name)}"></label>
      <label>Mobile number<input name="phone" type="tel" required value="${esc(S.prof.phone)}"></label>
      <label>Senior high school<input name="school" required value="${esc(S.prof.school)}"></label>
      <label>Strand / track<input name="strand" required value="${esc(S.prof.strand)}"></label>
      <label>Grade 12 1st-semester GWA (%)<input name="gwa" type="number" step="0.01" min="0" max="100" required></label>
      <label>Annual household income (₱)<input name="income" type="number" min="0" required></label>
      <label>First-choice course<input name="course" required value="${esc(S.prof.course)}"></label>
      <label class="chk"><input type="checkbox" name="cit" required> I am a Filipino citizen and the information above is true.</label>
      <button class="btn" type="submit">Submit application</button></form></section>`;
    h += `<section class="card"><div class="head"><h2>Your application</h2><small>ID ${esc(A.appId)}</small></div>
      <div class="row"><div><b>School</b><small>${esc(f.school)} · ${esc(f.strand)}</small></div></div>
      <div class="row"><div><b>Course</b><small>${esc(f.course)}</small></div></div>
      <div class="row"><div><b>GWA</b><small>${esc(f.gwa)}%</small></div></div></section>`;
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
    const p = S.prof, f = (k, l, t = "text") => `<label>${l}<input name="${k}" type="${t}" value="${esc(p[k])}"></label>`;
    return `<section class="card"><form class="fm" id="pf"><label>Email<input value="${esc(p.email)}" disabled></label>${f("name", "Full name")}${f("phone", "Mobile number", "tel")}${f("address", "Home address")}${f("school", "School")}${f("strand", "Strand / track")}${f("course", "Intended course")}<button class="btn" type="submit">Save profile</button></form></section>`;
  },
};

function render() {
  $("ptitle").textContent = TITLES[page];
  $("nav").innerHTML = navHtml();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.p === page));
  $("view").innerHTML = pages[page]();
}
const go = p => { page = p; render(); scrollTo(0, 0); };
const reload = async () => { await load(); render(); };

document.addEventListener("click", async e => {
  const sa = e.target.closest("[data-sa]");
  if (sa) {
    const s = S.schos.find(x => x.id === sa.dataset.sa);
    if (!s || S.sapps[s.id]) return;
    if (!profDone()) { toast("Complete your profile first."); go("profile"); return; }
    const r = await ask("Apply · " + s.name, [
      { k: "gwa", label: "GWA (%)", req: 1 },
      { k: "income", label: "Annual household income (₱)", req: 1 },
      { k: "course", label: "Course", v: S.prof.course, req: 1 }
    ], "Submit", `<p class="note">Requirements: ${esc(reqText(s))}. Your answers must be true; the admin will verify them.</p>`);
    if (!r) return;
    const f = { gwa: +r.gwa, income: +r.income, course: r.course.trim(), school: S.prof.school || "" };
    if (!(f.gwa >= 0 && f.gwa <= 100) || !(f.income >= 0)) { toast("Check your GWA and income values."); return; }
    try {
      await setDoc(doc(db, "scholarshipApps", `${S.u.uid}_${s.id}`), {
        uid: S.u.uid, schoId: s.id, schoName: s.name, name: S.prof.name, email: S.prof.email, form: f,
        status: "pending", reason: "", createdAt: serverTimestamp(),
        history: [history("student", "Applied for " + s.name)]
      });
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
      await updateDoc(doc(db, "users", S.u.uid), { name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim(), school: f.school.trim(), strand: f.strand.trim(), course: f.course.trim() });
      await reload(); toast("Profile saved.");
    }
    if (e.target.id === "ef") {
      await updateDoc(doc(db, "users", S.u.uid), { name: f.name.trim(), phone: f.phone.trim(), school: f.school.trim(), strand: f.strand.trim(), course: f.course.trim() });
      const gwa = +f.gwa, income = +f.income;
      if (!(gwa >= 0 && gwa <= 100) || !(income >= 0)) throw { message: "Check your GWA and income values." };
      const appId = "AVZ-" + new Date().getFullYear() + "-" + S.u.uid.slice(0, 6).toUpperCase();
      await setDoc(doc(db, "applications", S.u.uid), {
        uid: S.u.uid, appId, name: f.name.trim(), email: S.prof.email, createdAt: serverTimestamp(),
        exam: { status: "pending", reason: "", form: { school: f.school, strand: f.strand, gwa, income, course: f.course } },
        schedule: null, result: { status: "awaiting", published: false }, final: { decision: "pending", published: false },
        history: [history("student", "Submitted examination application")]
      });
      await notify("Your examination application was submitted and is pending review.");
      await reload(); toast("Application submitted. Status: Pending Review.");
    }
  } catch (err) { console.error(err); toast("Failed: " + (err.message || err.code)); btn.disabled = false; }
});

document.addEventListener("change", async e => {
  const inp = e.target.closest("input[type=file][data-k]");
  if (!inp || !inp.files[0]) return;
  const file = inp.files[0], k = inp.dataset.k, ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) { toast("Only PDF, JPG or PNG files are allowed."); inp.value = ""; return; }
  if (file.size > 5 * 1024 * 1024) { toast("File is larger than 5 MB."); inp.value = ""; return; }
  inp.disabled = true; toast("Uploading…");
  try {
    const path = `${S.u.uid}/d${k}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("docs").upload(path, file, { contentType: file.type });
    if (error) throw { message: error.message };
    const url = supabase.storage.from("docs").getPublicUrl(path).data.publicUrl;
    await setDoc(doc(db, "documents", `${S.u.uid}_d${k}`), { uid: S.u.uid, key: "d" + k, name: docsList()[k], url, fileName: file.name, status: "submitted", reason: "", ts: serverTimestamp() });
    await notify(`Document submitted: ${docsList()[k]}`);
    await reload(); toast("Upload successful. Waiting for review.");
  } catch (err) { console.error(err); toast("Upload failed: " + (err.code || err.message)); inp.disabled = false; }
});