import * as SQLite from "expo-sqlite";

// Database configuration
const DATABASE_NAME = "omunotes.db";

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing = false;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this.initializeDatabase();

    try {
      this.db = await this.initPromise;
      return this.db;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
    try {
      console.log("Initializing database...");
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

      // Create notebooks table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS notebooks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          structure TEXT NOT NULL,
          wordCount INTEGER DEFAULT 0,
          totalImages INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          savedAt TEXT NOT NULL,
          isSaved INTEGER DEFAULT 1
        );
      `);

      // Create indexes for better performance
      await database.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_notebooks_savedAt ON notebooks(savedAt DESC);
        CREATE INDEX IF NOT EXISTS idx_notebooks_createdAt ON notebooks(createdAt DESC);
      `);

      console.log("Database initialized successfully");
      return database;
    } catch (error) {
      console.error("Error initializing database:", error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  public async closeDatabase(): Promise<void> {
    try {
      if (this.db) {
        await this.db.closeAsync();
        this.db = null;
        console.log("Database closed successfully");
      }
    } catch (error) {
      console.error("Error closing database:", error);
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Convenience function to get database
export const getDatabase = () => databaseManager.getDatabase();

// Initialize database when module is imported
export const initializeDatabase = () => databaseManager.getDatabase();
