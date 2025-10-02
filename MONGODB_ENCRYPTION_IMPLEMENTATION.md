# 🔐 MongoDB Automatic Encryption Implementation

## Overview

Comprehensive MongoDB encryption system using Mongoose pre-save hooks to automatically encrypt sensitive report data before database insertion, with automatic decryption when fetching reports for admin dashboard.

## 🎯 **Implementation Features**

### ✅ **Automatic Encryption (Pre-Save Hooks)**
- **Sensitive Fields Encrypted**: `message`, `location`, `reporterEmail`, `admin_notes`
- **Encryption Algorithm**: AES-256-CBC with PBKDF2 key derivation
- **Automatic Triggering**: All `create()` and `save()` operations
- **Security Flag**: `is_encrypted: true` automatically set after encryption

### ✅ **Mongoose Middleware Integration**
```typescript
// Pre-save middleware automatically encrypts on every save
reportSchema.pre('save', async function(next) {
  const sensitiveFields = ['message', 'location', 'reporterEmail', 'admin_notes'];
  
  for (const field of sensitiveFields) {
    if (this.isModified(field) && this[field]) {
      const encrypted = DataEncryption.encrypt(dataToEncrypt);
      
      // Store encrypted data in dedicated fields
      this[`${field}_encrypted`] = encrypted.encrypted;
      this[`${field}_iv`] = encrypted.iv;
      this[`${field}_salt`] = encrypted.salt;
      
      // Clear original field for security
      this[field] = undefined;
      this.is_encrypted = true;
    }
  }
});
```

### ✅ **Schema Fields for Encrypted Storage**
```typescript
// New schema fields for encrypted data storage
message_encrypted: String (select: false)
message_iv: String (select: false)
message_salt: String (select: false)
location_encrypted: String (select: false)
location_iv: String (select: false)
location_salt: String (select: false)
reporterEmail_encrypted: String (select: false)
reporterEmail_iv: String (select: false)
reporterEmail_salt: String (select: false)
admin_notes_encrypted: String (select: false)
admin_notes_iv: String (select: false)
admin_notes_salt: String (select: false)
```

### ✅ **Automatic Decryption (Admin Dashboard)**
```typescript
// Admin reports route with automatic decryption
const reports = await ReportModel.find()
  .select('+message_encrypted +message_iv +message_salt +location_encrypted...')
  .sort({ createdAt: -1 });

// Decrypt all reports for admin viewing
const decryptedReports = await DataEncryption.decryptReportArray(reports);
```

### ✅ **Status Checking with Decryption**
```typescript
// Status checking route with automatic decryption
const report = await ReportModel.findOne({ shortId: reportId })
  .select('+message_encrypted +message_iv +message_salt...');

const decryptedReport = await DataEncryption.decryptReportDocument(report);
```

## 🛡️ **Security Implementation**

### **Field-Level Encryption**
- **Message**: User report content (always encrypted)
- **Location**: GPS coordinates and address data (always encrypted)  
- **Reporter Email**: Optional contact information (always encrypted)
- **Admin Notes**: Administrative comments (always encrypted)

### **Encryption Specifications**
- **Algorithm**: AES-256-CBC
- **Key Derivation**: PBKDF2 with 1000 iterations
- **Salt**: 128-bit random salt per field
- **IV**: 128-bit random initialization vector per field
- **Storage**: Separate encrypted fields with `select: false` for security

### **Data Flow Security**
1. **User Submission** → Pre-save hook → **Automatic encryption** → **MongoDB storage**
2. **Admin Request** → Database query → **Automatic decryption** → **Clean response**
3. **Status Check** → Database query → **Automatic decryption** → **User response**

## 📊 **Enhanced Encryption Utilities**

### **New DataEncryption Methods**
```typescript
// Decrypt single report document
DataEncryption.decryptReportDocument(report): Promise<any>

// Decrypt array of reports
DataEncryption.decryptReportArray(reports): Promise<any[]>

// Enhanced field-level decryption
DataEncryption.decryptSensitiveFields(data, fields): any
```

### **Report Model Instance Methods**
```typescript
// Get decrypted message
report.getDecryptedMessage(): string

// Get decrypted location  
report.getDecryptedLocation(): any

// Get decrypted admin notes
report.getDecryptedAdminNotes(): string
```

