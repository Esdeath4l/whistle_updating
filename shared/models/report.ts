import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Enhanced Report Interface with Security and Classification
 */
export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  shortId: string;
  message: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  severity?: string;
  location?: {
    lat: number;
    lng: number;
  };
  photo_file_id?: mongoose.Types.ObjectId;
  video_file_id?: mongoose.Types.ObjectId;
  
  // Encryption fields for sensitive data protection
  encrypted_message?: string;
  encryption_iv?: string;
  encryption_auth_tag?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Enhanced Report Schema with Security and Classification
 */
const reportSchema: Schema<IReport> = new Schema({
  // Unique short identifier for user-friendly tracking
  shortId: {
    type: String,
    required: true,
    unique: true,
    default: () => Math.random().toString(36).substr(2, 8).toUpperCase()
  },

  // Core required field
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [1, 'Message cannot be empty'],
    maxlength: [5000, 'Message too long']
  },

  // Report classification fields
  category: {
    type: String,
    enum: ['general', 'harassment', 'safety', 'emergency', 'fraud', 'other'],
    default: 'general'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Optional location data
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
    }
  },

  // Optional file references (GridFS)
  photo_file_id: {
    type: Schema.Types.ObjectId,
    ref: 'fs.files'
  },
  
  video_file_id: {
    type: Schema.Types.ObjectId,
    ref: 'fs.files'
  },

  // Optional encryption fields for sensitive data protection
  encrypted_message: {
    type: String,
    select: false // Don't include by default for security
  },
  
  encryption_iv: {
    type: String,
    select: false // Don't include by default for security
  },

  encryption_auth_tag: {
    type: String,
    select: false // Don't include by default for security
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'reports'
});

// Indexes for performance
reportSchema.index({ createdAt: -1 }); // Sort by creation date
reportSchema.index({ 'location.lat': 1, 'location.lng': 1 }); // Geospatial queries
reportSchema.index({ photo_file_id: 1 }); // File lookups
reportSchema.index({ video_file_id: 1 }); // File lookups

// Instance method to get decrypted message
reportSchema.methods.getDecryptedMessage = function(): string {
  if (this.encrypted_message && this.encryption_iv) {
    try {
      // Simple decryption helper (you can implement proper crypto here)
      return this.encrypted_message; // Placeholder - implement actual decryption
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      return this.message; // Fallback to original
    }
  }
  return this.message;
};

// Pre-save middleware for encryption (if needed)
reportSchema.pre('save', function(next) {
  // You can add encryption logic here if needed
  // For now, just ensure message is trimmed
  if (this.message) {
    this.message = this.message.trim();
  }
  next();
});

/**
 * Report Model
 */
const ReportModel: Model<IReport> = mongoose.models.Report || mongoose.model<IReport>("Report", reportSchema);
export default ReportModel;