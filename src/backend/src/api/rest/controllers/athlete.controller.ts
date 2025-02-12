/**
 * @fileoverview REST API controller implementing comprehensive athlete management endpoints
 * with enhanced security, real-time performance monitoring, and biomechanical data handling.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.2
import { caching } from 'cache-manager'; // ^5.2.3
import { validate } from 'class-validator'; // ^0.14.0
import { AthleteRepository } from '../../../db/repositories/athlete.repository';
import { IAthlete } from '../../../interfaces/athlete.interface';
import { validateAthleteRequest } from '../middlewares/validation.middleware';
import { Logger } from '../../../utils/logger.util';
import { HttpError, ErrorCodes } from '../middlewares/error.middleware';
import { PERFORMANCE_THRESHOLDS, SYSTEM_TIMEOUTS } from '../../../constants/system.constants';
import now from 'performance-now'; // ^2.1.0

/**
 * Enhanced controller implementing secure REST endpoints for athlete management
 * with performance optimization and comprehensive data handling
 */
export class AthleteController {
    private repository: AthleteRepository;
    private logger: Logger;
    private cache: any;
    private readonly CACHE_TTL = 300; // 5 minutes

    constructor(repository: AthleteRepository) {
        this.repository = repository;
        this.logger = new Logger('AthleteController');
        this.initializeCache();
    }

    /**
     * Initializes caching system for performance optimization
     */
    private async initializeCache(): Promise<void> {
        this.cache = await caching('memory', {
            max: 1000,
            ttl: this.CACHE_TTL
        });
    }

    /**
     * Creates a new athlete profile with enhanced validation
     * @route POST /api/athletes
     */
    @validateAthleteRequest
    public async createAthlete(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const athleteData: IAthlete = req.body;
            const validationErrors = await validate(athleteData);

            if (validationErrors.length > 0) {
                throw new HttpError(
                    400,
                    'Invalid athlete data',
                    ErrorCodes.VALIDATION_ERROR,
                    validationErrors
                );
            }

            const athlete = await this.repository.create(athleteData);

            const processingTime = now() - startTime;
            this.logger.performance('create_athlete_latency', processingTime, {
                correlationId,
                athleteId: athlete.id
            });

            res.status(201).json(athlete);
        } catch (error) {
            this.logger.error('Failed to create athlete', error as Error, {
                correlationId,
                body: req.body
            });
            throw error;
        }
    }

    /**
     * Retrieves athlete data with caching support
     * @route GET /api/athletes/:id
     */
    public async getAthleteById(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const { id } = req.params;
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            // Check cache first
            const cachedAthlete = await this.cache.get(`athlete:${id}`);
            if (cachedAthlete) {
                res.json(cachedAthlete);
                return;
            }

            const athlete = await this.repository.findById(id);
            if (!athlete) {
                throw new HttpError(
                    404,
                    'Athlete not found',
                    ErrorCodes.NOT_FOUND_ERROR
                );
            }

            // Cache the result
            await this.cache.set(`athlete:${id}`, athlete);

            const processingTime = now() - startTime;
            this.logger.performance('get_athlete_latency', processingTime, {
                correlationId,
                athleteId: id
            });

            res.json(athlete);
        } catch (error) {
            this.logger.error('Failed to retrieve athlete', error as Error, {
                correlationId,
                athleteId: id
            });
            throw error;
        }
    }

    /**
     * Retrieves all athletes for a team with pagination
     * @route GET /api/teams/:teamId/athletes
     */
    public async getAthletesByTeam(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const { teamId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const cacheKey = `team:${teamId}:athletes:${page}:${limit}`;
            const cachedAthletes = await this.cache.get(cacheKey);

            if (cachedAthletes) {
                res.json(cachedAthletes);
                return;
            }

            const athletes = await this.repository.findByTeam(
                teamId,
                Number(page),
                Number(limit)
            );

            await this.cache.set(cacheKey, athletes);

            const processingTime = now() - startTime;
            this.logger.performance('get_team_athletes_latency', processingTime, {
                correlationId,
                teamId
            });

            res.json(athletes);
        } catch (error) {
            this.logger.error('Failed to retrieve team athletes', error as Error, {
                correlationId,
                teamId
            });
            throw error;
        }
    }

    /**
     * Updates athlete data with validation
     * @route PUT /api/athletes/:id
     */
    @validateAthleteRequest
    public async updateAthlete(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const { id } = req.params;
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const updateData: Partial<IAthlete> = req.body;
            const updatedAthlete = await this.repository.update(id, updateData);

            if (!updatedAthlete) {
                throw new HttpError(
                    404,
                    'Athlete not found',
                    ErrorCodes.NOT_FOUND_ERROR
                );
            }

            // Invalidate cache
            await this.cache.del(`athlete:${id}`);

            const processingTime = now() - startTime;
            this.logger.performance('update_athlete_latency', processingTime, {
                correlationId,
                athleteId: id
            });

            res.json(updatedAthlete);
        } catch (error) {
            this.logger.error('Failed to update athlete', error as Error, {
                correlationId,
                athleteId: id
            });
            throw error;
        }
    }

    /**
     * Updates athlete baseline data
     * @route PUT /api/athletes/:id/baseline
     */
    public async updateBaselineData(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const { id } = req.params;
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const baselineData = req.body;
            const updatedAthlete = await this.repository.updateBaselineData(id, baselineData);

            if (!updatedAthlete) {
                throw new HttpError(
                    404,
                    'Athlete not found',
                    ErrorCodes.NOT_FOUND_ERROR
                );
            }

            // Invalidate cache
            await this.cache.del(`athlete:${id}`);

            const processingTime = now() - startTime;
            this.logger.performance('update_baseline_latency', processingTime, {
                correlationId,
                athleteId: id
            });

            res.json(updatedAthlete);
        } catch (error) {
            this.logger.error('Failed to update baseline data', error as Error, {
                correlationId,
                athleteId: id
            });
            throw error;
        }
    }

    /**
     * Deletes an athlete profile
     * @route DELETE /api/athletes/:id
     */
    public async deleteAthlete(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const { id } = req.params;
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const deleted = await this.repository.delete(id);

            if (!deleted) {
                throw new HttpError(
                    404,
                    'Athlete not found',
                    ErrorCodes.NOT_FOUND_ERROR
                );
            }

            // Invalidate cache
            await this.cache.del(`athlete:${id}`);

            const processingTime = now() - startTime;
            this.logger.performance('delete_athlete_latency', processingTime, {
                correlationId,
                athleteId: id
            });

            res.status(204).send();
        } catch (error) {
            this.logger.error('Failed to delete athlete', error as Error, {
                correlationId,
                athleteId: id
            });
            throw error;
        }
    }

    /**
     * Batch updates multiple athletes
     * @route PUT /api/athletes/batch
     */
    @validateAthleteRequest
    public async batchUpdateAthletes(req: Request, res: Response): Promise<void> {
        const startTime = now();
        const correlationId = req.headers['x-correlation-id'] as string;

        try {
            const updates = req.body;
            const updatedAthletes = await this.repository.batchUpdate(updates);

            // Invalidate cache for all updated athletes
            await Promise.all(
                updatedAthletes.map(athlete => 
                    this.cache.del(`athlete:${athlete.id}`)
                )
            );

            const processingTime = now() - startTime;
            this.logger.performance('batch_update_latency', processingTime, {
                correlationId,
                count: updates.length
            });

            res.json(updatedAthletes);
        } catch (error) {
            this.logger.error('Failed to perform batch update', error as Error, {
                correlationId
            });
            throw error;
        }
    }
}

export default AthleteController;