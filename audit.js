/* AVENZA – audit trail helpers. Entries are append-only (see firestore.rules). */
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function build(o) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return {
    actor: u.uid,
    actorEmail: u.email || "",
    actorRole: o.role || "student",
    action: o.action,
    targetType: o.targetType || "",
    targetId: o.targetId || "",
    summary: String(o.summary || "").slice(0, 400),
    reason: String(o.reason || "").slice(0, 400),
    before: o.before ?? null,
    after: o.after ?? null,
    ts: serverTimestamp()
  };
}

/* Add an audit entry to a write batch, so the action and its log commit together. */
export const stageAudit = (batch, o) => batch.set(doc(collection(db, "auditLogs")), build(o));

/* Stand-alone entry. Callers should not let a logging failure block the user. */
export const logAudit = o => addDoc(collection(db, "auditLogs"), build(o));