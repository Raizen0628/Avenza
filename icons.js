/* AVENZA – one consistent inline icon set (24px grid, 1.75 stroke). */
const P = {
 "home": "<path d=\"M3 10.5 12 3l9 7.5\"/><path d=\"M5 9.5V21h14V9.5\"/><path d=\"M9.5 21v-6h5v6\"/>",
 "apply": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h4\"/>",
 "browse": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>",
 "scholarship": "<circle cx=\"12\" cy=\"9\" r=\"6\"/><path d=\"m8.5 14-1.5 7 5-3 5 3-1.5-7\"/>",
 "announcements": "<path d=\"M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z\"/><path d=\"M15 9a4 4 0 0 1 0 6\"/>",
 "profile": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c.8-4 4-6 8-6s7.2 2 8 6\"/>",
 "enroll": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"9\" cy=\"11\" r=\"2\"/><path d=\"M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M15 10h3M15 14h3\"/>",
 "apps": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h4\"/>",
 "sched": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>",
 "res": "<path d=\"M4 20V10M10 20V4M16 20v-8M22 20H2\"/>",
 "docs": "<path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"m9 14 2 2 4-4\"/>",
 "schos": "<circle cx=\"12\" cy=\"9\" r=\"6\"/><path d=\"m8.5 14-1.5 7 5-3 5 3-1.5-7\"/>",
 "sapps": "<path d=\"M6 3h9l4 4v14H6z\"/><path d=\"M15 3v4h4M9 13h6M9 17h6\"/>",
 "sch": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 8h.01\"/>",
 "ann": "<path d=\"M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z\"/><path d=\"M15 9a4 4 0 0 1 0 6\"/>",
 "people": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5\"/><path d=\"M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c2 .6 3.2 2 3.5 4.7\"/>",
 "changes": "<path d=\"M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z\"/><path d=\"m13.5 6.5 4 4\"/>",
 "audit": "<path d=\"M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z\"/><path d=\"m9 12 2 2 4-4\"/>",
 "bell": "<path d=\"M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7\"/><path d=\"M10 20a2 2 0 0 0 4 0\"/>",
 "logout": "<path d=\"M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4\"/><path d=\"M16 8l4 4-4 4M20 12H9\"/>"
};

export const icon = (name, size = 18) =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;