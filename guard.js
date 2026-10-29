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

  var first = (user.displayName || user.email || "User").split(" ")[0];
  var box = document.querySelector(".user");
  if (box) {
    box.innerHTML = '<span class="avatar"></span><span class="uname"></span>';
    box.querySelector(".avatar").textContent = first.charAt(0).toUpperCase();
    box.querySelector(".uname").textContent = "Hi, " + first;
  }
  document.body.style.visibility = "visible";
});

var logout = document.querySelector(".logout");
if (logout) {
  logout.addEventListener("click", async function (e) {
    e.preventDefault();
    await signOut(auth);
    location.href = "index.html";
  });
}