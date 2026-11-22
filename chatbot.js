/* AVENZA – help chatbot. Answers from a built-in FAQ (no outside service). */
import { icon } from "./icons.js";

const FAQ = [
  { q: "How do I apply?", k: ["apply", "application", "start", "begin", "steps", "process", "how to"],
    a: () => "1. Finish enrollment and wait for admin approval.\n2. Open Apply for Exam, choose your scholarship and submit.\n3. Wait for the admin to approve you and publish your exam schedule.\n4. Take the exam.\n5. If you pass, upload your documents and apply in Browse Scholarships." },
  { q: "What documents do I need?", k: ["document", "documents", "requirement", "requirements", "upload", "papers", "submit"],
    a: c => "After you pass the exam you upload: " + (c.docs.length ? c.docs.join(", ") : "the documents listed by the admin") + ".\nFiles can be PDF, JPG or PNG, up to 5 MB each." },
  { q: "How much will I get (25, 50, 75, 100%)?", k: ["percent", "percentage", "coverage", "gwa", "full", "half", "how much", "grade", "tuition", "amount"],
    a: () => "The percentage depends on your verified GWA. Each scholarship sets its own levels for 25% (financial assistance), 50% (half), 75% and 100% (full). Open Browse Scholarships to see what you would get for each one." },
  { q: "Can I apply for more than one scholarship?", k: ["one", "more", "multiple", "many", "several", "two", "another"],
    a: () => "No. Only one scholarship is allowed per student. You choose it when you apply for the exam." },
  { q: "How do I change my name, school, course or GWA?", k: ["change", "edit", "update", "profile", "correct", "wrong", "mistake", "name", "course", "school"],
    a: () => "Open Profile and press Request change next to the detail. Enter the new value and attach proof. The old value stays until an admin approves your request." },
  { q: "When are the exam schedule and result?", k: ["schedule", "exam", "date", "time", "when", "result", "pass", "passed", "fail"],
    a: () => "After the admin approves your exam application, the schedule shows in Apply for Exam. The result appears there and in your notifications once the admin publishes it." },
  { q: "Why can't I open the dashboard?", k: ["enroll", "enrollment", "approved", "pending", "locked", "access", "declined", "blocked"],
    a: () => "New students must complete the enrollment form and ID upload first. The dashboard opens after an admin approves it. If it was declined, the reason is shown and you can fix it and send it again." },
  { q: "I forgot my password.", k: ["forgot", "password", "reset"],
    a: () => "On the login page, type your email and click Forgot password. A reset link is sent to your email." },
  { q: "How does the authenticator code work?", k: ["authenticator", "2fa", "code", "otp", "two-step", "verification", "6-digit"],
    a: () => "Each time you log in you enter a 6-digit code from your authenticator app (such as Google Authenticator). If you lose your phone, contact an admin." },
  { q: "Who can see my documents?", k: ["privacy", "private", "safe", "secure", "who", "see", "data", "protected"],
    a: () => "Only you and the admins who review them. Files are stored privately and opened with short-lived links. Passwords are handled and hashed by Firebase Authentication, so Avenza never sees them." }
];

const NONE = "I am not sure about that one. Try one of the questions below, or check the Announcements page. For anything else, ask the scholarship office.";

function answer(text, ctx) {
  const t = " " + text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ") + " ";
  let best = null, top = 0;
  for (const f of FAQ) {
    const s = f.k.reduce((n, w) => n + (t.includes(" " + w + " ") || t.includes(" " + w) ? 1 : 0), 0);
    if (s > top) { top = s; best = f; }
  }
  return best ? best.a(ctx) : NONE;
}

let mounted = false;
export function mountChat(getCtx) {
  if (mounted) return; mounted = true;
  const box = document.createElement("div");
  box.className = "chat";
  box.innerHTML = `<button class="chat-fab" aria-label="Open help chat" aria-expanded="false">${icon("sch", 22)}<span>Help</span></button>
    <section class="chat-panel" role="dialog" aria-label="Help chat" hidden>
      <header><b>Avenza help</b><button class="chat-x" aria-label="Close help chat">×</button></header>
      <div class="chat-log" aria-live="polite"></div>
      <div class="chat-chips"></div>
      <form class="chat-form"><input type="text" placeholder="Ask a question" aria-label="Your question" maxlength="200"><button type="submit" class="btn">Send</button></form>
    </section>`;
  document.body.append(box);
  const fab = box.querySelector(".chat-fab"), panel = box.querySelector(".chat-panel"), log = box.querySelector(".chat-log"),
        chips = box.querySelector(".chat-chips"), form = box.querySelector("form"), input = form.querySelector("input");

  const say = (who, text) => { const m = document.createElement("div"); m.className = "msg " + who; m.textContent = text; log.append(m); log.scrollTop = log.scrollHeight; };
  const ask = q => { say("me", q); say("bot", answer(q, getCtx())); };
  const toggle = open => {
    panel.hidden = !open; fab.setAttribute("aria-expanded", String(open));
    if (open) { if (!log.children.length) say("bot", "Hi! I can answer common questions about enrollment, the exam and scholarships."); input.focus(); } else fab.focus();
  };

  FAQ.slice(0, 5).forEach(f => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = f.q; b.onclick = () => ask(f.q); chips.append(b); });
  fab.onclick = () => toggle(panel.hidden);
  box.querySelector(".chat-x").onclick = () => toggle(false);
  box.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) toggle(false); });
  form.addEventListener("submit", e => { e.preventDefault(); const q = input.value.trim(); if (q) { ask(q); input.value = ""; } });
}