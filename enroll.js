/* AVENZA – student enrollment: details + ID documents, reviewed by an admin. */
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, multiFactor, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, setDoc, writeBatch, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { esc } from "./core.js";
import { checkFile, uploadPrivate, extOf } from "./files.js";
import { stageAudit } from "./audit.js";

const $ = id => document.getElementById(id);
const stage = $("stage");

/* ---------- Form definition ---------- */
const age = d => { const t = new Date(d), n = new Date(); let a = n.getFullYear() - t.getFullYear(); if (n < new Date(n.getFullYear(), t.getMonth(), t.getDate())) a--; return a; };
const num = (v, lo, hi) => v !== "" && Number.isFinite(+v) && +v >= lo && +v <= hi;
const PHONE = /^(09|\+639)\d{9}$/;

const STEPS = [
  { title: "Personal", hint: "Enter these exactly as they appear on your ID.", fields: [
    { k: "name", label: "Full name", ac: "name", check: v => v.trim().split(/\s+/).length >= 2 || "Enter your first and last name." },
    { k: "birthdate", label: "Birthdate", type: "date", check: v => !v ? "Select your birthdate." : (age(v) < 14 || age(v) > 45) ? "Check your birthdate." : "" },
    { k: "phone", label: "Mobile number", type: "tel", ac: "tel", ph: "09123456789", check: v => PHONE.test(v.replace(/\s|-/g, "")) || "Use a Philippine mobile number, like 09123456789." },
    { k: "address", label: "Home address", wide: 1, ac: "street-address", check: v => v.trim().length >= 10 || "Enter your complete address (street, barangay, city)." }
  ] },
  { title: "Academic", hint: "Use your Senior High School details.", fields: [
    { k: "school", label: "Senior high school", check: v => v.trim().length >= 3 || "Enter your school name." },
    { k: "strand", label: "Strand / track", check: v => v.trim().length >= 2 || "Enter your strand or track." },
    { k: "lrn", label: "LRN (optional)", ph: "12 digits", check: v => !v || /^\d{12}$/.test(v) || "An LRN has exactly 12 digits." },
    { k: "course", label: "First-choice course", check: v => v.trim().length >= 3 || "Enter the course you plan to take." },
    { k: "gwa", label: "Grade 12 first-semester GWA (%)", type: "number", step: "0.01", check: v => num(v, 60, 100) || "Enter a GWA between 60 and 100." }
  ] },
  { title: "Household", hint: "Used only to check scholarship eligibility.", fields: [
    { k: "income", label: "Annual household income (₱)", type: "number", check: v => num(v, 0, 100000000) || "Enter a number, or 0 if none." },
    { k: "guardian", label: "Parent or guardian name", check: v => v.trim().split(/\s+/).length >= 2 || "Enter your guardian's full name." },
    { k: "guardianPhone", label: "Guardian mobile number", type: "tel", ph: "09123456789", check: v => PHONE.test(v.replace(/\s|-/g, "")) || "Use a Philippine mobile number, like 09123456789." }
  ] },
  { title: "Documents", hint: "PDF, JPG or PNG, up to 5 MB each. Make sure every detail is readable." },
  { title: "Review" }
];
const DOCS = [
  { key: "idFront", label: "Valid ID (front)" },
  { key: "idBack", label: "Valid ID (back)" },
  { key: "proof", label: "Latest report card or proof of enrollment" }
];

/* ---------- State ---------- */
const S = { user: null, step: 0, data: {}, files: {}, prev: {}, attempt: 1, busy: false };

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = "login.html"; return; }
  if (multiFactor(user).enrolledFactors.length === 0) { location.href = "setup2fa.html"; return; }
  S.user = user;
  try {
    let prof = await getDoc(doc(db, "users", user.uid));
    if (!prof.exists()) {
      await setDoc(doc(db, "users", user.uid), { role: "student", name: user.displayName || "", email: user.email, createdAt: serverTimestamp() });
      prof = await getDoc(doc(db, "users", user.uid));
    }
    if (prof.data().role === "admin") { location.href = "admin.html"; return; }
    const snap = await getDoc(doc(db, "enrollments", user.uid));
    const e = snap.exists() ? snap.data() : null;
    if (e?.status === "approved") { location.href = "dashboard.html"; return; }
    S.enr = e;
    if (e) { S.attempt = (e.attempt || 1) + 1; S.data = { ...e.form }; S.prev = Object.fromEntries((e.files || []).map(f => [f.key, f])); }
    else S.data = { name: user.displayName || "" };
    document.body.style.visibility = "visible";
    if (e?.status === "pending") status("pending"); else if (e?.status === "declined") status("declined"); else form();
  } catch (err) {
    console.error(err);
    document.body.style.visibility = "visible";
    stage.innerHTML = `<div class="en-card"><h1>We could not load your enrollment</h1><p class="lead">${esc(err.code || err.message)}. Check your connection and refresh the page.</p></div>`;
  }
});

