// Fill these two values (Supabase > Project Settings > API). Both are PUBLIC by design:
// the publishable (anon) key can only call the portal functions, and those answer only for a signed-in, ADMIN-APPROVED person.
window.BABI_PORTAL = {
  SUPABASE_URL: "https://pcfgqrpjzfyyzviiuosf.supabase.co",        // for example https://abcdxyz.supabase.co
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZmdxcnBqemZ5eXp2aWl1b3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTQ1NzgsImV4cCI6MjEwODAzMDU3OH0.N5J9tQrcjdCvRagUS275vjirbhTsCagYWTwGLxn_tLQ"         // the publishable / anon key (never the secret key!)
};
