#!/usr/bin/env node

/**
 * Test script to verify Supabase integration works
 */

import { getSupabaseService } from './packages/cli/dist/src/services/supabaseClient.js';
import { getPrivacyService } from './packages/cli/dist/src/services/privacyService.js';
import { getInteractionTracker } from './packages/cli/dist/src/services/interactionTracker.js';
import { loadEnvironment } from './packages/cli/dist/src/config/settings.js';

async function testSupabaseIntegration() {
  console.log('🧪 Testing Supabase Integration...\n');

  // Test enhanced logger integration
  console.log('0.5. Testing enhanced logger integration...');
  try {
    const { EnhancedLogger } = await import('./packages/cli/dist/src/services/enhancedLogger.js');
    const enhancedLogger = new EnhancedLogger();
    const queueStatus = enhancedLogger.getInteractionTracker().getQueueStatus();
    console.log(`   Enhanced logger queue status: ${JSON.stringify(queueStatus, null, 2)}`);
  } catch (error) {
    console.log(`   Error testing enhanced logger: ${error.message}`);
  }

  // Load environment variables first
  console.log('0. Loading environment variables...');
  loadEnvironment();
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Not set'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set'}`);
  console.log(`   SUPABASE_USER_EMAIL: ${process.env.SUPABASE_USER_EMAIL ? 'Set' : 'Not set'}`);
  console.log(`   Working directory: ${process.cwd()}`);

  // Test 1: Check Supabase service initialization
  console.log('\n1. Testing Supabase service initialization...');
  const supabaseService = getSupabaseService();
  const interactionTracker = getInteractionTracker();
  const config = supabaseService.getConfig();
  
  if (config) {
    console.log('✅ Supabase service initialized successfully');
    console.log(`   URL: ${config.url}`);
    console.log(`   User Email: ${config.userEmail}`);
    console.log(`   Enabled: ${config.enabled}`);
  } else {
    console.log('❌ Supabase service not configured');
    console.log('   Make sure to set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_USER_EMAIL environment variables');
  }

  // Test 2: Check privacy service
  console.log('\n2. Testing Privacy service...');
  const privacyService = getPrivacyService();
  const settings = privacyService.getSettings();
  
  console.log('✅ Privacy service initialized');
  console.log(`   Tracking enabled: ${privacyService.isTrackingEnabled()}`);
  console.log(`   Consent given: ${settings.consentGiven}`);
  console.log(`   Track prompts: ${settings.trackPrompts}`);
  console.log(`   Track tokens: ${settings.trackTokens}`);
  console.log(`   Data retention: ${settings.dataRetentionDays} days`);

  // Test 3: Health check (if configured)
  if (config) {
    console.log('\n3. Testing database connectivity...');
    try {
      const health = await supabaseService.healthCheck();
      if (health.isHealthy) {
        console.log('✅ Database connection healthy');
        console.log(`   Latency: ${health.latencyMs}ms`);
      } else {
        console.log('❌ Database connection failed');
        console.log(`   Error: ${health.error}`);
      }
    } catch (error) {
      console.log('❌ Health check failed');
      console.log(`   Error: ${error.message}`);
    }

    // Test 4: Enable consent and test logging
    console.log('\n4. Enabling consent and testing interaction logging...');
    privacyService.giveConsent();
    console.log('✅ Consent given, tracking enabled');

    if (privacyService.isTrackingEnabled()) {
      console.log('\n4. Testing interaction logging...');

      // Check interaction tracker status
      const queueStatus = interactionTracker.getQueueStatus();
      console.log(`   Queue status: ${JSON.stringify(queueStatus, null, 2)}`);
      try {
        const testInteraction = {
          prompt_text: 'Test prompt for Supabase integration',
          prompt_id: 'test-' + Date.now(),
          session_id: 'test-session-' + Date.now(),
          model_name: 'test-model',
          input_token_count: 10,
          output_token_count: 20,
          total_token_count: 30,
          metadata: { test: true },
        };

        const success = await supabaseService.logUserInteraction(testInteraction);
        if (success) {
          console.log('✅ Test interaction logged successfully');
        } else {
          console.log('❌ Failed to log test interaction');
        }
      } catch (error) {
        console.log('❌ Error logging test interaction');
        console.log(`   Error: ${error.message}`);
      }

      // Test 5: Get user stats
      console.log('\n5. Testing user statistics...');
      try {
        const stats = await supabaseService.getUserStats();
        console.log('✅ User statistics retrieved');
        console.log(`   Total interactions: ${stats.totalInteractions}`);
        console.log(`   Total tokens: ${stats.totalTokens}`);
        console.log(`   Average tokens per interaction: ${stats.averageTokensPerInteraction}`);
        if (stats.lastInteraction) {
          console.log(`   Last interaction: ${new Date(stats.lastInteraction).toLocaleString()}`);
        }
      } catch (error) {
        console.log('❌ Error fetching user statistics');
        console.log(`   Error: ${error.message}`);
      }
    } else {
      console.log('\n❌ Tracking still disabled after giving consent');
      console.log('   This indicates a configuration issue');
    }
  }

  console.log('\n🎉 Supabase integration test completed!');
  
  if (!config) {
    console.log('\n📝 To enable Supabase tracking:');
    console.log('1. Set environment variables in .env file:');
    console.log('   SUPABASE_URL=https://ycxceefjouwuzxxsdxmt.supabase.co');
    console.log('   SUPABASE_ANON_KEY=your-anon-key');
    console.log('   SUPABASE_USER_EMAIL=your-email@example.com');
    console.log('2. Give consent using: /privacy consent give');
  }
}

// Run the test
testSupabaseIntegration().catch(console.error);
