/* ==========================================================
   AVENZA – Shared UI script (toast, page links, splash screen)
   Login, signup, Google and 2FA are handled in auth.js
   ========================================================== */

var toast = document.getElementById("toast");

/* ---------- Page links ---------- */
var pages = {
  home: "index.html",
  signup: "signup.html",
  login: "login.html",
  dashboard: "dashboard.html"
};

/* ---------- Toast message ---------- */
function note(message) {
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(function () {
    toast.classList.remove("show");
  }, 2600);
}

/* ---------- Navigation ---------- */
document.addEventListener("click", function (event) {
  var target = event.target.closest("[data-go]");
  if (!target) return;

  var go = target.dataset.go;

  /* "google" and "forgot" are handled in auth.js */
  if (go === "google" || go === "forgot") return;

  if (pages[go]) {
    event.preventDefault();
    window.location.href = pages[go];
  }
});

/* ---------- Enter key activates links ---------- */
document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && event.target.matches("a[data-go]")) {
    event.target.click();
  }
});

/* ---------- Splash screen (index.html) ---------- */
var fill = document.getElementById("fill");
var splash = document.getElementById("splash");

if (fill && splash) {
  var progress = 0;

  var timer = setInterval(function () {
    progress += Math.random() * 14 + 6;

    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);

      setTimeout(function () {
        splash.classList.add("ready");
      }, 250);
    }

    fill.style.width = progress + "%";
  }, 140);
}