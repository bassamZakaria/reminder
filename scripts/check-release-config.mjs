import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const REQUIRED_LINKS = ['privacyPolicyUrl', 'supportUrl', 'termsUrl', 'webUrl'];
const PLACEHOLDER = /YOUR_CONTACT_EMAIL|YOUR_PROJECT_REF|example\.com/i;

const problems = [];
let config;
try {
  config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
} catch {
  console.error('app.config.json is missing. Run scripts/setup-supabase.sh first.');
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(config.supabaseUrl ?? '')) {
  problems.push(`supabaseUrl must point at the cloud project, got "${config.supabaseUrl ?? ''}"`);
}
if (config.forcePremium === true) {
  problems.push('forcePremium is on: every paid feature would be free');
}
for (const key of REQUIRED_LINKS) {
  const value = config[key];
  if (!value) {
    problems.push(`${key} is empty`);
  } else if (!/^https:\/\//.test(value) || PLACEHOLDER.test(value)) {
    problems.push(`${key} is not a published https URL: "${value}"`);
  }
}
for (const page of ['docs/privacy-policy.md', 'docs/support.md', 'docs/terms.md']) {
  const text = readFileSync(join(root, page), 'utf8');
  if (text.includes('YOUR_CONTACT_EMAIL')) {
    problems.push(`${page} still has the YOUR_CONTACT_EMAIL placeholder`);
  }
}

if (problems.length) {
  console.error('Not ready to submit:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}
console.log('Release config looks ready for the App Store and Google Play.');
