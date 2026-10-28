/* ==========================================================
   AVENZA – Dashboard guard
   Only signed-in users with 2-step verification can see the page.
   ========================================================== */

import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  multiFactor,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

onAuthStateChanged(auth, function (user) {
  /* Not logged in → login page */
  if (!user) {
    location.href = "login.html";
    return;
  }

  /* Logged in but no 2FA yet → setup page */
  if (multiFactor(user).enrolledFactors.length === 0) {
    location.href = "setup2fa.html";
    return;
  }

  /* Show the user's name */
  var first = (user.displayName || user.email || "Student").split(" ")[0];
  var box = document.querySelector(".user");

  if (box) {
    box.innerHTML = '<span class="avatar"></span><span class="uname"></span>';
    box.querySelector(".avatar").textContent = first.charAt(0).toUpperCase();
    box.querySelector(".uname").textContent = "Hi, " + first;
  }

  /* Everything checked → reveal the page */
  document.body.style.visibility = "visible";
});

/* Log out */
var logout = document.querySelector(".logout");

if (logout) {
  logout.addEventListener("click", async function (e) {
    e.preventDefault();
    await signOut(auth);
    location.href = "index.html";
  });
}