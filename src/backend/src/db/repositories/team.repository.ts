/**
 * @fileoverview Repository class implementing secure data access patterns for team management
 * Implements comprehensive security measures, audit logging, and performance monitoring
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import mongoose from 'mongoose';
import { UUID } from 'crypto';
import { ITeam } from '../../interfaces/team.interface';
import { TeamModel } from '../models/team.model';
import { Logger } from '../../utils/logger.util';
import { SecurityContext } from '@security/context';
import { DataClassification } from '../../utils/encryption.util';
import { encrypt, decrypt } from '../../utils/encryption.util';
import { SYSTEM_TIMEOUTS } from '../../constants/system.constants';

@injectable()
export class TeamRepository {
  private readonly model: typeof TeamModel;
  private readonly logger: Logger;
  private readonly securityContext: SecurityContext;
  private readonly connection: mongoose.Connection;

  constructor(
    connection: mongoose.Connection,
    securityContext: SecurityContext,
    logger: Logger
  ) {
    this.connection = connection;
    this.model = TeamModel;
    this.securityContext = securityContext;
    this.logger = logger.createLoggerInstance('TeamRepository', {
      performanceTracking: true
    });
  }

  /**
   * Creates a new team with secure data validation and encryption
   * @param teamData - Team data to be created
   * @param context - Security context for access control
   * @returns Created team with encrypted sensitive data
   */
  async createTeam(teamData: ITeam, context: SecurityContext): Promise<ITeam> {
    const startTime = Date.now();
    const session = await this.connection.startSession();

    try {
      // Validate security context and permissions
      await this.securityContext.validatePermission(context, 'team:create');

      session.startTransaction();

      // Check for duplicate team names
      const existingTeam = await this.model.findByNameSecure(teamData.name);
      if (existingTeam) {
        throw new Error('Team name already exists');
      }

      // Encrypt sensitive team settings
      const encryptedSettings = await encrypt(
        JSON.stringify(teamData.settings),
        await this.securityContext.getEncryptionKey(),
        DataClassification.PERFORMANCE,
        new Date().toISOString()
      );

      // Create team with encrypted data
      const team = new this.model({
        ...teamData,
        settings: encryptedSettings,
        accessControl: {
          ...teamData.accessControl,
          admins: [context.userId],
          auditLog: [{
            timestamp: new Date(),
            userId: context.userId,
            action: 'CREATE_TEAM',
            resource: 'team'
          }]
        }
      });

      await team.save({ session });
      await session.commitTransaction();

      this.logger.info('Team created successfully', {
        teamId: team.id,
        userId: context.userId,
        duration: Date.now() - startTime
      });

      return team;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Team creation failed', error as Error, {
        userId: context.userId,
        duration: Date.now() - startTime
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Securely retrieves team by ID with access control
   * @param id - Team ID
   * @param populateAthletes - Whether to populate athlete data
   * @param context - Security context for access control
   * @returns Team data with decrypted fields
   */
  async findTeamById(
    id: UUID,
    populateAthletes: boolean = false,
    context: SecurityContext
  ): Promise<ITeam | null> {
    const startTime = Date.now();

    try {
      // Validate security context and permissions
      await this.securityContext.validatePermission(context, 'team:read');

      // Build secure query with timeout
      const query = this.model.findById(id)
        .maxTimeMS(SYSTEM_TIMEOUTS.DATABASE_MS);

      if (populateAthletes) {
        query.populate('athleteIds');
      }

      const team = await query.exec();

      if (!team) {
        return null;
      }

      // Verify access permissions
      if (!await this.hasTeamAccess(team, context)) {
        throw new Error('Unauthorized access to team data');
      }

      // Decrypt sensitive data
      if (team.settings) {
        const decryptedSettings = await decrypt(
          team.settings,
          await this.securityContext.getEncryptionKey()
        );
        team.settings = JSON.parse(decryptedSettings.toString());
      }

      this.logger.info('Team retrieved successfully', {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });

      return team;
    } catch (error) {
      this.logger.error('Team retrieval failed', error as Error, {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Updates team data with security validation and audit logging
   * @param id - Team ID
   * @param updateData - Partial team data to update
   * @param context - Security context for access control
   * @returns Updated team data
   */
  async updateTeam(
    id: UUID,
    updateData: Partial<ITeam>,
    context: SecurityContext
  ): Promise<ITeam> {
    const startTime = Date.now();
    const session = await this.connection.startSession();

    try {
      // Validate security context and permissions
      await this.securityContext.validatePermission(context, 'team:update');

      session.startTransaction();

      const team = await this.model.findById(id).session(session);
      if (!team) {
        throw new Error('Team not found');
      }

      // Verify update permissions
      if (!await this.hasTeamAccess(team, context)) {
        throw new Error('Unauthorized to update team');
      }

      // Encrypt sensitive update fields
      if (updateData.settings) {
        updateData.settings = await encrypt(
          JSON.stringify(updateData.settings),
          await this.securityContext.getEncryptionKey(),
          DataClassification.PERFORMANCE,
          new Date().toISOString()
        );
      }

      // Update team with audit log
      const updatedTeam = await this.model.findByIdAndUpdate(
        id,
        {
          ...updateData,
          $push: {
            'accessControl.auditLog': {
              timestamp: new Date(),
              userId: context.userId,
              action: 'UPDATE_TEAM',
              resource: 'team'
            }
          }
        },
        { new: true, session }
      );

      await session.commitTransaction();

      this.logger.info('Team updated successfully', {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });

      return updatedTeam!;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Team update failed', error as Error, {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Securely deletes team with cascade operations
   * @param id - Team ID
   * @param context - Security context for access control
   */
  async deleteTeam(id: UUID, context: SecurityContext): Promise<void> {
    const startTime = Date.now();
    const session = await this.connection.startSession();

    try {
      // Validate security context and permissions
      await this.securityContext.validatePermission(context, 'team:delete');

      session.startTransaction();

      const team = await this.model.findById(id).session(session);
      if (!team) {
        throw new Error('Team not found');
      }

      // Verify deletion permissions
      if (!await this.hasTeamAccess(team, context)) {
        throw new Error('Unauthorized to delete team');
      }

      // Remove athlete associations
      await this.connection.model('Athlete').updateMany(
        { 'team.id': id },
        { $unset: { team: 1 } },
        { session }
      );

      // Delete team document
      await team.deleteOne({ session });

      await session.commitTransaction();

      this.logger.info('Team deleted successfully', {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Team deletion failed', error as Error, {
        teamId: id,
        userId: context.userId,
        duration: Date.now() - startTime
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates team statistics with real-time analytics
   * @param teamId - Team ID
   * @param stats - Updated team statistics
   * @param context - Security context for access control
   * @returns Updated team statistics
   */
  async updateTeamStats(
    teamId: UUID,
    stats: ITeam['stats'],
    context: SecurityContext
  ): Promise<ITeam['stats']> {
    const startTime = Date.now();

    try {
      // Validate security context and permissions
      await this.securityContext.validatePermission(context, 'team:update:stats');

      const team = await this.model.findById(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      // Update team statistics
      const updatedTeam = await this.model.findByIdAndUpdate(
        teamId,
        {
          stats,
          $push: {
            'accessControl.auditLog': {
              timestamp: new Date(),
              userId: context.userId,
              action: 'UPDATE_TEAM_STATS',
              resource: 'team:stats'
            }
          }
        },
        { new: true }
      );

      this.logger.info('Team stats updated successfully', {
        teamId,
        userId: context.userId,
        duration: Date.now() - startTime
      });

      return updatedTeam!.stats;
    } catch (error) {
      this.logger.error('Team stats update failed', error as Error, {
        teamId,
        userId: context.userId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Verifies if user has access to team data
   * @param team - Team to check access for
   * @param context - Security context for access control
   * @returns Boolean indicating access permission
   */
  private async hasTeamAccess(
    team: ITeam,
    context: SecurityContext
  ): Promise<boolean> {
    return (
      team.accessControl.admins.includes(context.userId) ||
      team.accessControl.coaches.includes(context.userId) ||
      await this.securityContext.hasRole(context, 'SYSTEM_ADMIN')
    );
  }
}