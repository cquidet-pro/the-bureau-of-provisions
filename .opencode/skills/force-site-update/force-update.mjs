#!/usr/bin/env node
// Post-deploy checklist: verify the deploy landed, clear caches, report status.
// Run this after `gh run watch` confirms a green deploy.
import fs from "fs";
import { execSync } from "child_process";

// TODO: set once Firebase Hosting is created for the Bureau of Provisions.
const LIVE_URL = process.env.LIVE_URL || "https://bureauofprovisions.com";
const SW_FILE = "public/sw.js";
const VERSION_REGEX = /const VERSION = "([^"]+)"/;

// ── helpers ──

function green(s)  { return `\x1b[32m${s}\x1b[0m`; }
function red(s)    { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function fetchJS() {
  const html = execSync(`curl -s "${LIVE_URL}/"`, { encoding: "utf8", timeout: 15000 });
  const match = html.match(/assets\/index-[A-Za-z0-9]+\.js/);
  return match ? match[0] : null;
}

// ── step 1: CI status ──

function ciStatus() {
  try {
    const out = execSync(
      'gh run list --branch main --limit 1 --json databaseId,status,conclusion,headSha -q \'.[0] | "\\(.status) \\(.conclusion) \\(.headSha[0:8])"\'',
      { encoding: "utf8", timeout: 10000 }
    ).trim();
    const [status, conclusion, sha] = out.split(" ");
    const ok = status === "completed" && conclusion === "success";
    console.log(ok ? green(`✅ CI deploy: ${status} ${conclusion} (${sha})`)
                   : red(`❌ CI deploy: ${status} ${conclusion} (${sha})`));
    return ok;
  } catch (e) {
    console.log(red(`❌ Cannot check CI: ${e.message}`));
    return false;
  }
}

// ── step 2: live bundle check ──

function liveBundle() {
  try {
    const js = fetchJS();
    if (!js) { console.log(red("❌ Cannot find live JS bundle")); return false; }
    const local = fs.readdirSync("dist/assets").find(f => f.startsWith("index-") && f.endsWith(".js"));
    if (!local) { console.log(red("❌ No local build found — run npm run build first")); return false; }
    console.log(`   Local bundle: ${local}`);
    console.log(`   Live bundle:  ${js}`);
    if (js === local) {
      console.log(green("✅ Bundles match — deploy picked up local build"));
    } else {
      console.log(yellow("⚠️  Bundle names differ (expected — hashes include build platform)."));
      console.log(yellow("   Verify a specific string manually if you suspect stale content:"));
      console.log(yellow(`   curl -s "${LIVE_URL}/${js}" | grep -c "YOUR_EXPECTED_STRING"`));
    }
    return true;
  } catch (e) {
    console.log(red(`❌ Bundle check failed: ${e.message}`));
    return false;
  }
}

// ── step 3: clear service worker cache ──

function bumpSW() {
  try {
    const content = fs.readFileSync(SW_FILE, "utf8");
    const match = content.match(VERSION_REGEX);
    if (!match) { console.log(red("❌ Cannot find VERSION in sw.js")); return; }
    const oldV = match[1];
    const newV = `v${parseInt(oldV.replace(/^v/, "")) + 1}`;
    fs.writeFileSync(SW_FILE, content.replace(VERSION_REGEX, `const VERSION = "${newV}"`), "utf8");
    console.log(green(`✅ Service worker: ${oldV} → ${newV}`));
    execSync(`git add ${SW_FILE} && git commit -m "chore: bump SW version ${newV}" && git push origin main`,
      { stdio: "inherit", timeout: 30000 });
    console.log(green("✅ Cache clear pushed — users will get fresh content on next visit"));
  } catch (e) {
    console.log(red(`❌ SW bump failed: ${e.message}`));
  }
}

// ── main ──

const args = process.argv.slice(2);
const verify = args.includes("--verify") || args.includes("-v");

console.log(`\n${'='.repeat(50)}`);
console.log("  Post-deploy checklist");
console.log(`${'='.repeat(50)}\n`);

const ciOk = ciStatus();
console.log("");

if (verify || ciOk) {
  liveBundle();
  console.log("");
}

if (args.includes("--clear-cache")) {
  bumpSW();
}

console.log(`${'='.repeat(50)}\n`);

if (!ciOk) {
  console.log(red("The deploy FAILED or is still running — nothing to verify."));
  process.exit(1);
}

console.log("Next steps:");
console.log(`  1. Test in incognito: ${LIVE_URL}/`);
console.log("  2. If stale, run: node .opencode/skills/force-site-update/force-update.mjs --clear-cache");
console.log("  3. Wait 5 min for CDN propagation, then retest\n");
