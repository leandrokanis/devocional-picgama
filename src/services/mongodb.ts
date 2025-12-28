import { MongoClient, Db, Collection } from 'mongodb';
import { logger } from '../utils/logger.js';

export class MongoDBService {
  private static instance: MongoDBService;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI;
      const dbName = process.env.MONGODB_DB_NAME || 'devocional_bot';

      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is required');
      }

      logger.info('Connecting to MongoDB...');
      
      this.client = new MongoClient(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(dbName);
      this.isConnected = true;

      logger.info('✅ MongoDB connected successfully');

      // Handle connection events
      this.client.on('close', () => {
        logger.warn('MongoDB connection closed');
        this.isConnected = false;
      });

      this.client.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    }
  }

  public getCollection(collectionName: string): Collection {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db.collection(collectionName);
  }

  public getAuthCollection(): Collection {
    const collectionName = process.env.MONGODB_COLLECTION_NAME || 'whatsapp_auth';
    return this.getCollection(collectionName);
  }

  public isConnectionActive(): boolean {
    return this.isConnected && this.client !== null;
  }

  public async ensureConnection(): Promise<void> {
    if (!this.isConnectionActive()) {
      await this.connect();
    }
  }
}

export const mongoService = MongoDBService.getInstance();
