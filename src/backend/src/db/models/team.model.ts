/**
 * @fileoverview Mongoose model definition for team data in the smart apparel system
 * Implements comprehensive team management, real-time analytics, and secure data handling
 * @version 1.0.0
 */

import mongoose, { Schema, Document } from 'mongoose';
import { ITeam } from '../../interfaces/team.interface';
import { SYSTEM_TIMEOUTS } from '../constants/system.constants';
import { encryptField } from '../../utils/encryption.util';
import { DataClassification } from '../../utils/encryption.util';
import { logger } from '../../utils/logger.util';

// Create logger instance for team model
const teamLogger = logger.createLoggerInstance('TeamModel', {
  performanceTracking: true
});

/**
 * Mongoose schema for team data with enhanced security and validation
 */
const TeamSchema = new Schema<ITeam & Document>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
      maxlength: [100, 'Team name cannot exceed 100 characters'],
      index: true
    },
    athleteIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Athlete',
      default: [],
      validate: {
        validator: async function(ids: mongoose.Types.ObjectId[]) {
          const uniqueIds = new Set(ids.map(id => id.toString()));
          return uniqueIds.size === ids.length;
        },
        message: 'Duplicate athlete IDs are not allowed'
      }
    },
    settings: {
      alertThresholds: {
        type: Map,
        of: Number,
        default: {},
        validate: {
          validator: function(thresholds: Map<string, number>) {
            return Array.from(thresholds.values()).every(val => val > 0);
          },
          message: 'Alert thresholds must be positive numbers'
        }
      },
      dataRetentionDays: {
        type: Number,
        default: 180,
        min: [30, 'Minimum data retention is 30 days'],
        max: [3650, 'Maximum data retention is 10 years']
      },
      securityPolicy: {
        accessControl: {
          type: String,
          enum: ['strict', 'standard', 'custom'],
          default: 'standard'
        },
        encryptionLevel: {
          type: String,
          enum: ['high', 'standard'],
          default: 'standard'
        }
      }
    },
    analytics: {
      realTime: {
        activeAthletes: {
          type: Number,
          default: 0,
          min: 0
        },
        activeSessions: {
          type: Number,
          default: 0,
          min: 0
        },
        currentLoad: {
          type: Number,
          default: 0,
          min: 0
        }
      },
      historical: {
        totalSessions: {
          type: Number,
          default: 0,
          min: 0
        },
        averageParticipation: {
          type: Number,
          default: 0,
          min: 0,
          max: 100
        }
      }
    },
    accessControl: {
      admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      coaches: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      medicalStaff: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      dataAccessPolicies: {
        type: Map,
        of: new Schema({
          role: String,
          permissions: [String],
          restrictions: [String]
        }),
        default: {}
      },
      auditLog: [{
        timestamp: { type: Date, default: Date.now },
        userId: Schema.Types.ObjectId,
        action: String,
        resource: String
      }]
    },
    integrations: {
      ehrSystem: {
        enabled: { type: Boolean, default: false },
        systemId: String,
        lastSync: Date,
        syncConfig: Schema.Types.Mixed
      },
      teamManagement: {
        enabled: { type: Boolean, default: false },
        systemId: String,
        lastSync: Date,
        syncConfig: Schema.Types.Mixed
      }
    }
  },
  {
    timestamps: true,
    collection: 'teams',
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance optimization
TeamSchema.index({ name: 1 }, { unique: true });
TeamSchema.index({ 'analytics.realTime.activeAthletes': -1 });
TeamSchema.index({ 'settings.securityPolicy.accessControl': 1 });
TeamSchema.index({ createdAt: 1 });

// Pre-save middleware for data validation and encryption
TeamSchema.pre('save', async function(next) {
  try {
    if (this.isModified('settings.alertThresholds')) {
      const encryptedThresholds = await encryptField(
        JSON.stringify(Object.fromEntries(this.settings.alertThresholds)),
        DataClassification.PERFORMANCE
      );
      this.settings.alertThresholds = new Map(Object.entries(JSON.parse(encryptedThresholds)));
    }

    teamLogger.info('Team pre-save validation completed', {
      teamId: this._id,
      event: 'pre_save'
    });

    next();
  } catch (error) {
    teamLogger.error('Team pre-save validation failed', error as Error, {
      teamId: this._id,
      event: 'pre_save_error'
    });
    next(error);
  }
});

// Post-save middleware for analytics updates
TeamSchema.post('save', async function() {
  try {
    await this.updateTeamAnalytics();
    teamLogger.info('Team analytics updated', {
      teamId: this._id,
      event: 'analytics_update'
    });
  } catch (error) {
    teamLogger.error('Team analytics update failed', error as Error, {
      teamId: this._id,
      event: 'analytics_update_error'
    });
  }
});

// Method to update team analytics
TeamSchema.methods.updateTeamAnalytics = async function(): Promise<void> {
  const startTime = Date.now();
  try {
    const activeAthletes = await mongoose.model('Session').countDocuments({
      teamId: this._id,
      endTime: null
    });

    const totalSessions = await mongoose.model('Session').countDocuments({
      teamId: this._id
    });

    this.analytics.realTime.activeAthletes = activeAthletes;
    this.analytics.historical.totalSessions = totalSessions;

    await this.save();

    teamLogger.performance('analytics_update_duration', Date.now() - startTime, {
      teamId: this._id
    });
  } catch (error) {
    teamLogger.error('Failed to update team analytics', error as Error, {
      teamId: this._id,
      duration: Date.now() - startTime
    });
    throw error;
  }
};

// Static method for secure team lookup
TeamSchema.statics.findByNameSecure = async function(
  name: string,
  projection: Record<string, any> = {}
): Promise<ITeam | null> {
  try {
    const team = await this.findOne({ name }, projection)
      .maxTimeMS(SYSTEM_TIMEOUTS.DATABASE_MS)
      .exec();

    teamLogger.info('Secure team lookup completed', {
      teamName: name,
      event: 'secure_lookup'
    });

    return team;
  } catch (error) {
    teamLogger.error('Secure team lookup failed', error as Error, {
      teamName: name,
      event: 'secure_lookup_error'
    });
    throw error;
  }
};

// Export the Team model
export const TeamModel = mongoose.model<ITeam & Document>('Team', TeamSchema);