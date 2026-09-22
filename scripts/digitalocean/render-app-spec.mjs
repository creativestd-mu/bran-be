#!/usr/bin/env node
/* global console */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function argument(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadEnv(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

function discoverRuntimeKeys() {
  const keys = new Set();
  const roots = [path.join(repoRoot, "src")];
  const visit = (entry) => {
    for (const item of fs.readdirSync(entry, { withFileTypes: true })) {
      const fullPath = path.join(entry, item.name);
      if (item.isDirectory()) visit(fullPath);
      if (!item.isFile() || !item.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(fullPath, "utf8");
      for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        keys.add(match[1]);
      }
    }
  };
  roots.forEach(visit);
  return keys;
}

const templatePath = argument("--template", path.join(repoRoot, ".do/app.yaml"));
const railwayPath = argument(
  "--railway-env",
  path.join(process.env.HOME, ".config/bran-be/railway-production.json")
);
const digitalOceanPath = argument(
  "--digitalocean-env",
  path.join(process.env.HOME, ".config/bran-be/digitalocean-production.env")
);
const outputPath = argument("--output", "/tmp/bran-app-spec.json");
const imageTag = argument(
  "--image-tag",
  execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8"
  }).trim()
);
const appUrl = argument(
  "--app-url",
  "https://bran-be-production-3549.up.railway.app"
).replace(/\/$/, "");

const spec = loadJson(templatePath);
for (const component of [...(spec.services ?? []), ...(spec.jobs ?? [])]) {
  if (component.image?.tag?.includes("__IMAGE_TAG__")) {
    component.image.tag = component.image.tag.replace("__IMAGE_TAG__", imageTag);
  }
}
const railway = loadJson(railwayPath);
const digitalOcean = loadEnv(digitalOceanPath);
const runtimeKeys = discoverRuntimeKeys();

const excluded = new Set([
  "PORT",
  "NODE_ENV",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_SSLMODE"
]);

const values = {};
for (const [key, value] of Object.entries(railway)) {
  if (runtimeKeys.has(key) && !excluded.has(key) && value !== "") {
    values[key] = String(value);
  }
}

for (const key of [
  "DATABASE_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE"
]) {
  if (digitalOcean[key]) values[key] = digitalOcean[key];
}

if (hasFlag("--use-do-qdrant")) {
  values.QDRANT_URL = digitalOcean.QDRANT_URL;
  values.QDRANT_API_KEY = digitalOcean.QDRANT_API_KEY;
}

values.APP_URL = appUrl;
values.GOOGLE_OAUTH_REDIRECT_URI = `${appUrl}/oauth/google/calendar/callback`;
values.GOOGLE_GMAIL_OAUTH_REDIRECT_URI = `${appUrl}/oauth/google/gmail/callback`;

if (hasFlag("--disable-schedulers")) {
  for (const key of [
    "ATTENDANCE_CRON_ENABLED",
    "ESCALATION_CRON_ENABLED",
    "EVENTS_DETECT_CRON_ENABLED",
    "GMAIL_SYNC_CRON_ENABLED",
    "MEETINGS_SYNC_CRON_ENABLED",
    "MELTWATER_COMPETITOR_CRON_ENABLED",
    "MELTWATER_EARNED_CRON_ENABLED",
    "PODS_SOCIAL_CRON_ENABLED",
    "REVIEW_REMINDERS_CRON_ENABLED",
    "WORK_INGEST_CRON_ENABLED"
  ]) {
    values[key] = "false";
  }
}

for (const required of [
  "DATABASE_URL",
  "JWT_SECRET",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY"
]) {
  if (!values[required]) {
    throw new Error(`Missing required production variable: ${required}`);
  }
}

const fixedEnv = new Map(spec.envs.map((entry) => [entry.key, entry]));
for (const [key, value] of Object.entries(values).sort(([left], [right]) =>
  left.localeCompare(right)
)) {
  fixedEnv.set(key, {
    key,
    value,
    scope: "RUN_TIME",
    type: "SECRET"
  });
}
spec.envs = [...fixedEnv.values()];

fs.writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(outputPath, 0o600);
console.log(
  `Rendered App Platform spec to ${outputPath} with ${Object.keys(values).length} runtime variables.`
);
