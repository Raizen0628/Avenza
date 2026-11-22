export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const tag = s => `<span class="tag ${String(s).replace(/[^A-Za-z0-9_-]+/g, "-")}">${esc(s)}</span>`;
export const when = t => t?.seconds ? new Date(t.seconds * 1000).toLocaleDateString() : "";

let toastTimer;
export function toast(m) {
  const t = document.getElementById("toast");
  t.textContent = m; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

/* Generic dialog: fields=[] gives a plain confirm. Resolves to values object or null. */
export function ask(title, fields = [], ok = "Confirm", html = "") {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.innerHTML = `<form method="dialog" class="dlg"><h3>${esc(title)}</h3>${html}${fields.map(f => `<label>${esc(f.label)}${f.area
      ? `<textarea name="${esc(f.k)}" rows="3" ${f.req ? "required" : ""}>${esc(f.v)}</textarea>`
      : `<input name="${esc(f.k)}" type="${f.type || "text"}" value="${esc(f.v)}" ${f.req ? "required" : ""}>`}</label>`).join("")}
      <div class="acts"><button value="x" formnovalidate class="alt">${ok ? "Cancel" : "Close"}</button>${ok ? `<button value="ok">${esc(ok)}</button>` : ""}</div></form>`;
    document.body.append(d);
    d.addEventListener("close", () => {
      const o = d.returnValue === "ok" ? Object.fromEntries(new FormData(d.querySelector("form"))) : null;
      d.remove(); res(o);
    });
    d.showModal();
  });
}

/* One history line shown on an application (was "history", which shadowed window.history) */
export const entry = (by, text) => ({ t: Date.now(), by, text });

/* ---------- Scholarship helpers (used by student + admin) ---------- */
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";

/* ---------- Scholarship coverage by GWA (25 / 50 / 75 / 100 %) ---------- */
export const TIER_NAME = { 25: "Financial assistance", 50: "Half scholarship", 75: "Three-quarter scholarship", 100: "Full scholarship" };
const num = v => (v === "" || v == null || !Number.isFinite(+v)) ? null : +v;

/* GWA needed for each level. Older scholarships that only had a minimum GWA are scaled from it. */
export const tiersOf = s => {
  if (s.tiers) return { t25: +s.tiers.t25, t50: +s.tiers.t50, t75: +s.tiers.t75, t100: +s.tiers.t100 };
  const b = +s.minGwa || 80;
  return { t25: b, t50: Math.min(100, b + 5), t75: Math.min(100, b + 10), t100: Math.min(100, b + 15) };
};
export const coverage = (s, gwa) => {
  const t = tiersOf(s), g = num(gwa);
  return g === null ? 0 : g >= t.t100 ? 100 : g >= t.t75 ? 75 : g >= t.t50 ? 50 : g >= t.t25 ? 25 : 0;
};
export const coverText = p => p ? `${p}% · ${TIER_NAME[p]}` : "Not eligible";
export const tierText = s => { const t = tiersOf(s); return [25, 50, 75, 100].map(p => `${p}% at GWA ${t["t" + p]}+`).join(" · "); };

/* Returns a list of unmet requirements (empty list = meets all). f = { gwa, income }.
   Blank or non-numeric answers count as NOT meeting a requirement. */
export const meets = (s, f) => {
  const miss = [], income = num(f.income);
  if (coverage(s, f.gwa) === 0) miss.push(`GWA below ${tiersOf(s).t25}%`);
  if (s.maxIncome && (income === null || income > +s.maxIncome)) miss.push(`income above ₱${(+s.maxIncome).toLocaleString()}`);
  return miss;
};

export const reqText = s => [
  tierText(s),
  s.maxIncome ? `Household income ₱${(+s.maxIncome).toLocaleString()} or less` : ""
].filter(Boolean).join(" · ");

export const isOpen = s => s.status === "open" && (!s.deadline || new Date(s.deadline + "T23:59:59") >= new Date());