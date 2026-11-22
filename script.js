/* ==========================================================
   AVENZA – Shared UI script (toast, page links, welcome video)
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
 
/* ---------- Welcome slideshow (index.html only) ---------- */
/* Slides move by themselves, forever, without anyone touching the page. */
var slider = document.getElementById("slider");
 
if (slider) {
  var slides = slider.querySelectorAll(".slide");
  var total = slides.length;
  var current = 0;
  var slideTimer = null;
  var DELAY = 3500; /* time each picture stays (milliseconds) */
 
  /* Build one dot per slide */
  var dotBox = slider.querySelector(".dots");
  dotBox.innerHTML = "";
 
  slides.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", "Show picture " + (i + 1));
    dotBox.appendChild(dot);
  });
 
  var dots = dotBox.querySelectorAll("button");
 
  /* Place every slide left/right of the one in view */
  function layout(first) {
    slides.forEach(function (slide, i) {
      var off = (i - current + total) % total;
      if (off > total / 2) off -= total; /* -3 ... 0 ... +3 */
 
      var jump = first || Math.abs(off - (slide._off === undefined ? off : slide._off)) > 1;
 
      /* slides wrapping around the loop reposition without animating */
      slide.style.transition = jump ? "none" : "";
      slide.style.transform = "translateX(" + off * 100 + "%)";
      slide.classList.toggle("active", off === 0);
      slide._off = off;
    });
 
    dots.forEach(function (dot, i) {
      dot.classList.toggle("on", i === current);
      dot.setAttribute("aria-current", i === current ? "true" : "false");
    });
  }
 
  function show(index) {
    current = (index + total) % total;
    layout(false);
  }
 
  function next() {
    show(current + 1);
  }
 
  /* Automatic sliding */
  function start() {
    clearInterval(slideTimer);
    slideTimer = setInterval(next, DELAY);
  }
 
  /* Arrows and dots still work, then the automatic sliding carries on */
  slider.querySelector(".prev").addEventListener("click", function () {
    show(current - 1);
    start();
  });
 
  slider.querySelector(".next").addEventListener("click", function () {
    next();
    start();
  });
 
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      show(i);
      start();
    });
  });
 
  /* Swipe on phones */
  var touchX = null;
 
  slider.addEventListener("touchstart", function (event) {
    touchX = event.touches[0].clientX;
  }, { passive: true });
 
  slider.addEventListener("touchend", function (event) {
    if (touchX === null) return;
    var diff = event.changedTouches[0].clientX - touchX;
    touchX = null;
 
    if (Math.abs(diff) > 40) {
      show(diff < 0 ? current + 1 : current - 1);
      start();
    }
  });
 
  layout(true);
  start();
}

/* ---------- Show / hide password ---------- */
(function () {
  var EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10.5 7 10.5 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 1.5 12S5.5 19 12 19c1.9 0 3.6-.5 5-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    var wrap = document.createElement("span");
    wrap.className = "pw";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "eye";
    btn.setAttribute("aria-label", "Show password");
    btn.innerHTML = EYE;
    wrap.appendChild(btn);

    btn.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
})();