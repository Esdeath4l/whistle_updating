import mongoose, { Document, Schema, Model } from "mongoose";
import { nanoid } from "nanoid";

export interface IAlert extends Document {
  reportId: mongoose.Types.ObjectId;
  shortId: string;
  alertType: "urgent" | "emergency";
  message: string;
  severity: string;
  category: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  created_at: Date;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  is_acknowledged: boolean;
  notification_sent: boolean;
  email_sent: boolean;
  sms_sent?: boolean;
}

const alertSchema: Schema<IAlert> = new Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  shortId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => nanoid(8).toUpperCase()
  },
  alertType: {
    type: String,
    required: true,
    enum: ["urgent", "emergency"]
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  acknowledged_at: {
    type: Date
  },
  acknowledged_by: {
    type: String
  },
  is_acknowledged: {
    type: Boolean,
    default: false,
    index: true
  },
  notification_sent: {
    type: Boolean,
    default: false
  },
  email_sent: {
    type: Boolean,
    default: false
  },
  sms_sent: {
    type: Boolean,
    default: false
  }
});

// Create compound indexes
alertSchema.index({ alertType: 1, is_acknowledged: 1 });
alertSchema.index({ created_at: -1, is_acknowledged: 1 });

// Instance methods
alertSchema.methods.acknowledge = function(adminUser: string) {
  this.is_acknowledged = true;
  this.acknowledged_at = new Date();
  this.acknowledged_by = adminUser;
  return this.save();
};

// Export model with dev mode protection
const AlertModel: Model<IAlert> = mongoose.models.Alert || mongoose.model<IAlert>("Alert", alertSchema);
export default AlertModel;