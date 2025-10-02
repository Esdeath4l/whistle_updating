import mongoose, { Document, Schema, Model } from "mongoose";
import { nanoid } from "nanoid";
import { DataEncryption } from "../../server/utils/encryption";

/**
 * Enhanced Report Interface with Security and Classification
 * Supports encrypted reporting with multimedia and location data
 */
export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  shortId: string;
  
  // Core report content
  message: string;
  type: 'harassment' | 'emergency' | 'suggestion' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'resolved' | 'escalated' | 'reviewed' | 'flagged';
  
  // Legacy fields for backward compatibility
  category?: string;
  severity?: string;
  photo_url?: string;
  video_url?: string;
  video_metadata?: any;
  
  // Optional encrypted fields
  reporterEmail?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    address?: string;
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    timezone?: string;
    isp?: string;
    source?: 'ipgeolocation' | 'browser_gps' | 'manual';
    timestamp?: number;
  };
  
  // GridFS media references
  photo_file_id?: mongoose.Types.ObjectId;
  video_file_id?: mongoose.Types.ObjectId;
  additional_media?: mongoose.Types.ObjectId[]; // Multiple photos support
  
  // Encryption system
  is_encrypted: boolean;
  encrypted_data?: string;
  encrypted_message?: string; // For backward compatibility
  encryption_iv?: string;
  encryption_auth_tag?: string;
  encryption_salt?: string;
  
  // Encrypted field storage
  message_encrypted?: string;
  message_iv?: string;
  message_salt?: string;
  location_encrypted?: string;
  location_iv?: string;
  location_salt?: string;
  reporterEmail_encrypted?: string;
  reporterEmail_iv?: string;
  reporterEmail_salt?: string;
  admin_notes_encrypted?: string;
  admin_notes_iv?: string;
  admin_notes_salt?: string;
  
  // Admin tracking
  admin_notes?: string;
  admin_comment?: string; // For backward compatibility
  admin_response?: string; // For API compatibility
  admin_response_at?: Date; // For API compatibility
  escalated_at?: Date;
  resolved_at?: Date;
  created_at?: Date; // For backward compatibility
  updated_at?: Date; // For backward compatibility
  moderation_result?: any;
  moderation?: any; // For API compatibility
  is_offline_sync?: boolean;
  
  // Multi-admin escalation tracking
  viewedBy: string[]; // Array of admin usernames who have viewed this report
  resolvedBy?: string; // Username of admin who resolved the report
  lastEscalationSentAt?: Date; // Timestamp of last escalation email to prevent duplicates
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getDecryptedMessage(): string;
  getDecryptedLocation(): any;
  getDecryptedAdminNotes(): string;
  needsEscalation(): boolean;
  shouldSendEscalationEmail(): boolean;
  markViewedBy(adminUsername: string): Promise<IReport>;
  markResolvedBy(adminUsername: string): Promise<IReport>;
  ageInHours: number;
}

// Static methods interface
interface IReportModel extends Model<IReport> {
  findNeedingEscalation(): Promise<IReport[]>;
}

/**
 * Enhanced Report Schema with Security and Classification
 * Supports encrypted multimedia reporting with admin workflow
 */
