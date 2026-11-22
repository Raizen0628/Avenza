/* AVENZA – shared page chrome: icons for the bell and log-out controls. */
import { icon } from "./icons.js";
const bell = document.getElementById("bellIcon");
if (bell) bell.innerHTML = icon("bell", 20);
const out = document.getElementById("logout");
if (out) out.innerHTML = icon("logout") + "<span>Log out</span>";