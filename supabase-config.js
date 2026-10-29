/* Supabase is used ONLY for uploaded files. Login and data stay on Firebase.
   The publishable key is meant for browser code; limits are set on the bucket itself. */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";

export const supabase = createClient(
  "https://oqpgvxaswfpcjonglrdy.supabase.co",
  "sb_publishable_9s36_QO5-bosqk6iq251GQ_NgCMZBhy"
);