const reportSchema: Schema<IReport> = new Schema({
  // Unique short identifier for user-friendly tracking
  shortId: {
    type: String,
    required: true,
    unique: true,
    default: () => nanoid(8).toUpperCase()
  },

  // Core required field - report description
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [1, 'Message cannot be empty'],
    maxlength: [5000, 'Message too long']
  },

  // Report classification - updated enum values
  type: {
    type: String,
    enum: ['harassment', 'emergency', 'suggestion', 'other'],
    required: [true, 'Report type is required'],
    default: 'other'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    required: [true, 'Priority is required'],
    default: 'medium'
  },

  // Admin workflow status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'escalated'],
    default: 'pending'
  },

  // Optional reporter contact (encrypted)
  reporterEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },

  // Enhanced location data with IPGeolocation support
  location: {
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    },
    accuracy: {
      type: Number,
      min: 0
    },
    address: {
      type: String,
      maxlength: 500
    },
    city: {
      type: String,
      maxlength: 100
    },
    region: {
      type: String,
      maxlength: 100
    },
    country: {
      type: String,
      maxlength: 100
    },
    countryCode: {
      type: String,
      maxlength: 3
    },
    timezone: {
      type: String,
      maxlength: 50
    },
    isp: {
      type: String,
      maxlength: 200
    },
    source: {
      type: String,
      enum: ['ipgeolocation', 'browser_gps', 'manual'],
      default: 'manual'
    },
    timestamp: {
      type: Number
    }
  },

  // GridFS file references for multimedia evidence
  photo_file_id: {
    type: Schema.Types.ObjectId,
    ref: 'fs.files'
  },
  
  video_file_id: {
    type: Schema.Types.ObjectId,
    ref: 'fs.files'
  },

  // Support for multiple photo proofs
  additional_media: [{
    type: Schema.Types.ObjectId,
    ref: 'fs.files'
  }],

  // Encryption system for sensitive data
  is_encrypted: {
    type: Boolean,
    default: true, // Default to encrypted for security
    required: true
  },
  
  encrypted_data: {
    type: String,
    select: false // Don't include by default for security
  },
  
  encryption_iv: {
    type: String,
    select: false
  },

  encryption_auth_tag: {
    type: String,
    select: false
  },

  encryption_salt: {
    type: String,
    select: false
  },

  // Encrypted fields storage
  message_encrypted: {
    type: String,
    select: false
  },
  
  message_iv: {
    type: String,
    select: false
  },

  message_salt: {
    type: String,
    select: false
  },

  location_encrypted: {
    type: String,
    select: false
  },
  
  location_iv: {
    type: String,
    select: false
  },

  location_salt: {
    type: String,
    select: false
  },

  reporterEmail_encrypted: {
    type: String,
    select: false
  },
  
  reporterEmail_iv: {
    type: String,
    select: false
  },

  reporterEmail_salt: {
    type: String,
    select: false
  },

  admin_notes_encrypted: {
    type: String,
    select: false
  },
  
  admin_notes_iv: {
    type: String,
    select: false
  },

  admin_notes_salt: {
    type: String,
    select: false
  },

  // Admin workflow fields
  admin_notes: {
    type: String,
    maxlength: 2000
  },

  escalated_at: {
    type: Date
  },

  resolved_at: {
    type: Date
  },

  // Multi-admin escalation tracking fields
  viewedBy: {
    type: [String], // Array of admin usernames who have viewed this report
    default: [],
    validate: {
      validator: function(arr: string[]) {
        return arr.every((username: string) => typeof username === 'string' && username.length > 0);
      },
      message: 'viewedBy must be an array of non-empty strings'
    }
  },

  resolvedBy: {
    type: String, // Username of admin who resolved the report
    default: null,
    validate: {
      validator: function(v: string) {
        return !v || (typeof v === 'string' && v.length > 0);
      },
      message: 'resolvedBy must be a non-empty string if provided'
    }
  },

  lastEscalationSentAt: {
    type: Date, // Timestamp of last escalation email to prevent duplicates
    default: null
  },

  // Admin response fields for API compatibility
  admin_response: {
    type: String
  },

  admin_response_at: {
    type: Date
  },

  // Additional tracking fields
  moderation_result: {
    type: Schema.Types.Mixed
  },

  moderation: {
    type: Schema.Types.Mixed
  },

  is_offline_sync: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'reports',
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.encrypted_data;
      delete ret.encryption_iv;
      delete ret.encryption_auth_tag;
      return ret;
    }
  }
});

// Indexes for performance and queries (avoid duplicates)
reportSchema.index({ type: 1, priority: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'location.lat': 1, 'location.lng': 1 });
reportSchema.index({ photo_file_id: 1 });
reportSchema.index({ video_file_id: 1 });

// Virtual for report age in hours
reportSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Instance method to check if report needs escalation
// Escalation Logic:
// 1. If status = pending and no viewedBy entries after 2-3 hours: send escalation email
// 2. If status != resolved and more than 5-6 hours since creation: send another escalation email
reportSchema.methods.needsEscalation = function(): boolean {
  const ageInHours = this.ageInHours;
  const hasBeenViewed = this.viewedBy && this.viewedBy.length > 0;
  const isResolved = this.status === 'resolved';
  
  // First escalation: pending status with no views after 2-3 hours
  const needsFirstEscalation = this.status === 'pending' && 
                              !hasBeenViewed && 
                              ageInHours >= 2;
  
  // Second escalation: not resolved after 5-6 hours
  const needsSecondEscalation = !isResolved && 
                               ageInHours >= 5;
  
  return needsFirstEscalation || needsSecondEscalation;
};

// Instance method to check if escalation email should be sent (prevents duplicates)
reportSchema.methods.shouldSendEscalationEmail = function(): boolean {
  if (!this.needsEscalation()) {
    return false;
  }
  
  // Don't send if escalation email was sent recently (within 1 hour)
  if (this.lastEscalationSentAt) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (this.lastEscalationSentAt > oneHourAgo) {
      return false;
    }
  }
  
  return true;
};

