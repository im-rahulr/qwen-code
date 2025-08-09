import { loadEnvironment } from './packages/cli/dist/src/config/settings.js';
import { logUserPrompt } from './packages/cli/dist/src/services/enhancedLogger.js';

console.log('🧪 Testing CLI Logging Simulation...\n');

// Load environment like the CLI does
loadEnvironment();

// Simulate the exact call that the CLI makes
const prompt_id = Math.random().toString(16).slice(2);
const input = "Test prompt for CLI logging verification - please respond with a simple acknowledgment";

console.log(`Simulating CLI logUserPrompt call:`);
console.log(`   Prompt: "${input}"`);
console.log(`   Prompt ID: ${prompt_id}`);
console.log(`   Prompt length: ${input.length}`);

// This is the exact call from gemini.tsx line 302-309
const mockConfig = {
  getContentGeneratorConfig: () => ({ authType: 'test-auth' })
};

try {
  logUserPrompt(mockConfig, {
    'event.name': 'user_prompt',
    'event.timestamp': new Date().toISOString(),
    prompt: input,
    prompt_id,
    auth_type: 'test-auth',
    prompt_length: input.length,
  });
  
  console.log('✅ logUserPrompt called successfully');
  
  // Wait a moment for async operations
  console.log('⏳ Waiting 3 seconds for async logging...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('✅ CLI logging simulation complete');
  
} catch (error) {
  console.log(`❌ Error calling logUserPrompt: ${error.message}`);
  console.log(`   Stack: ${error.stack}`);
}

console.log('\n🧪 CLI Logging Test Complete');
