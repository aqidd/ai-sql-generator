/**
 * Changes made:
 * 2025-03-16: Initial setup with MySQL connection and schema retrieval
 * 2025-03-16: Added Gemini integration and error handling
 * 2025-03-16: Added proper Gemini service initialization
 */

import express from 'express';
import { createPool, RowDataPacket } from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';
import { GeminiService } from './services/gemini.service';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required in .env file');
}
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Request size limits
const MAX_PAYLOAD_SIZE = '50mb';

// Database configuration types
type DatabaseConfig = StandardConfig | ConnectionStringConfig;

interface StandardConfig {
  type: 'standard';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

interface ConnectionStringConfig {
  type: 'connection-string';
  url: string;
}

// Schema information type
interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  key: string;
  default: string | null;
  extra: string;
}

// Security and middleware configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ 
      error: 'Invalid JSON payload',
      details: err.message
    });
  }
  if (err.name === 'PayloadTooLargeError') {
    return res.status(413).json({
      error: 'Request payload too large',
      details: 'The request exceeds the maximum allowed size'
    });
  }
  next(err);
});

// Endpoint to get database schema
import { Pool, PoolOptions } from 'mysql2/promise';

const createDatabasePool = (config: DatabaseConfig): Pool => {
  const baseConfig: PoolOptions = {
    connectTimeout: 10000,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
  };

  if (config.type === 'connection-string') {
    return createPool(config.url);
  }

  const poolConfig: PoolOptions = {
    ...baseConfig,
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: config.database,
  };

  return createPool(poolConfig);
};

const testConnection = async (pool: Pool): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    await connection.release();
  } catch (error) {
    await pool.end();
    throw new Error(`Failed to connect to database: ${(error as Error).message}`);
  }
};

const getDatabaseName = (config: DatabaseConfig): string => {
  return config.type === 'connection-string'
    ? new URL(config.url).pathname.slice(1)
    : config.database;
};

const getTableColumns = async (pool: Pool, dbName: string, tableName: string): Promise<ColumnInfo[]> => {
  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT 
      COLUMN_NAME as name,
      COLUMN_TYPE as type,
      IS_NULLABLE as nullable,
      COLUMN_KEY as \`key\`,
      COLUMN_DEFAULT as \`default\`,
      EXTRA as extra
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, tableName]
  );
  return columns as ColumnInfo[];
};

const getTables = async (pool: Pool, dbName: string): Promise<string[]> => {
  const [tables] = await pool.query<RowDataPacket[]>(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [dbName]
  );
  return tables.map((t: RowDataPacket) => t.TABLE_NAME);
};

const buildSchema = async (pool: Pool, dbName: string, tables: string[]): Promise<TableSchema[]> => {
  const schema: TableSchema[] = [];
  for (const tableName of tables) {
    const columns = await getTableColumns(pool, dbName, tableName);
    schema.push({ tableName, columns });
  }
  return schema;
};

const handleDatabaseError = (error: Error, res: express.Response): void => {
  const errorMessage = error.message;
  if (errorMessage.includes('ETIMEDOUT')) {
    res.status(504).json({
      error: 'Database connection timed out. Check accessibility and credentials.',
    });
  } else if (errorMessage.includes('ER_ACCESS_DENIED_ERROR')) {
    res.status(401).json({ error: 'Access denied. Check username and password.' });
  } else if (errorMessage.includes('ER_BAD_DB_ERROR')) {
    res.status(404).json({ error: 'Database not found. Check database name.' });
  } else {
    res.status(500).json({ error: errorMessage });
  }
};

interface DatabaseResponse {
  error?: string;
  schema?: TableSchema[];
}

const handleSchemaRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const config = req.body as DatabaseConfig;
    const pool = createDatabasePool(config);
    
    await testConnection(pool);
    const dbName = getDatabaseName(config);
    const tables = await getTables(pool, dbName);
    const schema = await buildSchema(pool, dbName, tables);
    
    await pool.end();
    res.json({ schema });
  } catch (error) {
    handleDatabaseError(error as Error, res);
  }
};

app.post('/api/schema', handleSchemaRequest);

// Serve the main page
// Generate SQL query using Gemini
interface QueryRequest {
  schema: TableSchema[];
  question: string;
}

const validateQueryRequest = (req: QueryRequest): void => {
  if (!req.schema || !req.question) {
    throw new Error('Schema and question are required');
  }
};

const handleQueryGeneration = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const queryRequest = req.body as QueryRequest;
    validateQueryRequest(queryRequest);
    
    const queryResult = await geminiService.generateQuery(
      queryRequest.schema,
      queryRequest.question
    );
    res.json(queryResult);
  } catch (error: unknown) {
    const status = error instanceof Error && error.message.includes('required') ? 400 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

app.post('/api/generate-query', handleQueryGeneration);

// Execute generated SQL query
interface ExecuteQueryRequest {
  config: DatabaseConfig;
  query: string;
  isUnsafe: boolean;
}

const validateQuerySafety = (isUnsafe: boolean): void => {
  if (isUnsafe && process.env.ALLOW_UNSAFE_QUERIES !== 'true') {
    throw new Error(
      'Unsafe queries (UPDATE/DELETE) are not allowed. Update ALLOW_UNSAFE_QUERIES in .env to enable.'
    );
  }
};

const executeQuery = async (pool: Pool, query: string): Promise<unknown> => {
  try {
    const [results] = await pool.query(query);
    return results;
  } finally {
    await pool.end();
  }
};

const handleQueryExecution = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { config, query, isUnsafe } = req.body as ExecuteQueryRequest;
    validateQuerySafety(isUnsafe);

    const pool = createDatabasePool(config);
    const results = await executeQuery(pool, query);
    res.json({ results });
  } catch (error: unknown) {
    const status = error instanceof Error && error.message.includes('Unsafe queries') ? 403 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

app.post('/api/execute-query', handleQueryExecution);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
