import { loadEnvironment } from './packages/cli/dist/src/config/settings.js';
import { getSupabaseService } from './packages/cli/dist/src/services/supabaseClient.js';
import { getPrivacyService } from './packages/cli/dist/src/services/privacyService.js';
import { getInteractionTracker } from './packages/cli/dist/src/services/interactionTracker.js';
import { EnhancedLogger } from './packages/cli/dist/src/services/enhancedLogger.js';

console.log('🔍 Debugging CLI Environment...\n');

console.log('Working directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

// Load environment like the CLI does
console.log('\n1. Loading environment...');
loadEnvironment();

console.log('Environment variables:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Not set'}`);
console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set'}`);
console.log(`   SUPABASE_USER_EMAIL: ${process.env.SUPABASE_USER_EMAIL ? 'Set' : 'Not set'}`);

// Test services
console.log('\n2. Testing services...');
try {
  const supabaseService = getSupabaseService();
  console.log('✅ Supabase service initialized');
  console.log(`   Enabled: ${supabaseService.isEnabled()}`);
} catch (error) {
  console.log(`❌ Supabase service error: ${error.message}`);
}

try {
  const privacyService = getPrivacyService();
  console.log('✅ Privacy service initialized');
  console.log(`   Tracking enabled: ${privacyService.isTrackingEnabled()}`);
  console.log(`   Consent given: ${privacyService.hasConsentGiven()}`);
} catch (error) {
  console.log(`❌ Privacy service error: ${error.message}`);
}

try {
  const interactionTracker = getInteractionTracker();
  console.log('✅ Interaction tracker initialized');
  const queueStatus = interactionTracker.getQueueStatus();
  console.log(`   Queue status: ${JSON.stringify(queueStatus, null, 2)}`);
} catch (error) {
  console.log(`❌ Interaction tracker error: ${error.message}`);
}

try {
  const enhancedLogger = new EnhancedLogger();
  console.log('✅ Enhanced logger initialized');
  const trackerStatus = enhancedLogger.getInteractionTracker().getQueueStatus();
  console.log(`   Enhanced logger tracker status: ${JSON.stringify(trackerStatus, null, 2)}`);
} catch (error) {
  console.log(`❌ Enhanced logger error: ${error.message}`);
}

console.log('\n🔍 CLI Environment Debug Complete');
