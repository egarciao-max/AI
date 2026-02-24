#!/usr/bin/env node

// Configuration script for Familia AI Frontend
// Run this script to configure your backend URL

const fs = require('fs');
const path = require('path');

console.log('🚀 Familia AI Frontend Configuration');
console.log('==================================');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created');
}

// Read current .env content
let envContent = fs.readFileSync(envPath, 'utf8');

// Get backend URL from user
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('🌐 Enter your Familia AI Backend URL (e.g., https://your-app.workers.dev): ', (backendUrl) => {
  if (!backendUrl) {
    console.log('❌ No URL provided. Using default URL.');
    backendUrl = 'https://family-ai-backend.enriquegarciaoropeza.workers.dev';
  }

  // Validate URL format
  if (!backendUrl.startsWith('http')) {
    backendUrl = 'https://' + backendUrl;
  }

  // Update .env file
  const oldUrl = 'https://family-ai-backend.enriquegarciaoropeza.workers.dev';
  envContent = envContent.replace(oldUrl, backendUrl);
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Backend URL configured successfully!');
  console.log(`📍 Backend URL: ${backendUrl}`);
  
  console.log('\n🎉 Configuration complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm run dev');
  console.log('3. Open: http://localhost:3000');
  
  rl.close();
});