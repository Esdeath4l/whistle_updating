import bcrypt from 'bcrypt';

async function testPasswordHash() {
  const password = "satoru2624";
  const existingHash = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8BvD7bA5Y8hC5GhFVQpZfGZJ1/qCui";
  
  console.log('🔍 Testing password hash...');
  console.log('Password:', password);
  console.log('Hash:', existingHash);
  
  try {
    const isValid = await bcrypt.compare(password, existingHash);
    console.log('✅ Password validation result:', isValid);
    
    // Also generate a new hash for comparison
    const newHash = await bcrypt.hash(password, 12);
    console.log('🔧 New hash generated:', newHash);
    
    const newIsValid = await bcrypt.compare(password, newHash);
    console.log('✅ New hash validation:', newIsValid);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPasswordHash();