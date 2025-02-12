/**
 * @fileoverview GraphQL resolver implementation for team-related operations
 * Implements secure team management, real-time analytics, and performance optimization
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { PubSub } from 'graphql-subscriptions';
import DataLoader from 'dataloader';
import { RateLimit } from 'graphql-rate-limit';
import { AuthorizationService } from '@auth/core';
import { EncryptionService } from '@security/encryption';
import { TeamService } from '../../../services/team/team.service';
import { ITeam } from '../../../interfaces/team.interface';
import { Logger } from '../../../utils/logger.util';
import { SYSTEM_TIMEOUTS } from '../../../constants/system.constants';

const TEAM_SUBSCRIPTION_EVENTS = {
  TEAM_UPDATED: 'TEAM_UPDATED',
  TEAM_STATS_UPDATED: 'TEAM_STATS_UPDATED',
  TEAM_MEMBER_ADDED: 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'TEAM_MEMBER_REMOVED'
} as const;

@injectable()
@RateLimit({
  window: '1m',
  max: 100,
  message: 'Too many team operations'
})
export class TeamResolver {
  private readonly logger: Logger;
  private readonly teamLoader: DataLoader<string, ITeam>;

  constructor(
    private readonly teamService: TeamService,
    private readonly pubSub: PubSub,
    private readonly authService: AuthorizationService,
    private readonly encryptionService: EncryptionService
  ) {
    this.logger = new Logger('TeamResolver', { performanceTracking: true });

    // Initialize DataLoader for batching team queries
    this.teamLoader = new DataLoader(async (ids: string[]) => {
      const teams = await this.teamService.getTeamsByIds(ids);
      return ids.map(id => teams.find(team => team.id === id));
    }, {
      maxBatchSize: 100,
      cache: true
    });
  }

  // Queries
  async team(parent: any, { id }: { id: string }, context: any): Promise<ITeam> {
    const startTime = Date.now();

    try {
      // Validate authorization
      await this.authService.validatePermission(context.user, 'team:read');

      // Get team using DataLoader
      const team = await this.teamLoader.load(id);
      if (!team) {
        throw new Error('Team not found');
      }

      // Decrypt sensitive fields
      const decryptedSettings = await this.encryptionService.decryptFields(
        team.settings,
        ['alertThresholds', 'encryptionKeys']
      );

      this.logger.info('Team query executed', {
        teamId: id,
        duration: Date.now() - startTime
      });

      return {
        ...team,
        settings: decryptedSettings
      };
    } catch (error) {
      this.logger.error('Team query failed', error as Error, {
        teamId: id,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async teamAnalytics(
    parent: any,
    { id, period }: { id: string; period: { start: Date; end: Date } },
    context: any
  ): Promise<ITeam['stats']> {
    const startTime = Date.now();

    try {
      // Validate authorization
      await this.authService.validatePermission(context.user, 'team:read:analytics');

      // Get team analytics with real-time data
      const analytics = await this.teamService.getTeamAnalytics(id, period, {
        includeRealTime: true
      });

      this.logger.info('Team analytics query executed', {
        teamId: id,
        duration: Date.now() - startTime
      });

      return analytics;
    } catch (error) {
      this.logger.error('Team analytics query failed', error as Error, {
        teamId: id,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Mutations
  async createTeam(
    parent: any,
    { input }: { input: Partial<ITeam> },
    context: any
  ): Promise<ITeam> {
    const startTime = Date.now();

    try {
      // Validate authorization
      await this.authService.validatePermission(context.user, 'team:create');

      // Encrypt sensitive fields
      const encryptedSettings = await this.encryptionService.encryptFields(
        input.settings,
        ['alertThresholds', 'encryptionKeys']
      );

      // Create team
      const team = await this.teamService.createTeam({
        ...input,
        settings: encryptedSettings
      });

      this.logger.info('Team created successfully', {
        teamId: team.id,
        duration: Date.now() - startTime
      });

      // Publish team creation event
      await this.pubSub.publish(TEAM_SUBSCRIPTION_EVENTS.TEAM_UPDATED, {
        teamUpdated: team
      });

      return team;
    } catch (error) {
      this.logger.error('Team creation failed', error as Error, {
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async updateTeam(
    parent: any,
    { id, input }: { id: string; input: Partial<ITeam> },
    context: any
  ): Promise<ITeam> {
    const startTime = Date.now();

    try {
      // Validate authorization
      await this.authService.validatePermission(context.user, 'team:update');

      // Encrypt sensitive fields if present
      if (input.settings) {
        input.settings = await this.encryptionService.encryptFields(
          input.settings,
          ['alertThresholds', 'encryptionKeys']
        );
      }

      // Update team
      const team = await this.teamService.updateTeam(id, input);

      this.logger.info('Team updated successfully', {
        teamId: id,
        duration: Date.now() - startTime
      });

      // Publish team update event
      await this.pubSub.publish(TEAM_SUBSCRIPTION_EVENTS.TEAM_UPDATED, {
        teamUpdated: team
      });

      return team;
    } catch (error) {
      this.logger.error('Team update failed', error as Error, {
        teamId: id,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async addAthleteToTeam(
    parent: any,
    { teamId, athleteId }: { teamId: string; athleteId: string },
    context: any
  ): Promise<ITeam> {
    const startTime = Date.now();

    try {
      // Validate authorization
      await this.authService.validatePermission(context.user, 'team:update:members');

      // Add athlete to team
      const team = await this.teamService.addAthleteToTeam(teamId, athleteId);

      this.logger.info('Athlete added to team', {
        teamId,
        athleteId,
        duration: Date.now() - startTime
      });

      // Publish member addition event
      await this.pubSub.publish(TEAM_SUBSCRIPTION_EVENTS.TEAM_MEMBER_ADDED, {
        teamMemberAdded: { teamId, athleteId }
      });

      return team;
    } catch (error) {
      this.logger.error('Adding athlete to team failed', error as Error, {
        teamId,
        athleteId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Subscriptions
  teamUpdated(teamId: string) {
    return {
      subscribe: () => this.pubSub.asyncIterator([
        TEAM_SUBSCRIPTION_EVENTS.TEAM_UPDATED,
        TEAM_SUBSCRIPTION_EVENTS.TEAM_STATS_UPDATED
      ]),
      resolve: (payload: any) => {
        return payload.teamUpdated;
      }
    };
  }

  teamMembershipChanged(teamId: string) {
    return {
      subscribe: () => this.pubSub.asyncIterator([
        TEAM_SUBSCRIPTION_EVENTS.TEAM_MEMBER_ADDED,
        TEAM_SUBSCRIPTION_EVENTS.TEAM_MEMBER_REMOVED
      ]),
      resolve: (payload: any) => {
        return payload;
      }
    };
  }
}