export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const tag = s => `<span class="tag ${String(s).replace(/\s+/g, "-")}">${esc(s)}</span>`;
export const when = t => t?.seconds ? new Date(t.seconds * 1000).toLocaleDateString() : "";

export function toast(m) {
  const t = document.getElementById("toast");
  t.textContent = m; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

/* Generic dialog: fields=[] gives a plain confirm. Resolves to values object or null. */
export function ask(title, fields = [], ok = "Confirm", html = "") {
  return new Promise(res => {
    const d = document.createElement("dialog");
    d.innerHTML = `<form method="dialog" class="dlg"><h3>${esc(title)}</h3>${html}${fields.map(f => `<label>${esc(f.label)}${f.area
      ? `<textarea name="${f.k}" rows="3" ${f.req ? "required" : ""}>${esc(f.v)}</textarea>`
      : `<input name="${f.k}" type="${f.type || "text"}" value="${esc(f.v)}" ${f.req ? "required" : ""}>`}</label>`).join("")}
      <div class="acts"><button value="x" formnovalidate class="alt">${ok ? "Cancel" : "Close"}</button>${ok ? `<button value="ok">${esc(ok)}</button>` : ""}</div></form>`;
    document.body.append(d);
    d.addEventListener("close", () => {
      const o = d.returnValue === "ok" ? Object.fromEntries(new FormData(d.querySelector("form"))) : null;
      d.remove(); res(o);
    });
    d.showModal();
  });
}

export const history = (by, text) => ({ t: Date.now(), by, text });

/* ---------- Scholarship helpers (used by student + admin) ---------- */
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";

/* Returns a list of unmet requirements (empty list = meets all). f = { gwa, income, course } */
export const meets = (s, f) => {
  const miss = [], course = String(f.course || "").trim().toLowerCase();
  if (s.minGwa && +f.gwa < +s.minGwa) miss.push(`GWA below ${s.minGwa}%`);
  if (s.maxIncome && +f.income > +s.maxIncome) miss.push(`income above ₱${(+s.maxIncome).toLocaleString()}`);
  const cs = s.courses || [];
  if (cs.length && !cs.some(c => { c = c.toLowerCase(); return course && (course.includes(c) || c.includes(course)); })) miss.push("course not in the allowed list");
  return miss;
};

export const reqText = s => [
  s.minGwa ? `GWA ${s.minGwa}% or higher` : "",
  s.maxIncome ? `Household income ₱${(+s.maxIncome).toLocaleString()} or less` : "",
  (s.courses || []).length ? `Courses: ${s.courses.join(", ")}` : ""
].filter(Boolean).join(" · ") || "No specific requirements";

export const isOpen = s => s.status === "open" && (!s.deadline || new Date(s.deadline + "T23:59:59") >= new Date());