import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
      }),
  );
}

const env = { ...readEnv(path.join(root, '.env.local')), ...process.env };
const failures = [];
const warnings = [];
const passes = [];

function check(condition, pass, failure) {
  if (condition) passes.push(pass);
  else failures.push(failure);
}

const requiredKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'GEMINI_API_KEY',
];
const missingKeys = requiredKeys.filter((key) => !env[key]);
check(missingKeys.length === 0, 'Required Firebase and AI configuration is present.', `Missing environment keys: ${missingKeys.join(', ')}`);

let publicUrl;
try {
  publicUrl = new URL(env.NEXT_PUBLIC_APP_URL || '');
} catch {
  publicUrl = null;
}
check(
  Boolean(publicUrl && publicUrl.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(publicUrl.hostname)),
  'The classroom has a public HTTPS address.',
  'NEXT_PUBLIC_APP_URL must be the final public HTTPS address, not localhost.',
);

check(Boolean(env.NEXT_PUBLIC_PDPA_CONTROLLER_NAME), 'The privacy notice names the data controller.', 'Set NEXT_PUBLIC_PDPA_CONTROLLER_NAME before inviting students.');
check(Boolean(env.NEXT_PUBLIC_PDPA_CONTACT), 'The privacy notice includes a contact route.', 'Set NEXT_PUBLIC_PDPA_CONTACT before inviting students.');
check(env.FIREBASE_BLAZE_CONFIRMED === 'true', 'Realtime Database capacity has been confirmed for 100 to 200 students.', 'Confirm the Firebase project is on Blaze, then set FIREBASE_BLAZE_CONFIRMED=true. Spark allows only 100 simultaneous Realtime Database connections.');
check(env.FIREBASE_ANON_SIGNUP_QUOTA_CONFIRMED === 'true', 'Anonymous sign-up capacity has been confirmed.', 'Schedule or confirm an anonymous account-creation quota above the expected class size, then set FIREBASE_ANON_SIGNUP_QUOTA_CONFIRMED=true.');
check(env.FIREBASE_RULES_DEPLOYED_CONFIRMED === 'true', 'The reviewed Firebase rules are deployed.', 'Deploy and test Firestore and Realtime Database rules, then set FIREBASE_RULES_DEPLOYED_CONFIRMED=true.');
check(env.REAL_DEVICE_E2E_CONFIRMED === 'true', 'The latest build passed the real-device classroom preflight.', 'Run the instructor, projector, and separate-phone preflight in LIVE_CLASSROOM_RUNBOOK.md, then set REAL_DEVICE_E2E_CONFIRMED=true.');

const firebaseRcPath = path.join(root, '.firebaserc');
if (fs.existsSync(firebaseRcPath)) {
  const project = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8')).projects?.default;
  check(project === env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'Firebase deployment alias matches the app configuration.', 'The Firebase deployment alias does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID.');
} else {
  failures.push('Missing .firebaserc project alias.');
}

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
check(Boolean(firebaseConfig.firestore?.rules && firebaseConfig.database?.rules), 'Firestore and Realtime Database rules are configured for deployment.', 'firebase.json must include both Firestore and Realtime Database rules.');
if (firebaseConfig.hosting?.public === 'out') warnings.push('The old static Firebase Hosting configuration cannot run the AI API routes. Use a Next.js-compatible host.');

console.log('\nThe Living Seminar classroom readiness\n');
passes.forEach((item) => console.log(`PASS  ${item}`));
warnings.forEach((item) => console.log(`WARN  ${item}`));
failures.forEach((item) => console.log(`BLOCK ${item}`));
console.log(`\n${passes.length} passed, ${warnings.length} warnings, ${failures.length} blockers.\n`);
process.exitCode = failures.length ? 1 : 0;
