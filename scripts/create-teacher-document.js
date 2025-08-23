// Create missing teacher document for existing user
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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

async function createTeacherDocument() {
  try {
    console.log('🔧 Creating teacher document...\n');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Your user UID from the Firebase console image
    const userUID = '9PmrWwtVFjPNTXz4FLlPPnkOVmV2';
    const email = 'tareef@happily.ai';
    const name = 'Tareef Jafferi';
    
    // Create teacher document
    await setDoc(doc(db, 'teachers', userUID), {
      email: email,
      name: name,
      courseIds: [],
      createdAt: new Date()
    });
    
    console.log('✅ Teacher document created successfully!');
    console.log('📊 Details:');
    console.log('  User UID:', userUID);
    console.log('  Email:', email);
    console.log('  Name:', name);
    console.log('  Collection: teachers');
    
    console.log('\n🎉 You should now be able to log in!');
    console.log('Try logging in at: http://localhost:3000/login');
    
  } catch (error) {
    console.error('❌ Error creating teacher document:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    
    if (error.code === 'permission-denied') {
      console.log('\n💡 This might be a Firestore rules issue.');
      console.log('Make sure you deployed the security rules in Firebase Console.');
    }
  }
}

createTeacherDocument();