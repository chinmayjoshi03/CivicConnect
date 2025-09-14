import mongoose, { Document, Schema } from "mongoose";

export interface IReport extends Document {
  userId: mongoose.Types.ObjectId;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  images: string[];
  category: string;
  status: 'Submitted' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Closed';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    by: string;
    comment?: string;
  }>;
  comments: Array<{
    by: mongoose.Types.ObjectId;
    text: string;
    timestamp: Date;
  }>;
  severity?: 'Low' | 'Medium' | 'High';
  departmentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
    },
    images: [{
      type: String,
      required: true,
    }],
    category: {
      type: String,
      required: true,
      enum: [
        'Water & Supply Management',
        'Electricity',
        'Public Health & Safety',
        'Fire & Emergency Services',
        'Sanitation & Waste Management',
        'Roads & Infrastructure',
        'Public Transportation',
        'Parks & Environment',
        'General Issues'
      ],
    },
    status: {
      type: String,
      enum: ['Submitted', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'],
      default: 'Submitted',
    },
    statusHistory: [{
      status: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      by: {
        type: String,
        required: true,
      },
      comment: {
        type: String,
        trim: true,
      },
    }],
    comments: [{
      by: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      text: {
        type: String,
        required: true,
        trim: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reportSchema.index({ userId: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ category: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ 'location.lat': 1, 'location.lng': 1 });

export default mongoose.model<IReport>('Report', reportSchema);