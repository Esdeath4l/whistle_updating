/**
 * Environment Variables Checker for Whistle App
 * Checks if all required environment variables are set up correctly
 */

export function checkEnvironmentVariables() {
  console.log("🔍 Checking environment variables...");
  
  const requiredVars = {
    'Database': {
      'MONGODB_URI': process.env.MONGODB_URI,
      'DATABASE_NAME': process.env.DATABASE_NAME
    },
    'SMS (Twilio)': {
      'TWILIO_ACCOUNT_SID': process.env.TWILIO_ACCOUNT_SID,
      'TWILIO_AUTH_TOKEN': process.env.TWILIO_AUTH_TOKEN,
      'TWILIO_FROM_NUMBER': process.env.TWILIO_FROM_NUMBER,
      'ADMIN_PHONE_NUMBER': process.env.ADMIN_PHONE_NUMBER
    },
    'Email': {
      'EMAIL_USER': process.env.EMAIL_USER,
      'EMAIL_PASS': process.env.EMAIL_PASS
    },
    'Admin Authentication': {
      'ADMIN_USERNAME': process.env.ADMIN_USERNAME,
      'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD,
      'JWT_SECRET': process.env.JWT_SECRET
    },
    'Server': {
      'PORT': process.env.PORT,
      'CLIENT_URL': process.env.CLIENT_URL,
      'CORS_ORIGINS': process.env.CORS_ORIGINS
    }
  };

  const results = {
    configured: {},
    missing: {},
    recommendations: []
  };

  console.log("\n📋 Environment Variables Status:");
  console.log("=" .repeat(50));

  Object.entries(requiredVars).forEach(([category, vars]) => {
    console.log(`\n${category}:`);
    
    Object.entries(vars).forEach(([varName, value]) => {
      const isSet = value !== undefined && value !== null && value !== '';
      const maskedValue = varName.includes('PASSWORD') || varName.includes('TOKEN') || varName.includes('SECRET') 
        ? (isSet ? '[SET]' : '[NOT SET]') 
        : (isSet ? value : '[NOT SET]');
      
      console.log(`  ${isSet ? '✅' : '❌'} ${varName}: ${maskedValue}`);
      
      if (isSet) {
        if (!results.configured[category]) results.configured[category] = [];
        results.configured[category].push(varName);
      } else {
        if (!results.missing[category]) results.missing[category] = [];
        results.missing[category].push(varName);
      }
    });
  });

  // Add recommendations based on missing variables
  if (results.missing['SMS (Twilio)'] && results.missing['SMS (Twilio)'].length > 0) {
    results.recommendations.push(
      "SMS notifications disabled. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, ADMIN_PHONE_NUMBER to enable."
    );
  }

  if (results.missing['Email'] && results.missing['Email'].length > 0) {
    results.recommendations.push(
      "Email notifications disabled. Set EMAIL_USER, EMAIL_PASS to enable."
    );
  }

  if (results.missing['Admin Authentication'] && results.missing['Admin Authentication'].length > 0) {
    results.recommendations.push(
      "Admin authentication may not work properly. Set ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET."
    );
  }

  console.log("\n📝 Recommendations:");
  console.log("=" .repeat(50));
  if (results.recommendations.length > 0) {
    results.recommendations.forEach(rec => {
      console.log(`• ${rec}`);
    });
  } else {
    console.log("✅ All critical environment variables are configured!");
  }

  console.log("\n" + "=" .repeat(50));
  
  return results;
}

export default checkEnvironmentVariables;