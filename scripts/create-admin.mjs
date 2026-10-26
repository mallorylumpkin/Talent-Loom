#!/usr/bin/env node
/**
 * Creates the FIRST super admin without needing email delivery.
 *
 *   npm run create-admin
 *
 * Asks for an email and password, creates the account (already confirmed),
 * then promotes it with bootstrap_super_admin(). Refuses if an admin exists.
 * Sign in afterwards and set up two-factor authentication when prompted.
 */
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("Couldn't read .env.local. Run this from the project folder.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/(https?:\/\/[^/]+).*/, "$1");
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write("*".repeat(s.length));
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("account_type", "super_admin");
if (count) {
  console.error("A super admin already exists. Add more admins from the admin dashboard.");
  process.exit(1);
}

console.log("\nCreate your TalentLoom admin account.");
console.log("Tip: use a different email from your creator account, e.g. yourname+admin@yourmail.com\n");
const email = (await ask("Admin email: ")).toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("That doesn't look like an email address.");
  process.exit(1);
}

const existing = await findUser(email);
if (existing) {
  const ok = await ask(`${email} already has an account. Turn it into the admin account? (y/N) `);
  if (ok.toLowerCase() !== "y") process.exit(0);
} else {
  const password = await ask("Choose a password (12+ characters): ", { hidden: true });
  if (password.length < 12) {
    console.error("Please use at least 12 characters.");
    process.exit(1);
  }
  const confirm = await ask("Type it again: ", { hidden: true });
  if (confirm !== password) {
    console.error("Passwords didn't match.");
    process.exit(1);
  }
  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "TalentLoom Admin", age_18_plus: "true", terms_version: "admin-bootstrap" },
  });
  if (error) {
    console.error(`Couldn't create the account: ${error.message}`);
    process.exit(1);
  }
}

const { data, error } = await db.rpc("bootstrap_super_admin", { p_email: email });
if (error) {
  console.error(`Couldn't promote the account: ${error.message}`);
  process.exit(1);
}
console.log(`\n✓ ${data}`);
console.log("Next: sign in at /login with this email. You'll be asked to set up an authenticator app.\n");
