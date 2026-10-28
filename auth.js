
/* ==========================================================
   AVENZA – Firebase Authentication
   Email/password + Google + authenticator-app MFA
   ========================================================== */

import { auth } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

var form = document.querySelector("form");
var errBox = form ? form.querySelector(".err") : null;
var mode = form ? form.dataset.form : "";
var resolver = null;

function say(message) {
  if (window.note) window.note(message);
  else console.log(message);
}

function showErr(message) {
  if (errBox) errBox.textContent = message || "";
  else if (message) console.error(message);
}

function friendly(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";

    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in.";

    case "auth/invalid-email":
      return "Enter a valid email address.";

    case "auth/weak-password":
      return "Use at least 8 characters for your password.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";

    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase.";

    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup.";

    case "auth/network-request-failed":
      return "Network problem. Check your internet connection.";

    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase.";

    case "auth/account-exists-with-different-credential":
      return "This email is registered using another sign-in method.";

    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/* ---------- After successful sign-in ---------- */

async function afterLogin(user) {
  var usesPassword = user.providerData.some(function (provider) {
    return provider.providerId === "password";
  });

  if (usesPassword && !user.emailVerified) {
    await sendEmailVerification(user);
    await signOut(auth);

    showErr("Please verify your email first. A verification link has been sent.");
    return;
  }

  say("Welcome to Avenza!");

  setTimeout(function () {
    window.location.href = "dashboard.html";
  }, 700);
}

/* ---------- Multi-factor authentication ---------- */

function needMfa(error) {
  var box = document.getElementById("mfaBox");

  if (!box) {
    showErr("Two-step verification is required. Please log in and enter your code.");
    return;
  }

  resolver = getMultiFactorResolver(auth, error);
  box.style.display = "grid";

  var codeInput = document.getElementById("code");
  if (codeInput) codeInput.focus();

  showErr("Enter the 6-digit code from your authenticator app.");
}

async function submitMfa() {
  if (!resolver) {
    showErr("Please log in again.");
    return;
  }

  var codeInput = document.getElementById("code");
  var code = codeInput ? codeInput.value.trim() : "";

  if (!/^\d{6}$/.test(code)) {
    showErr("Enter the 6-digit code.");
    return;
  }

  var hint = resolver.hints.find(function (item) {
    return item.factorId === TotpMultiFactorGenerator.FACTOR_ID;
  });

  if (!hint) {
    showErr("No compatible authenticator factor was found.");
    return;
  }

  var assertion =
    TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);

  var credential = await resolver.resolveSignIn(assertion);
  resolver = null;

  await afterLogin(credential.user);
}

/* ---------- Email/password login ---------- */

async function doLogin() {
  if (resolver) {
    await submitMfa();
    return;
  }

  var emailInput = document.getElementById("u");
  var passwordInput = document.getElementById("lp");

  var email = emailInput ? emailInput.value.trim() : "";
  var password = passwordInput ? passwordInput.value : "";

  if (!email || !password) {
    showErr("Fill in every field to continue.");
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showErr("Enter a valid email address.");
    return;
  }

  var credential =
    await signInWithEmailAndPassword(auth, email, password);

  await afterLogin(credential.user);
}

/* ---------- Email/password signup ---------- */

async function doSignup() {
  var nameInput = document.getElementById("n");
  var emailInput = document.getElementById("e");
  var passwordInput = document.getElementById("p");
  var confirmInput = document.getElementById("c");

  var name = nameInput ? nameInput.value.trim() : "";
  var email = emailInput ? emailInput.value.trim() : "";
  var password = passwordInput ? passwordInput.value : "";
  var confirmPassword = confirmInput ? confirmInput.value : "";

  if (!name || !email || !password || !confirmPassword) {
    showErr("Fill in every field to continue.");
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showErr("Enter a valid email address.");
    return;
  }

  if (password.length < 8) {
    showErr("Use at least 8 characters for your password.");
    return;
  }

  if (password !== confirmPassword) {
    showErr("Passwords don't match.");
    return;
  }

  var credential =
    await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(credential.user, {
    displayName: name
  });

  await sendEmailVerification(credential.user);
  await signOut(auth);

  say("Account created! Check your email to verify your account.");

  setTimeout(function () {
    window.location.href = "login.html";
  }, 2400);
}

/* ---------- Form submission ---------- */

if (form) {
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showErr("");

    try {
      if (mode === "signup") {
        await doSignup();
      } else {
        await doLogin();
      }
    } catch (error) {
      console.error(
        "Firebase authentication error:",
        error.code,
        error.message
      );

      if (error.code === "auth/multi-factor-auth-required") {
        needMfa(error);
      } else {
        showErr(friendly(error));
      }
    }
  });
}

/* ---------- Google Sign-In and password reset ---------- */

document.addEventListener("click", async function (event) {
  var target = event.target.closest("[data-go]");
  if (!target) return;

  if (target.dataset.go === "google") {
    event.preventDefault();
    showErr("");

    try {
      var credential = await signInWithPopup(
        auth,
        new GoogleAuthProvider()
      );

      await afterLogin(credential.user);
    } catch (error) {
      console.error(
        "Google sign-in error:",
        error.code,
        error.message
      );

      if (error.code === "auth/multi-factor-auth-required") {
        needMfa(error);
      } else if (
        error.code !== "auth/popup-closed-by-user" &&
        error.code !== "auth/cancelled-popup-request"
      ) {
        showErr(friendly(error));
      }
    }
  }

  if (target.dataset.go === "forgot") {
    event.preventDefault();

    var emailInput = document.getElementById("u");
    var email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      showErr("Enter your email first, then click Forgot password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      showErr("");
      say("Password reset email sent. Check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error.code, error.message);
      showErr(friendly(error));
    }
  }
});
