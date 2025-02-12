/**
 * @fileoverview Enhanced REST controller for team management with HIPAA compliance,
 * real-time analytics, and comprehensive security features.
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import cache from 'express-cache-middleware'; // ^1.0.0
import { AuditLogger } from '@company/audit-logger'; // ^1.0.0
import { TeamService } from '../../../services/team/team.service';
import { ITeam } from '../../../interfaces/team.interface';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { HttpError, ErrorCodes } from '../middlewares/error.middleware';

/**
 * Enhanced controller for team management operations with security and performance optimizations
 */
export class TeamController {
  private readonly teamService: TeamService;
  private readonly auditLogger: AuditLogger;

  constructor(teamService: TeamService, auditLogger: AuditLogger) {
    this.teamService = teamService;
    this.auditLogger = auditLogger;
  }

  /**
   * Creates a new team with enhanced security validation
   */
  @authenticate
  @authorize(['admin', 'coach'])
  @validateRequest
  @rateLimit({ windowMs: 60000, max: 5 })
  async createTeam(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const teamData = req.body as ITeam;
      const securityContext = (req as any).securityContext;

      // Create team with security context
      const team = await this.teamService.createTeam(teamData);

      // Log audit event
      await this.auditLogger.log({
        action: 'CREATE_TEAM',
        userId: securityContext.userId,
        resourceId: team.id,
        details: { teamName: team.name }
      });

      res.status(StatusCodes.CREATED).json(team);

      // Log performance metrics
      console.info(`Team creation completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Team creation failed',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Retrieves team data with role-based access control
   */
  @authenticate
  @authorize(['admin', 'coach', 'medical'])
  @cache({ ttl: 300 })
  async getTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const securityContext = (req as any).securityContext;

      const team = await this.teamService.getTeamById(teamId);
      if (!team) {
        throw new HttpError(
          StatusCodes.NOT_FOUND,
          'Team not found',
          ErrorCodes.NOT_FOUND_ERROR
        );
      }

      res.status(StatusCodes.OK).json(team);
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Failed to retrieve team',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Updates team settings with HIPAA compliance
   */
  @authenticate
  @authorize(['admin', 'coach'])
  @validateRequest
  async updateTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const updateData = req.body as Partial<ITeam>;
      const securityContext = (req as any).securityContext;

      const updatedTeam = await this.teamService.updateTeam(teamId, updateData);
      if (!updatedTeam) {
        throw new HttpError(
          StatusCodes.NOT_FOUND,
          'Team not found',
          ErrorCodes.NOT_FOUND_ERROR
        );
      }

      // Log audit event
      await this.auditLogger.log({
        action: 'UPDATE_TEAM',
        userId: securityContext.userId,
        resourceId: teamId,
        details: { updates: Object.keys(updateData) }
      });

      res.status(StatusCodes.OK).json(updatedTeam);
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Team update failed',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Deletes team with cascade operations
   */
  @authenticate
  @authorize(['admin'])
  async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const securityContext = (req as any).securityContext;

      await this.teamService.deleteTeam(teamId);

      // Log audit event
      await this.auditLogger.log({
        action: 'DELETE_TEAM',
        userId: securityContext.userId,
        resourceId: teamId,
        details: { timestamp: new Date() }
      });

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Team deletion failed',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Adds athlete to team with security validation
   */
  @authenticate
  @authorize(['admin', 'coach'])
  @validateRequest
  async addAthlete(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, athleteId } = req.params;
      const securityContext = (req as any).securityContext;

      await this.teamService.addAthleteToTeam(teamId, athleteId);

      // Log audit event
      await this.auditLogger.log({
        action: 'ADD_ATHLETE_TO_TEAM',
        userId: securityContext.userId,
        resourceId: teamId,
        details: { athleteId }
      });

      res.status(StatusCodes.OK).send();
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Failed to add athlete to team',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Removes athlete from team with security validation
   */
  @authenticate
  @authorize(['admin', 'coach'])
  @validateRequest
  async removeAthlete(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, athleteId } = req.params;
      const securityContext = (req as any).securityContext;

      await this.teamService.removeAthleteFromTeam(teamId, athleteId);

      // Log audit event
      await this.auditLogger.log({
        action: 'REMOVE_ATHLETE_FROM_TEAM',
        userId: securityContext.userId,
        resourceId: teamId,
        details: { athleteId }
      });

      res.status(StatusCodes.OK).send();
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Failed to remove athlete from team',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }

  /**
   * Retrieves team statistics with caching
   */
  @authenticate
  @authorize(['admin', 'coach', 'medical'])
  @cache({ ttl: 60 })
  async getTeamStats(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { period } = req.query;

      const stats = await this.teamService.getTeamAnalytics(
        teamId,
        period as any,
        { includeRealTime: true }
      );

      res.status(StatusCodes.OK).json(stats);
    } catch (error) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        'Failed to retrieve team statistics',
        ErrorCodes.DATA_ERROR,
        error
      );
    }
  }
}