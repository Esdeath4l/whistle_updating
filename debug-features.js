// Debug script to check location and video functionality
console.log('🔍 Debugging location and video issues...');

// Test 1: Check if geolocation is supported
console.log('\n📍 Testing Geolocation Support:');
if (typeof navigator !== 'undefined' && navigator.geolocation) {
    console.log('✅ Geolocation is supported');
    
    // Test location permissions
    navigator.permissions.query({name: 'geolocation'}).then(function(result) {
        console.log('🔐 Geolocation permission:', result.state);
    }).catch(err => {
        console.log('⚠️ Could not check geolocation permission');
    });
    
} else {
    console.log('❌ Geolocation is NOT supported');
}

// Test 2: Check if MediaRecorder is supported
console.log('\n📹 Testing Video Recording Support:');
if (typeof MediaRecorder !== 'undefined') {
    console.log('✅ MediaRecorder is supported');
    
    // Check supported video formats
    const formats = ['video/webm', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9'];
    formats.forEach(format => {
        if (MediaRecorder.isTypeSupported(format)) {
            console.log(`✅ Supports: ${format}`);
        } else {
            console.log(`❌ Does NOT support: ${format}`);
        }
    });
} else {
    console.log('❌ MediaRecorder is NOT supported');
}

// Test 3: Check getUserMedia support
console.log('\n📷 Testing Camera/Microphone Access:');
if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log('✅ getUserMedia is supported');
} else {
    console.log('❌ getUserMedia is NOT supported');
}

console.log('\n💡 Running this in browser console will show more accurate results');
console.log('💡 Location requires HTTPS in production or localhost for development');
console.log('💡 Video recording requires camera permissions');