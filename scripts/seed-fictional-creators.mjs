#!/usr/bin/env node
/**
 * Adds 6 clearly FICTIONAL sample creators so the directory and profiles have content while you test.
 * Every name ends in "(fictional)", every bio says it's sample data, and every email is @example.com.
 *
 *   npm run seed:fictional            # add (safe to run twice — existing samples are skipped)
 *   npm run seed:fictional -- --remove   # delete them all again (do this before launch)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

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
const EMAIL = (i) => `fictional.creator${i}@example.com`;

const CREATORS = [
  { name: "Mia Rivera", handle: "mia.rivera.sample", headline: "Realistic wellness routines for busy people", city: "Austin", region: "TX",
    niches: ["wellness", "fitness"], cats: ["short_form_video", "tutorials"], seeking: true, rep: "unrepresented",
    accounts: [["instagram", "mia.rivera.sample", 84200, 5.8, 12], ["tiktok", "miarivera.sample", 132000, 7.1, 18]] },
  { name: "Jordan Ellis", handle: "jordan.ellis.sample", headline: "Budget travel and solo trips across the Americas", city: "Denver", region: "CO",
    niches: ["travel", "outdoors"], cats: ["vlogs", "photography"], seeking: true, rep: "open_to_switch",
    accounts: [["youtube", "jordanellissample", 48300, 4.2, 6], ["instagram", "jordan.ellis.sample", 61000, 3.9, 4]] },
  { name: "Priya Shah", handle: "priya.shah.sample", headline: "Skincare science, explained in 60 seconds", city: "Chicago", region: "IL",
    niches: ["beauty"], cats: ["short_form_video", "reviews"], seeking: true, rep: "unrepresented",
    accounts: [["tiktok", "priyashah.sample", 256000, 8.4, 22], ["instagram", "priya.shah.sample", 40100, 4.6, 9]] },
  { name: "Marcus Bell", handle: "marcus.bell.sample", headline: "Weeknight dinners under 30 minutes", city: "Atlanta", region: "GA",
    niches: ["food", "parenting"], cats: ["short_form_video", "tutorials"], seeking: false, rep: "represented",
    accounts: [["instagram", "marcus.bell.sample", 118000, 3.4, 2], ["pinterest", "marcusbellsample", 22000, 1.8, 1]] },
  { name: "Sofia Moreno", handle: "sofia.moreno.sample", headline: "Thrifted fashion and capsule wardrobes", city: "Los Angeles", region: "CA",
    niches: ["fashion", "sustainability"], cats: ["photography", "short_form_video"], seeking: true, rep: "unrepresented",
    accounts: [["instagram", "sofia.moreno.sample", 33500, 6.7, 15]] },
  { name: "Theo Park", handle: "theo.park.sample", headline: "Indie games and cozy streams", city: "Seattle", region: "WA",
    niches: ["gaming", "tech"], cats: ["livestreaming", "long_form_video"], seeking: true, rep: "open_to_switch",
    accounts: [["twitch", "theoparksample", 27800, 5.1, 9], ["youtube", "theoparksample", 15400, 4.0, 5]] },
];

async function findSampleUsers() {
  const found = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    found.push(...data.users.filter((u) => /^fictional\.creator\d+@example\.com$/.test(u.email ?? "")));
    if (data.users.length < 200) break;
  }
  return found;
}

async function remove() {
  const users = await findSampleUsers();
  for (const u of users) {
    for (const bucket of ["avatars", "covers"]) {
      const { data } = await db.storage.from(bucket).list(u.id);
      if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${u.id}/${f.name}`));
    }
    const { error } = await db.auth.admin.deleteUser(u.id);
    console.log(error ? `✗ ${u.email}: ${error.message}` : `✓ removed ${u.email}`);
  }
  console.log(users.length ? "Done." : "No fictional creators found.");
}

async function lookup(table) {
  const { data, error } = await db.from(table).select("id, key");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.key, r.id]));
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function add() {
  const existing = new Set((await findSampleUsers()).map((u) => u.email));
  const [niches, cats, platforms] = await Promise.all([lookup("niches"), lookup("content_categories"), lookup("platforms")]);
  const { data: setting } = await db.from("platform_settings").select("value").eq("key", "legal.terms_version").single();
  const version = typeof setting?.value === "string" ? setting.value : "seed";

  for (const [i, c] of CREATORS.entries()) {
    const email = EMAIL(i + 1);
    if (existing.has(email)) {
      console.log(`• ${email} already exists, skipping`);
      continue;
    }
    const display = `${c.name} (fictional)`;
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: { display_name: display, age_18_plus: "true", terms_version: version },
    });
    if (error) {
      console.log(`✗ ${email}: ${error.message}`);
      continue;
    }
    const uid = created.user.id;
    const { data: cp } = await db.from("creator_profiles").select("id").eq("user_id", uid).single();

    await db.from("consents").insert([
      { user_id: uid, consent_type: "creator_data_consent", document_version: version },
      { user_id: uid, consent_type: "discoverability", document_version: version },
    ]);
    await db.from("creator_profiles").update({
      handle: c.handle, display_name: display, headline: c.headline,
      bio: "FICTIONAL SAMPLE PROFILE for testing TalentLoom. This person and these numbers are not real.",
      city: c.city, region: c.region, country: "US",
      seeking_management: c.seeking, representation_status: c.rep, is_discoverable: true, completeness_pct: 70,
    }).eq("id", cp.id);
    await db.from("profiles").update({ display_name: display, onboarding_completed_at: new Date().toISOString() }).eq("id", uid);
    await db.from("creator_niches").insert(c.niches.filter((k) => niches[k]).map((k) => ({ creator_id: cp.id, niche_id: niches[k] })));
    await db.from("creator_categories").insert(c.cats.filter((k) => cats[k]).map((k) => ({ creator_id: cp.id, category_id: cats[k] })));

    for (const [j, [platform, handle, followers, er, growth]] of c.accounts.entries()) {
      const { data: acct } = await db.from("social_accounts")
        .insert({ creator_id: cp.id, platform_id: platforms[platform], handle, is_primary: j === 0 })
        .select("id").single();
      // Two snapshots (30 days apart) so history exists. All self-reported — sample data is never "verified".
      const before = Math.round(followers / (1 + growth / 100));
      const { data: snaps } = await db.from("analytics_snapshots").insert([
        { social_account_id: acct.id, followers: before, engagement_rate: er, captured_at: daysAgo(30) },
        { social_account_id: acct.id, followers, engagement_rate: er, growth_30d_pct: growth,
          avg_views: Math.round(followers * 0.35), avg_likes: Math.round(followers * er / 100), captured_at: daysAgo(1) },
      ]).select("id, captured_at");
      const latest = snaps?.find((s) => s.captured_at === daysAgo(1));
      if (latest) {
        await db.from("audience_demographics").insert([
          { snapshot_id: latest.id, dimension: "age", bucket: "18-24", pct: 34 },
          { snapshot_id: latest.id, dimension: "age", bucket: "25-34", pct: 41 },
          { snapshot_id: latest.id, dimension: "age", bucket: "35-44", pct: 15 },
          { snapshot_id: latest.id, dimension: "gender", bucket: "female", pct: 68 },
          { snapshot_id: latest.id, dimension: "gender", bucket: "male", pct: 30 },
          { snapshot_id: latest.id, dimension: "country", bucket: "US", pct: 72 },
        ]);
      }
    }
    await db.from("brand_partnerships").insert({
      creator_id: cp.id, brand_name: "Sample Brand Co. (fictional)", year: 2026, description: "Fictional example partnership.",
    });
    console.log(`✓ added ${display} → /creators/${c.handle}`);
  }
  console.log("Done. These are fictional — run with --remove before launch.");
}

(process.argv.includes("--remove") ? remove() : add()).catch((e) => {
  console.error(e);
  process.exit(1);
});
