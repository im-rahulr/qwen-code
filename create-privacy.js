import fs from 'fs';
import path from 'path';
import os from 'os';

const privacyDir = path.join(os.homedir(), '.qwen');
const privacyFile = path.join(privacyDir, 'privacy.json');

// Ensure directory exists
if (!fs.existsSync(privacyDir)) {
  fs.mkdirSync(privacyDir, { recursive: true });
}

// Create privacy settings with consent enabled
const privacySettings = {
  supabaseTrackingEnabled: true,
  dataRetentionDays: 90,
  trackPrompts: true,
  trackTokens: true,
  trackMetadata: true,
  consentGiven: true,
  consentDate: new Date().toISOString()
};

// Write the file
fs.writeFileSync(privacyFile, JSON.stringify(privacySettings, null, 2), 'utf8');

console.log(`✅ Privacy settings created at: ${privacyFile}`);
console.log(`✅ Consent enabled for Supabase tracking`);
