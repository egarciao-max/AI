// Test script for Familia AI Frontend-Backend Connection
// Run this script to test the API connection

const FamiliaAIAPI = require('./src/api.js').default;

async function testConnection() {
  console.log('Testing Familia AI Frontend-Backend Connection...\n');

  const api = new FamiliaAIAPI();
  
  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const response = await fetch(`${api.baseURL}/api/health`);
    if (response.ok) {
      console.log('✅ Health check passed');
    } else {
      console.log('❌ Health check failed');
      return;
    }

    // Test 2: Test Supabase connection
    console.log('2. Testing Supabase connection...');
    const testResponse = await fetch(`${api.baseURL}/api/test-supabase`);
    if (testResponse.ok) {
      console.log('✅ Supabase connection test passed');
    } else {
      console.log('❌ Supabase connection test failed');
    }

    // Test 3: Test CORS headers
    console.log('3. Testing CORS configuration...');
    const corsResponse = await fetch(`${api.baseURL}/api/health`, {
      method: 'OPTIONS'
    });
    if (corsResponse.headers.get('Access-Control-Allow-Origin')) {
      console.log('✅ CORS headers configured correctly');
    } else {
      console.log('❌ CORS headers not configured');
    }

    console.log('\n🎉 All connection tests passed!');
    console.log(`Backend URL: ${api.baseURL}`);
    console.log('The frontend is ready to connect to the Familia AI backend.');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.log('\nPossible issues:');
    console.log('- Backend URL might be incorrect');
    console.log('- Backend might not be deployed');
    console.log('- CORS might not be configured properly');
    console.log('- Network connectivity issues');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testConnection();
}

module.exports = { testConnection };