/* ---------- Views ---------- */
function status(kind) {
  const e = S.enr;
  stage.innerHTML = kind === "pending"
    ? `<div class="en-card state"><span class="state-badge wait">Under review</span><h1>Your enrollment is being reviewed</h1>
       <p class="lead">An admin is checking your details and ID. You will get a notification and an email once there is a decision. You can close this page.</p>
       <dl class="sum"><dt>Submitted by</dt><dd>${esc(e.form?.name)}</dd><dt>School</dt><dd>${esc(e.form?.school)}</dd><dt>Attempt</dt><dd>${esc(e.attempt || 1)}</dd></dl></div>`
    : `<div class="en-card state"><span class="state-badge bad">Needs changes</span><h1>Your enrollment was declined</h1>
       <p class="lead">The admin left this reason:</p><blockquote>${esc(e.reason || "No reason was given.")}</blockquote>
       <p class="lead">Fix the problem and send it again. Your previous answers and files are kept.</p>
       <div class="en-acts"><button class="btn" id="redo">Edit and resubmit</button></div></div>`;
  $("redo")?.addEventListener("click", () => { S.step = 0; form(); });
}

function form() {
  const st = STEPS[S.step], last = S.step === STEPS.length - 1;
  const head = `<ol class="en-steps">${STEPS.map((x, i) => `<li class="${i < S.step ? "done" : i === S.step ? "now" : ""}"><i>${i < S.step ? "✓" : i + 1}</i><span>${x.title}</span></li>`).join("")}</ol>`;
  let body = "";
  if (st.fields) body = `<div class="fgrid">${st.fields.map(f => field(f)).join("")}</div>`;
  else if (st.title === "Documents") body = DOCS.map(d => docRow(d)).join("");
  else body = review();
  stage.innerHTML = `${head}<form class="en-card" id="enf" novalidate>
    <h1>${st.title === "Review" ? "Review and submit" : "Step " + (S.step + 1) + ": " + st.title}</h1>
    ${st.hint ? `<p class="lead">${st.hint}</p>` : ""}${body}
    <p class="fe form-err" id="formErr" role="alert"></p>
    <div class="en-acts">${S.step ? `<button type="button" class="btn alt" id="back">Back</button>` : "<span></span>"}
      <button class="btn" type="submit" id="next" ${last ? "disabled" : ""}>${last ? "Submit for review" : "Continue"}</button></div></form>`;
  $("enf").addEventListener("submit", onSubmit);
  $("back")?.addEventListener("click", () => { S.step--; form(); scrollTo(0, 0); });
  if (st.fields) $("enf").addEventListener("input", e => { if (e.target.name) { S.data[e.target.name] = e.target.value; clearErr(e.target.name); } });
  if (st.title === "Documents") $("enf").addEventListener("change", onFile);
  if (last) $("ack").addEventListener("change", e => { $("next").disabled = !e.target.checked; });
  $("enf").querySelector("input")?.focus({ preventScroll: true });
}

const field = f => `<div class="fld ${f.wide ? "wide" : ""}"><label for="f-${f.k}">${f.label}</label>
  <input id="f-${f.k}" name="${f.k}" type="${f.type || "text"}" ${f.step ? `step="${f.step}"` : ""} ${f.ph ? `placeholder="${f.ph}"` : ""} ${f.ac ? `autocomplete="${f.ac}"` : ""} value="${esc(S.data[f.k])}" aria-describedby="e-${f.k}">
  <small class="fe" id="e-${f.k}"></small></div>`;

const docRow = d => {
  const f = S.files[d.key], p = S.prev[d.key];
  return `<div class="fld"><label>${d.label}</label><div class="drop ${f || p ? "has" : ""}">
    <div><b>${f ? esc(f.name) : p ? esc(p.name) : "No file chosen"}</b><small>${f ? (f.size / 1048576).toFixed(2) + " MB, ready to upload" : p ? "Already uploaded. Choose a file only to replace it." : "PDF, JPG or PNG, max 5 MB"}</small></div>
    <label class="btn alt pick">${f || p ? "Replace" : "Choose file"}<input type="file" data-d="${d.key}" accept=".pdf,.jpg,.jpeg,.png" hidden></label></div>
    <small class="fe" id="e-${d.key}"></small></div>`;
};

