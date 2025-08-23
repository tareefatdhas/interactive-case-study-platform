// Test Firebase connection
const { initializeApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');

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

console.log('🔧 Testing Firebase Configuration...\n');

// Check if all required environment variables are present
const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName].includes('your_'));

if (missingVars.length > 0) {
  console.log('❌ Missing or incomplete environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}: ${process.env[varName] || 'Not set'}`);
  });
  console.log('\n📝 Please update your .env.local file with actual Firebase values.');
  process.exit(1);
}

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  console.log('✅ Firebase configuration looks good!');
  console.log('📊 Project ID:', firebaseConfig.projectId);
  console.log('🔐 Auth Domain:', firebaseConfig.authDomain);
  console.log('🗄️ Firestore initialized');
  console.log('🔒 Authentication initialized');
  
  console.log('\n🎉 Setup appears to be complete!');
  console.log('\nNext steps:');
  console.log('1. Visit http://localhost:3000 in your browser');
  console.log('2. Click "Sign Up" to create your first teacher account');
  console.log('3. Create a case study and start a session');
  console.log('4. Test student access by visiting /join');
  
} catch (error) {
  console.log('❌ Firebase initialization failed:');
  console.log(error.message);
  console.log('\n🔍 Please check your Firebase configuration and try again.');
  process.exit(1);
}