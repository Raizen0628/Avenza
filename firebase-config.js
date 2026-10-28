/* ==========================================================
   AVENZA – Firebase setup
   Paste the values from Firebase Console → Project settings →
   Your apps → Web app → "firebaseConfig".
   (These values are not secret. Security comes from Firebase rules.)
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyCSJP_TDbf_Al42Zl7hH6saqJ3rR3Sg0qw",
  authDomain: "avenza-web.firebaseapp.com",
  projectId: "avenza-web",
  appId: "1:1081785290042:web:a788431e4c62ed052a1403"
};
 
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);