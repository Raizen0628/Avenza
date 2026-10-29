import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

/* Web config values are not secret; security comes from firestore.rules / storage.rules. */
const firebaseConfig = {
  apiKey: "AIzaSyCSJP_TDbf_Al42Zl7hH6saqJ3rR3Sg0qw",
  authDomain: "avenza-web.firebaseapp.com",
  projectId: "avenza-web",
  appId: "1:1081785290042:web:a788431e4c62ed052a1403"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);