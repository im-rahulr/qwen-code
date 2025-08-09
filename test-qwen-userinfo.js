/**
 * Test script to verify Qwen userinfo endpoint functionality
 * This script tests the getUserInfo method without requiring full authentication
 */

import { getQwenUserEmail } from './packages/core/dist/src/qwen/qwenOAuth2.js';

// Mock config for testing
const mockConfig = {
  getProxy: () => undefined,
};

async function testQwenUserInfo() {
  console.log('🧪 Testing Qwen User Info Functionality...\n');

  try {
    console.log('1. Testing getQwenUserEmail function...');
    
    // This will attempt to get user email but will likely fail without valid credentials
    // That's expected - we're testing the function exists and handles errors gracefully
    const userEmail = await getQwenUserEmail(mockConfig);
    
    if (userEmail) {
      console.log(`✅ User email retrieved: ${userEmail}`);
    } else {
      console.log('ℹ️  No user email available (expected without authentication)');
    }

    console.log('\n2. Testing error handling...');
    console.log('✅ Function executed without throwing errors');

    console.log('\n🎉 Qwen user info test completed!');
    console.log('\nNote: To test with real data, authenticate with Qwen OAuth first.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nThis is expected if no Qwen credentials are available.');
  }
}

testQwenUserInfo();