// Instance method to mark report as viewed by admin
reportSchema.methods.markViewedBy = function(adminUsername: string): Promise<IReport> {
  if (!this.viewedBy.includes(adminUsername)) {
    this.viewedBy.push(adminUsername);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to mark report as resolved by admin
reportSchema.methods.markResolvedBy = function(adminUsername: string): Promise<IReport> {
  this.status = 'resolved';
  this.resolvedBy = adminUsername;
  this.resolved_at = new Date();
  return this.save();
};

// Static method to find reports needing escalation
reportSchema.statics.findNeedingEscalation = function() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return this.find({
    $and: [
      // Main escalation conditions
      {
        $or: [
          // First escalation: pending reports with no views after 2+ hours
          {
            status: 'pending',
            viewedBy: { $size: 0 },
            createdAt: { $lt: twoHoursAgo }
          },
          // Second escalation: unresolved reports after 5+ hours
          {
            status: { $ne: 'resolved' },
            createdAt: { $lt: fiveHoursAgo }
          }
        ]
      },
      // Prevent duplicate escalations within 1 hour
      {
        $or: [
          { lastEscalationSentAt: { $exists: false } },
          { lastEscalationSentAt: { $lt: oneHourAgo } }
        ]
      }
    ]
  });
};

// Instance method to get decrypted message
reportSchema.methods.getDecryptedMessage = function(): string {
  if (this.is_encrypted && this.message_encrypted && this.message_iv) {
    try {
      return DataEncryption.decrypt({
        encrypted: this.message_encrypted,
        iv: this.message_iv,
        salt: this.message_salt
      });
    } catch (error) {
      console.error('❌ Message decryption failed:', error);
      return '[ENCRYPTED DATA - DECRYPTION FAILED]';
    }
  }
  return this.message || '[NO MESSAGE]';
};

// Instance method to get decrypted location
reportSchema.methods.getDecryptedLocation = function(): any {
  if (this.is_encrypted && this.location_encrypted && this.location_iv) {
    try {
      const decrypted = DataEncryption.decrypt({
        encrypted: this.location_encrypted,
        iv: this.location_iv,
        salt: this.location_salt
      });
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('❌ Location decryption failed:', error);
      return null;
    }
  }
  return this.location;
};

// Instance method to get decrypted admin notes
reportSchema.methods.getDecryptedAdminNotes = function(): string {
  if (this.admin_notes_encrypted && this.admin_notes_iv) {
    try {
      return DataEncryption.decrypt({
        encrypted: this.admin_notes_encrypted,
        iv: this.admin_notes_iv,
        salt: this.admin_notes_salt
      });
    } catch (error) {
      console.error('❌ Admin notes decryption failed:', error);
      return '[ENCRYPTED NOTES - DECRYPTION FAILED]';
    }
  }
  return this.admin_notes || '';
};

// =======================================
// ENCRYPTION MIDDLEWARE
// =======================================

/**
 * Enhanced Pre-save middleware for comprehensive encryption of sensitive fields
 * Encrypts: message, location, reporterEmail, admin_notes, priority, status
 * Ensures is_encrypted is always true for all new reports
 */
reportSchema.pre('save', async function(next) {
  try {
    console.log('🔐 Enhanced pre-save encryption middleware triggered');
    
    // Comprehensive list of sensitive fields to encrypt
    const sensitiveFields = ['message', 'location', 'reporterEmail', 'admin_notes', 'priority', 'status'];
    
    let hasEncryptedData = false;
    
    for (const field of sensitiveFields) {
      if (this.isModified(field) && this[field]) {
        console.log(`🔒 Encrypting field: ${field}`);
        
        try {
          let dataToEncrypt: string;
          
          // Handle object fields (like location) by stringifying
          if (typeof this[field] === 'object') {
            dataToEncrypt = JSON.stringify(this[field]);
          } else {
            dataToEncrypt = String(this[field]);
          }
          
          // Encrypt the data using enhanced encryption
          const encrypted = DataEncryption.encrypt(dataToEncrypt);
          
          // Store encrypted data in dedicated fields
          this[`${field}_encrypted`] = encrypted.encrypted;
          this[`${field}_iv`] = encrypted.iv;
          this[`${field}_salt`] = encrypted.salt;
          
          // Keep original field for compatibility but mark as encrypted
          hasEncryptedData = true;
          console.log(`✅ Field ${field} encrypted successfully`);
          
        } catch (error) {
          console.error(`❌ Failed to encrypt field ${field}:`, error);
          // Continue with next field rather than failing completely
        }
      }
    }
    
    // Always set encryption flag to true for new reports or when any data is encrypted
    if (this.isNew || hasEncryptedData) {
      this.is_encrypted = true;
      console.log('✅ Report marked as encrypted (is_encrypted = true)');
    }
    
    // Ensure all reports in MongoDB have is_encrypted = true
    if (this.is_encrypted === undefined || this.is_encrypted === null) {
      this.is_encrypted = true;
      console.log('🔧 Fixed missing is_encrypted flag, set to true');
    }
    
  } catch (error) {
    console.error('❌ Pre-save encryption failed:', error);
    // Don't block save operation, but log the error
  }
  
  next();
});

/**
 * Pre-save middleware for validation and cleanup (existing logic)
 */
reportSchema.pre('save', function(next) {
  // Trim message content if it exists and isn't encrypted
  if (this.message && !this.is_encrypted) {
    this.message = this.message.trim();
  }
  
  // Set escalated_at timestamp when status changes to escalated
  if (this.isModified('status') && this.status === 'escalated' && !this.escalated_at) {
    this.escalated_at = new Date();
  }
  
  // Set resolved_at timestamp when status changes to resolved
  if (this.isModified('status') && this.status === 'resolved' && !this.resolved_at) {
    this.resolved_at = new Date();
  }
  
  next();
});

/**
 * Post-find middleware for automatic decryption when fetching reports
 * Only decrypts when specifically requested (via .select() or when needed)
 */
reportSchema.post(['find', 'findOne', 'findOneAndUpdate'], async function(docs) {
  if (!docs) return;
  
  // Handle both single document and array of documents
  const documents = Array.isArray(docs) ? docs : [docs];
  
  for (const doc of documents) {
    if (doc && doc.is_encrypted) {
      console.log(`🔓 Post-find decryption for report: ${doc.shortId}`);
      
      // Decrypt message if encrypted fields exist
      if (doc.message_encrypted && doc.message_iv && !doc.message) {
        try {
          doc.message = DataEncryption.decrypt({
            encrypted: doc.message_encrypted,
            iv: doc.message_iv,
            salt: doc.message_salt
          });
          console.log('✅ Message decrypted successfully');
        } catch (error) {
          console.error('❌ Message decryption failed:', error);
          doc.message = '[ENCRYPTED - DECRYPTION FAILED]';
        }
      }
      
      // Decrypt location if encrypted fields exist
      if (doc.location_encrypted && doc.location_iv && !doc.location) {
        try {
          const decryptedLocation = DataEncryption.decrypt({
            encrypted: doc.location_encrypted,
            iv: doc.location_iv,
            salt: doc.location_salt
          });
          doc.location = JSON.parse(decryptedLocation);
          console.log('✅ Location decrypted successfully');
        } catch (error) {
          console.error('❌ Location decryption failed:', error);
          doc.location = null;
        }
      }
      
      // Decrypt reporter email if encrypted fields exist
      if (doc.reporterEmail_encrypted && doc.reporterEmail_iv && !doc.reporterEmail) {
        try {
          doc.reporterEmail = DataEncryption.decrypt({
            encrypted: doc.reporterEmail_encrypted,
            iv: doc.reporterEmail_iv,
            salt: doc.reporterEmail_salt
          });
          console.log('✅ Reporter email decrypted successfully');
        } catch (error) {
          console.error('❌ Reporter email decryption failed:', error);
          doc.reporterEmail = null;
        }
      }
      
      // Decrypt admin notes if encrypted fields exist
      if (doc.admin_notes_encrypted && doc.admin_notes_iv && !doc.admin_notes) {
        try {
          doc.admin_notes = DataEncryption.decrypt({
            encrypted: doc.admin_notes_encrypted,
            iv: doc.admin_notes_iv,
            salt: doc.admin_notes_salt
          });
          console.log('✅ Admin notes decrypted successfully');
        } catch (error) {
          console.error('❌ Admin notes decryption failed:', error);
          doc.admin_notes = '[ENCRYPTED - DECRYPTION FAILED]';
        }
      }
    }
  }
});

// =======================================
// END ENCRYPTION MIDDLEWARE
// =======================================

// Static methods
reportSchema.statics.findNeedingEscalation = function() {
  return this.find({
    status: 'pending',
    priority: { $in: ['high', 'urgent'] },
    createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
  });
};

export const ReportModel: IReportModel = (mongoose.models.Report || mongoose.model<IReport>("Report", reportSchema)) as IReportModel;
export default ReportModel;