## 🔄 **Database Operation Flow**

### **Report Creation**
```typescript
const report = new ReportModel({
  message: "Sensitive report content",
  location: { lat: 40.7128, lng: -74.0060 },
  reporterEmail: "user@example.com"
});

await report.save(); // ← Pre-save hook automatically encrypts all sensitive fields
// Result: message_encrypted, location_encrypted, reporterEmail_encrypted fields populated
//         Original fields cleared for security
//         is_encrypted: true
```

### **Admin Dashboard Viewing**
```typescript
// Get reports with encrypted fields
const reports = await ReportModel.find()
  .select('+message_encrypted +message_iv +message_salt...');

// Automatic decryption for admin viewing
const decryptedReports = await DataEncryption.decryptReportArray(reports);
// Result: All sensitive fields decrypted and ready for admin dashboard
```

### **User Status Checking**
```typescript
// Get single report with encrypted fields
const report = await ReportModel.findOne({ shortId })
  .select('+message_encrypted +message_iv +message_salt...');

// Automatic decryption for status response
const decryptedReport = await DataEncryption.decryptReportDocument(report);
// Result: Decrypted report data for user status checking
```

## ✅ **Verification Checklist**

### **Encryption Verification**
- ✅ All sensitive fields encrypted before MongoDB insertion
- ✅ Pre-save hooks trigger on `create()` and `save()` operations
- ✅ `is_encrypted: true` automatically set after encryption
- ✅ Original sensitive fields cleared after encryption
- ✅ Encrypted fields use `select: false` for security

### **Decryption Verification**  
- ✅ Admin dashboard automatically decrypts reports
- ✅ Status checking automatically decrypts individual reports
- ✅ Error handling for decryption failures
- ✅ Encrypted fields excluded from API responses
- ✅ Reporter email included in admin view only

### **Security Verification**
- ✅ AES-256-CBC encryption with proper key derivation
- ✅ Unique salt and IV per field per record
- ✅ Encrypted fields hidden by default (`select: false`)
- ✅ Environment variable encryption key protection
- ✅ Graceful failure handling for encryption/decryption errors

## 🚀 **Production Ready Features**

### **Performance Optimization**
- Efficient field-level encryption (only modified fields)
- Batch decryption for multiple reports
- Lazy loading of encrypted fields when needed

### **Error Handling**
- Graceful encryption failure (non-blocking saves)
- Decryption error recovery with fallback messages
- Comprehensive logging for debugging

### **Backward Compatibility**
- Support for existing unencrypted reports
- Migration path for legacy encrypted_message fields
- API compatibility maintained

## 📝 **Usage Examples**

### **Creating Encrypted Reports**
```typescript
// Automatic encryption - no code changes needed
const report = new ReportModel({
  message: "Workplace harassment incident",
  location: { lat: 40.7128, lng: -74.0060, address: "NYC Office" },
  reporterEmail: "employee@company.com",
  type: "harassment",
  priority: "urgent"
});

await report.save(); // ← All sensitive fields automatically encrypted
```

### **Admin Dashboard Access**
```typescript
// Automatic decryption for admin viewing
export const getAdminReports = async (req, res) => {
  const reports = await ReportModel.find()
    .select('+message_encrypted +message_iv +message_salt...');
  
  const decryptedReports = await DataEncryption.decryptReportArray(reports);
  res.json({ reports: decryptedReports });
};
```

### **User Status Checking**
```typescript
// Automatic decryption for status responses
export const getReportStatus = async (req, res) => {
  const report = await ReportModel.findOne({ shortId: req.params.id })
    .select('+message_encrypted +message_iv +message_salt...');
  
  const decryptedReport = await DataEncryption.decryptReportDocument(report);
  res.json({ success: true, data: decryptedReport });
};
```

## 🎯 **Summary**

✅ **Complete MongoDB encryption implementation with:**
- Automatic pre-save encryption hooks
- Comprehensive field-level encryption for all sensitive data
- Seamless admin dashboard decryption
- Enhanced status checking with decryption
- Production-ready error handling and security
- Zero code changes required for existing report creation flows

The system now ensures that **every report saved to MongoDB is automatically encrypted** before insertion, with **seamless decryption** when fetching reports for admin dashboard viewing and user status checking.