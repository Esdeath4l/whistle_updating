import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Enhanced Admin Interface for Whistle
 * Supports comprehensive admin authentication and role management
 */
export interface IAdmin extends Document {
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: {
    can_view_reports: boolean;
    can_resolve_reports: boolean;
    can_escalate_reports: boolean;
    can_manage_admins: boolean;
    can_export_data: boolean;
    can_configure_system: boolean;
  };
  last_login: Date;
  login_attempts: number;
  locked_until: Date;
  is_active: boolean;
  isLocked: boolean; // Add the missing property
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  hasPermission(permission: keyof IAdmin['permissions']): boolean;
}

/**
 * Admin Schema with enhanced security features
 */
const adminSchema = new Schema<IAdmin>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },

  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },

  role: {
    type: String,
    enum: {
      values: ['super_admin', 'admin', 'moderator'],
      message: 'Role must be super_admin, admin, or moderator'
    },
    default: 'moderator',
    required: true
  },

  permissions: {
    can_view_reports: {
      type: Boolean,
      default: true
    },
    can_resolve_reports: {
      type: Boolean,
      default: false
    },
    can_escalate_reports: {
      type: Boolean,
      default: false
    },
    can_manage_admins: {
      type: Boolean,
      default: false
    },
    can_export_data: {
      type: Boolean,
      default: false
    },
    can_configure_system: {
      type: Boolean,
      default: false
    }
  },

  last_login: {
    type: Date
  },

  login_attempts: {
    type: Number,
    default: 0
  },

  locked_until: {
    type: Date
  },

  is_active: {
    type: Boolean,
    default: true,
    required: true
  },

  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  }

}, {
  timestamps: true,
  collection: 'admins',
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.password;
      delete ret.login_attempts;
      delete ret.locked_until;
      return ret;
    }
  }
});

// Indexes for performance and security (avoid duplicates)
adminSchema.index({ role: 1 });
adminSchema.index({ is_active: 1 });
adminSchema.index({ last_login: -1 });

// Virtual for account lock status
adminSchema.virtual('isLocked').get(function() {
  return !!(this.locked_until && this.locked_until > new Date());
});

// Pre-save middleware to hash password
adminSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set role-based permissions
adminSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    switch (this.role) {
      case 'super_admin':
        this.permissions = {
          can_view_reports: true,
          can_resolve_reports: true,
          can_escalate_reports: true,
          can_manage_admins: true,
          can_export_data: true,
          can_configure_system: true
        };
        break;
      case 'admin':
        this.permissions = {
          can_view_reports: true,
          can_resolve_reports: true,
          can_escalate_reports: true,
          can_manage_admins: false,
          can_export_data: true,
          can_configure_system: false
        };
        break;
      case 'moderator':
        this.permissions = {
          can_view_reports: true,
          can_resolve_reports: false,
          can_escalate_reports: false,
          can_manage_admins: false,
          can_export_data: false,
          can_configure_system: false
        };
        break;
    }
  }
  next();
});

// Instance method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to increment login attempts
adminSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.locked_until && this.locked_until < Date.now()) {
    return this.updateOne({
      $unset: { locked_until: 1 },
      $set: { login_attempts: 1 }
    });
  }

  const updates: any = { $inc: { login_attempts: 1 } };
  
  // If we've reached max attempts, lock the account
  if (this.login_attempts + 1 >= 5) {
    updates.$set = { locked_until: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Instance method to reset login attempts
adminSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  return this.updateOne({
    $unset: { login_attempts: 1, locked_until: 1 },
    $set: { last_login: new Date() }
  });
};

// Instance method to check permissions
adminSchema.methods.hasPermission = function(permission: keyof IAdmin['permissions']): boolean {
  return this.is_active && this.permissions[permission] === true;
};

// Static method to find active admins
adminSchema.statics.findActive = function() {
  return this.find({ is_active: true }).select('+permissions');
};

// Static method to create initial super admin
adminSchema.statics.createSuperAdmin = async function(adminData: {
  email: string;
  password: string;
  name: string;
}) {
  const existingAdmin = await this.findOne({ role: 'super_admin' });
  if (existingAdmin) {
    throw new Error('Super admin already exists');
  }

  return this.create({
    ...adminData,
    role: 'super_admin',
    is_active: true
  });
};

export const AdminModel: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>("Admin", adminSchema);
export default AdminModel;