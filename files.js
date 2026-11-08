/* AVENZA – private document storage (Supabase bucket "docs", kept PRIVATE).
   Files are stored by path. Viewing goes through the file-url edge function,
   which only returns a short-lived link to the owner or an admin. */
import { auth } from "./firebase-config.js";
import { supabase } from "./supabase-config.js";

const FN = "https://oqpgvxaswfpcjonglrdy.supabase.co/functions/v1/file-url";
const EXT = ["pdf", "jpg", "jpeg", "png"];
const MAX = 5 * 1024 * 1024;

const SIG = { pdf: [[0x25, 0x50, 0x44, 0x46]], png: [[0x89, 0x50, 0x4e, 0x47]], jpg: [[0xff, 0xd8, 0xff]], jpeg: [[0xff, 0xd8, 0xff]] };

export const extOf = f => (f.name.split(".").pop() || "").toLowerCase();

/* Returns an error message, or "" when the file is acceptable. Checks type, size and real content. */
export async function checkFile(file) {
  const ext = extOf(file);
  if (!EXT.includes(ext)) return "Only PDF, JPG or PNG files are allowed.";
  if (file.size > MAX) return "File is larger than 5 MB.";
  if (file.size < 1024) return "That file looks empty or corrupted.";
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!SIG[ext].some(sig => sig.every((b, i) => head[i] === b))) return "The file content does not match its type.";
  return "";
}

export async function uploadPrivate(path, file) {
  const { error } = await supabase.storage.from("docs").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedUrl(path) {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ path })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error || "Could not open the file");
  return j.url;
}