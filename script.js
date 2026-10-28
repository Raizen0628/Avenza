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