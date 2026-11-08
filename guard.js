/* AVENZA – page guard: signed in + 2-step verification + correct role for the page. */
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, multiFactor, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const needAdmin = document.body.dataset.need === "admin";

onAuthStateChanged(auth, async function (user) {
  if (!user) { location.href = "login.html"; return; }
  if (multiFactor(user).enrolledFactors.length === 0) { location.href = "setup2fa.html"; return; }

  let role = "student";
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists() && snap.data().role) role = snap.data().role;
  } catch (e) { console.error("Role check failed:", e); }

  if (needAdmin && role !== "admin") { location.href = "dashboard.html"; return; }
  if (!needAdmin && role === "admin") { location.href = "admin.html"; return; }

  /* Students must have an approved enrollment before they can use the portal. */
  if (!needAdmin) {
    let ok = false;
    try { const e = await getDoc(doc(db, "enrollments", user.uid)); ok = e.exists() && e.data().status === "approved"; }
    catch (err) { console.error("Enrollment check failed:", err); }
    if (!ok) { location.href = "enroll.html"; return; }
  }

  var first = (user.displayName || user.email || "User").split(" ")[0];
  var box = document.querySelector(".user");
  if (box) {
    box.innerHTML = '<span class="avatar"></span><span class="uname"></span>';
    box.querySelector(".avatar").textContent = first.charAt(0).toUpperCase();
    box.querySelector(".uname").textContent = "Hi, " + first;
  }
  document.body.style.visibility = "visible";
});

/* If the guard cannot finish (network, rules), never leave a blank page. */
setTimeout(function () {
  if (document.body.style.visibility !== "visible") {
    document.body.style.visibility = "visible";
    document.body.innerHTML = '<p style="font:600 15px system-ui;padding:40px;text-align:center">We could not load this page. Check your connection and <a href="login.html">log in again</a>.</p>';
  }
}, 12000);

var logout = document.querySelector(".logout");
if (logout) {
  logout.addEventListener("click", async function (e) {
    e.preventDefault();
    await signOut(auth);
    location.href = "index.html";
  });
}