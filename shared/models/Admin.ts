import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Admin Role Enumeration for role-based access control
 */
export enum AdminRole {
  MODERATOR = "moderator",
  SUPERADMIN = "superadmin"
}

/**
 * Admin Interface for TypeScript type checking
 */
export interface IAdmin extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password: string;
  email: string;
  role: AdminRole;
  firstName?: string;
  lastName?: string;
  lastLogin?: Date;
  lastFailedLogin?: Date;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin Schema Definition
 */
const adminSchema: Schema<IAdmin> = new Schema({
  username: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  password: { 
    type: String, 
    required: true,
    select: false // Don't include password in queries by default
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  role: { 
    type: String,
    enum: Object.values(AdminRole),
    required: true,
    default: AdminRole.MODERATOR
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastLogin: {
    type: Date
  },
  lastFailedLogin: {
    type: Date
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'admins'
});

// Indexes for performance
// username and email indexes are automatically created by unique: true
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ createdAt: -1 });

// Instance method to update last login
adminSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Static method to find active admins
adminSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find by role
adminSchema.statics.findByRole = function(role: AdminRole) {
  return this.find({ role, isActive: true });
};

/**
 * Admin Model
 */
// Export model with dev mode protection
const AdminModel: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>("Admin", adminSchema);
export default AdminModel;