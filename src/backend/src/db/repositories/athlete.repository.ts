/**
 * @fileoverview Repository class implementing secure and performant data access patterns 
 * for athlete management in the smart apparel system. Handles CRUD operations, biomechanical 
 * data queries, and team-based athlete management with enhanced security features.
 */

import { Types } from 'mongoose'; // ^7.5.0
import { Redis } from 'ioredis'; // ^5.3.2
import { CryptoService } from '@smartapparel/crypto'; // ^1.0.0
import { AthleteModel } from '../models/athlete.model';
import { IAthlete } from '../../interfaces/athlete.interface';
import { Logger } from '../../utils/logger.util';
import { SYSTEM_TIMEOUTS, DATA_RETENTION } from '../../constants/system.constants';

/**
 * Cache key patterns for athlete data
 */
const CACHE_KEYS = {
  ATHLETE: (id: string) => `athlete:${id}`,
  TEAM_ATHLETES: (teamId: string) => `team:${teamId}:athletes`,
  BASELINE: (id: string) => `athlete:${id}:baseline`
} as const;

/**
 * Repository class implementing secure and performant data access patterns for athlete management
 */
export class AthleteRepository {
  private logger: Logger;
  private model: typeof AthleteModel;
  private cryptoService: CryptoService;
  private cacheClient: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor(cryptoService: CryptoService, cacheClient: Redis) {
    this.logger = new Logger('AthleteRepository');
    this.model = AthleteModel;
    this.cryptoService = cryptoService;
    this.cacheClient = cacheClient;
  }

  /**
   * Creates a new athlete record with encryption and validation
   */
  async create(athleteData: IAthlete): Promise<IAthlete> {
    try {
      // Encrypt sensitive PII fields
      const encryptedData = await this.encryptSensitiveFields(athleteData);
      
      // Create athlete record with retry mechanism
      const athlete = new this.model(encryptedData);
      const savedAthlete = await athlete.save();

      // Cache the new athlete data
      await this.cacheAthlete(savedAthlete);

      // Log creation with audit trail
      this.logger.info('Athlete created successfully', {
        athleteId: savedAthlete.id,
        teamId: savedAthlete.team.id
      });

      // Return decrypted view
      return await this.decryptSensitiveFields(savedAthlete);
    } catch (error) {
      this.logger.error('Failed to create athlete', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves all athletes belonging to a team with optimized querying
   */
  async findByTeam(teamId: string): Promise<IAthlete[]> {
    try {
      // Check cache first
      const cachedAthletes = await this.cacheClient.get(CACHE_KEYS.TEAM_ATHLETES(teamId));
      if (cachedAthletes) {
        return JSON.parse(cachedAthletes);
      }

      // Query with index optimization
      const athletes = await this.model.findByTeam(
        teamId,
        'coach' // Default access level for team queries
      );

      // Decrypt sensitive fields for each athlete
      const decryptedAthletes = await Promise.all(
        athletes.map(athlete => this.decryptSensitiveFields(athlete))
      );

      // Cache results
      await this.cacheClient.setex(
        CACHE_KEYS.TEAM_ATHLETES(teamId),
        this.CACHE_TTL,
        JSON.stringify(decryptedAthletes)
      );

      return decryptedAthletes;
    } catch (error) {
      this.logger.error('Failed to fetch team athletes', error as Error, { teamId });
      throw error;
    }
  }

  /**
   * Retrieves athlete data with baseline measurements and caching
   */
  async findWithBaseline(athleteId: string, accessLevel: string): Promise<IAthlete | null> {
    try {
      // Check cache for baseline data
      const cachedBaseline = await this.cacheClient.get(CACHE_KEYS.BASELINE(athleteId));
      if (cachedBaseline) {
        return JSON.parse(cachedBaseline);
      }

      const athlete = await this.model.findWithBaseline(athleteId, accessLevel);
      if (!athlete) return null;

      // Decrypt and cache baseline data
      const decryptedAthlete = await this.decryptSensitiveFields(athlete);
      await this.cacheClient.setex(
        CACHE_KEYS.BASELINE(athleteId),
        this.CACHE_TTL,
        JSON.stringify(decryptedAthlete)
      );

      return decryptedAthlete;
    } catch (error) {
      this.logger.error('Failed to fetch athlete baseline', error as Error, { athleteId });
      throw error;
    }
  }

  /**
   * Updates athlete data with encryption and cache invalidation
   */
  async update(athleteId: string, updateData: Partial<IAthlete>): Promise<IAthlete | null> {
    try {
      // Encrypt sensitive fields in update data
      const encryptedUpdate = await this.encryptSensitiveFields(updateData);

      const updatedAthlete = await this.model.findOneAndUpdate(
        { id: athleteId },
        { $set: encryptedUpdate },
        { new: true }
      );

      if (!updatedAthlete) return null;

      // Invalidate related caches
      await this.invalidateAthleteCache(updatedAthlete);

      // Return decrypted view
      return await this.decryptSensitiveFields(updatedAthlete);
    } catch (error) {
      this.logger.error('Failed to update athlete', error as Error, { athleteId });
      throw error;
    }
  }

  /**
   * Helper method to encrypt sensitive athlete fields
   */
  private async encryptSensitiveFields(data: Partial<IAthlete>): Promise<Partial<IAthlete>> {
    const encrypted = { ...data };
    if (data.name) {
      encrypted.name = await this.cryptoService.encrypt(data.name);
    }
    if (data.email) {
      encrypted.email = await this.cryptoService.encrypt(data.email);
    }
    return encrypted;
  }

  /**
   * Helper method to decrypt sensitive athlete fields
   */
  private async decryptSensitiveFields(athlete: IAthlete): Promise<IAthlete> {
    const decrypted = { ...athlete };
    decrypted.name = await this.cryptoService.decrypt(athlete.name);
    decrypted.email = await this.cryptoService.decrypt(athlete.email);
    return decrypted;
  }

  /**
   * Helper method to cache athlete data
   */
  private async cacheAthlete(athlete: IAthlete): Promise<void> {
    await this.cacheClient.setex(
      CACHE_KEYS.ATHLETE(athlete.id),
      this.CACHE_TTL,
      JSON.stringify(athlete)
    );
  }

  /**
   * Helper method to invalidate athlete-related caches
   */
  private async invalidateAthleteCache(athlete: IAthlete): Promise<void> {
    await Promise.all([
      this.cacheClient.del(CACHE_KEYS.ATHLETE(athlete.id)),
      this.cacheClient.del(CACHE_KEYS.TEAM_ATHLETES(athlete.team.id)),
      this.cacheClient.del(CACHE_KEYS.BASELINE(athlete.id))
    ]);
  }
}

export default AthleteRepository;