/**
 * @fileoverview MongoDB model definition for athlete data in the smart apparel system
 * Implements comprehensive athlete profile management with enhanced security and 
 * biomechanical monitoring capabilities as specified in technical requirements.
 */

import { Schema, model, Document } from 'mongoose'; // ^7.5.0
import * as CryptoJS from 'crypto-js'; // ^4.1.1
import { IAthlete } from '../../interfaces/athlete.interface';
import { SENSOR_TYPES } from '../../constants/sensor.constants';

/**
 * Extended Document interface for Athlete with Mongoose specifics
 */
interface IAthleteDocument extends IAthlete, Document {}

/**
 * Mongoose schema definition for athlete data with enhanced security features
 */
const athleteSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    set: (value: string) => CryptoJS.AES.encrypt(value, process.env.ENCRYPTION_KEY!).toString()
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    set: (value: string) => CryptoJS.AES.encrypt(value, process.env.ENCRYPTION_KEY!).toString(),
    get: (value: string) => CryptoJS.AES.decrypt(value, process.env.ENCRYPTION_KEY!).toString(CryptoJS.enc.Utf8)
  },
  team: {
    id: {
      type: String,
      required: true,
      ref: 'Team',
      index: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['player', 'captain', 'practice']
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  baselineData: {
    muscleProfiles: {
      type: Map,
      of: new Schema({
        value: Number,
        timestamp: Date,
        confidence: Number
      }, { _id: false })
    },
    rangeOfMotion: {
      type: Map,
      of: new Schema({
        min: Number,
        max: Number,
        optimal: Number,
        lastMeasured: Date
      }, { _id: false })
    },
    forceDistribution: {
      type: Map,
      of: new Schema({
        distribution: Number,
        symmetry: Number,
        timestamp: Date
      }, { _id: false })
    },
    sensorCalibration: {
      type: Map,
      of: new Schema({
        calibration: Number,
        lastCalibrated: Date
      }, { _id: false }),
      validate: {
        validator: (value: Map<string, any>) => 
          Object.keys(value).every(key => Object.values(SENSOR_TYPES).includes(key as SENSOR_TYPES))
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  preferences: {
    alertThresholds: {
      type: Map,
      of: new Schema({
        value: Number,
        enabled: Boolean
      }, { _id: false })
    },
    notificationSettings: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      allowedHours: [{
        type: String
      }]
    },
    dataSharing: {
      medical: {
        enabled: {
          type: Boolean,
          default: true
        },
        authorizedProviders: [{
          type: String
        }],
        sharedMetrics: [{
          type: String
        }]
      },
      coach: {
        enabled: {
          type: Boolean,
          default: true
        },
        authorizedCoaches: [{
          type: String
        }],
        sharedMetrics: [{
          type: String
        }]
      },
      team: {
        enabled: {
          type: Boolean,
          default: false
        },
        sharedMetrics: [{
          type: String
        }]
      }
    }
  },
  sessions: [{
    type: String,
    ref: 'Session'
  }],
  privacySettings: {
    dataEncrypted: {
      type: Boolean,
      default: true
    },
    lastConsent: {
      type: Date,
      required: true
    },
    consentedPurposes: [{
      type: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    getters: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for performance optimization
athleteSchema.index({ 'team.id': 1, 'createdAt': -1 });
athleteSchema.index({ 'email': 1, 'team.id': 1 }, { unique: true });

// Pre-save middleware for data validation and processing
athleteSchema.pre('save', async function(next) {
  if (this.isModified('baselineData')) {
    this.baselineData.lastUpdated = new Date();
  }
  next();
});

// Static methods for secure data access
athleteSchema.statics.findByTeam = async function(
  teamId: string,
  accessLevel: string
): Promise<IAthleteDocument[]> {
  const query = { 'team.id': teamId };
  const projection = accessLevel === 'medical' ? 
    {} : 
    { 'baselineData.muscleProfiles': 0 };
  
  return this.find(query, projection)
    .select('-privacySettings')
    .sort({ createdAt: -1 });
};

athleteSchema.statics.findWithBaseline = async function(
  athleteId: string,
  accessLevel: string
): Promise<IAthleteDocument | null> {
  const athlete = await this.findOne({ id: athleteId });
  
  if (!athlete) return null;
  
  // Apply access control based on data sharing preferences
  if (!athlete.preferences.dataSharing[accessLevel]?.enabled) {
    athlete.baselineData = undefined;
  }
  
  return athlete;
};

// Create and export the Athlete model
const AthleteModel = model<IAthleteDocument>('Athlete', athleteSchema);

export default AthleteModel;