function review() {
  const d = S.data, row = (l, v) => `<dt>${l}</dt><dd>${esc(v || "-")}</dd>`;
  return `<dl class="sum">${row("Name", d.name)}${row("Birthdate", d.birthdate)}${row("Mobile", d.phone)}${row("Address", d.address)}
    ${row("School", d.school)}${row("Strand", d.strand)}${row("LRN", d.lrn)}${row("Course", d.course)}${row("GWA", d.gwa ? d.gwa + "%" : "")}
    ${row("Annual income", d.income !== "" ? "₱" + (+d.income).toLocaleString() : "")}${row("Guardian", d.guardian)}${row("Guardian mobile", d.guardianPhone)}
    ${DOCS.map(x => row(x.label, S.files[x.key]?.name || S.prev[x.key]?.name)).join("")}</dl>
    <label class="chk"><input type="checkbox" id="ack"> I confirm that everything above is true and the documents are mine. I understand that false information can disqualify me.</label>`;
}

/* ---------- Behaviour ---------- */
const clearErr = k => { const e = $("e-" + k), i = $("f-" + k); if (e) e.textContent = ""; if (i) i.removeAttribute("aria-invalid"); };
const setErr = (k, m) => { const e = $("e-" + k), i = $("f-" + k); if (e) e.textContent = m; if (i) i.setAttribute("aria-invalid", "true"); };

async function onFile(e) {
  const inp = e.target.closest("input[type=file]"); if (!inp?.files[0]) return;
  const k = inp.dataset.d, file = inp.files[0], bad = await checkFile(file);
  if (bad) { inp.value = ""; $("e-" + k).textContent = bad; return; }
  S.files[k] = file; form();
}

function validateStep() {
  const st = STEPS[S.step]; let first = null;
  if (st.fields) for (const f of st.fields) {
    const r = f.check(String(S.data[f.k] ?? ""));
    if (r !== true && r) { setErr(f.k, r); first = first || f.k; }
  }
  if (st.title === "Documents") for (const d of DOCS) if (!S.files[d.key] && !S.prev[d.key]) { $("e-" + d.key).textContent = "This document is required."; first = first || d.key; }
  if (first) { ($("f-" + first) || $("e-" + first)).scrollIntoView({ block: "center" }); $("f-" + first)?.focus(); }
  return !first;
}

async function onSubmit(e) {
  e.preventDefault();
  if (S.busy) return;
  if (S.step < STEPS.length - 1) { if (validateStep()) { S.step++; form(); scrollTo(0, 0); } return; }
  S.busy = true; const btn = $("next"); btn.disabled = true; btn.textContent = "Uploading…"; $("formErr").textContent = "";
  try {
    const uid = S.user.uid, files = [];
    for (const d of DOCS) {
      const f = S.files[d.key];
      if (f) { const path = `${uid}/enroll/${d.key}-${Date.now()}.${extOf(f)}`; await uploadPrivate(path, f); files.push({ key: d.key, label: d.label, path, name: f.name }); }
      else files.push({ ...S.prev[d.key], key: d.key, label: d.label });
    }
    const payload = Object.fromEntries(Object.entries(S.data).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    payload.phone = payload.phone.replace(/\s|-/g, ""); payload.guardianPhone = payload.guardianPhone.replace(/\s|-/g, "");
    payload.gwa = +payload.gwa; payload.income = +payload.income;
    const batch = writeBatch(db);
    batch.set(doc(db, "enrollments", uid), { uid, email: S.user.email, form: payload, files, status: "pending", reason: "", attempt: S.attempt, submittedAt: serverTimestamp() });
    stageAudit(batch, { action: "enrollment.submitted", targetType: "enrollment", targetId: uid, summary: `Submitted enrollment (attempt ${S.attempt})`, role: "student" });
    await batch.commit();
    S.enr = { form: payload, files, status: "pending", attempt: S.attempt };
    status("pending"); scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    S.busy = false; btn.disabled = false; btn.textContent = "Submit for review";
    $("formErr").textContent = "Could not submit: " + (err.code || err.message) + ". Nothing was sent, you can try again.";
    return;
  }
  S.busy = false;
}

$("logout").addEventListener("click", async e => { e.preventDefault(); await signOut(auth); location.href = "index.html"; });