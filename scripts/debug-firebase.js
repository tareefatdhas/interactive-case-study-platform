// Debug Firebase configuration
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator } = require('firebase/auth');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('🔧 Debug Firebase Configuration...\n');

console.log('📋 Configuration Values:');
console.log('  API Key:', firebaseConfig.apiKey?.substring(0, 10) + '...');
console.log('  Auth Domain:', firebaseConfig.authDomain);
console.log('  Project ID:', firebaseConfig.projectId);
console.log('  Storage Bucket:', firebaseConfig.storageBucket);
console.log('  Messaging Sender ID:', firebaseConfig.messagingSenderId);
console.log('  App ID:', firebaseConfig.appId?.substring(0, 20) + '...');

try {
  console.log('\n🚀 Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
  
  console.log('\n🔐 Initializing Authentication...');
  const auth = getAuth(app);
  console.log('✅ Firebase Auth initialized successfully');
  
  console.log('\n📊 Auth Configuration:');
  console.log('  Current User:', auth.currentUser);
  console.log('  App Name:', auth.app.name);
  console.log('  Config:', {
    apiKey: auth.config.apiKey?.substring(0, 10) + '...',
    authDomain: auth.config.authDomain
  });
  
  console.log('\n🎉 Firebase configuration appears to be working!');
  console.log('\n💡 If you\'re still seeing auth/configuration-not-found:');
  console.log('1. Make sure Firebase Authentication is enabled in console');
  console.log('2. Enable Email/Password sign-in method');
  console.log('3. Check if there are any billing/quota issues');
  console.log('4. Try signing up with a different email');
  
} catch (error) {
  console.log('\n❌ Firebase initialization failed:');
  console.log('Error code:', error.code);
  console.log('Error message:', error.message);
  console.log('\nPossible solutions:');
  console.log('1. Double-check all environment variables');
  console.log('2. Ensure Firebase project exists and is active');
  console.log('3. Verify API key has proper permissions');
}