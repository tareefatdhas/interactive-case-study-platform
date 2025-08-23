// Debug teacher document lookup
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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

async function debugTeacherLookup() {
  try {
    console.log('🔍 Debug Teacher Document Lookup...\n');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Your user UID
    const userUID = '9PmrWwtVFjPNTXz4FLlPPnkOVmV2';
    
    console.log('📋 Looking for teacher document:');
    console.log('  Collection: teachers');
    console.log('  Document ID:', userUID);
    
    // Try to get the teacher document
    const teacherDocRef = doc(db, 'teachers', userUID);
    const teacherDoc = await getDoc(teacherDocRef);
    
    if (teacherDoc.exists()) {
      console.log('✅ Teacher document found!');
      console.log('📊 Document data:');
      console.log(JSON.stringify(teacherDoc.data(), null, 2));
    } else {
      console.log('❌ Teacher document NOT found!');
      console.log('🔍 This explains why login is failing.');
      console.log('💡 The document might not be saved correctly.');
    }
    
    // Also check if we can access the collection
    console.log('\n🔍 Checking collection access...');
    const { collection, getDocs } = require('firebase/firestore');
    
    try {
      const teachersCollection = collection(db, 'teachers');
      const snapshot = await getDocs(teachersCollection);
      console.log('📊 Total teachers in collection:', snapshot.size);
      
      snapshot.forEach((doc) => {
        console.log('  - Document ID:', doc.id);
        console.log('  - Data:', doc.data());
      });
    } catch (error) {
      console.log('❌ Error accessing collection:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error during lookup:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
  }
}

debugTeacherLookup();