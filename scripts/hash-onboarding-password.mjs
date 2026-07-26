#!/usr/bin/env node
/**
 * Hash a password for onboarding_recorders.password_hash inserts.
 *
 *   node scripts/hash-onboarding-password.mjs 'your-password'
 */
const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-onboarding-password.mjs 'your-password'");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
console.log("");
console.log("SQL example:");
console.log(`insert into public.onboarding_recorders (username, password_hash)`);
console.log(`values ('alex', '${hash}');`);
