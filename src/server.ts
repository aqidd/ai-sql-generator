/* eslint-disable max-lines */
/**
 * Changes made:
 * 2025-03-16: Initial setup with MySQL connection and schema retrieval
 * 2025-03-16: Added Gemini integration and error handling
 * 2025-03-16: Added proper Gemini service initialization
 * 2025-03-28: Added sample data retrieval for each table
 */

import express from 'express';

// Extend the Request interface to include the 'file' property
import multer from 'multer';
type MulterFile = Express.Multer.File;

declare module 'express-serve-static-core' {
  interface Request {
    file?: MulterFile;
  }
}
import { createPool, RowDataPacket } from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';
import { GeminiService } from './services/gemini.service';
import winston from 'winston';
import { log } from 'console';
import { extractTextFromFile } from './utils/document-processor'; // Utility for text extraction
import fs from 'fs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required in .env file');
}
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

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
  sampleData?: Record<string, any>;
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
      details: err.message,
    });
  }
  if (err.name === 'PayloadTooLargeError') {
    return res.status(413).json({
      error: 'Request payload too large',
      details: 'The request exceeds the maximum allowed size',
    });
  }
  next(err);
});

// Endpoint to get database schema
import { Pool, PoolOptions } from 'mysql2/promise';

const createBasePoolConfig = (): PoolOptions => ({
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
});

const createConnectionStringPool = (url: string): Pool => {
  return createPool(url);
};

const createStandardPool = (config: StandardConfig, baseConfig: PoolOptions): Pool => {
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

const createDatabasePool = (config: DatabaseConfig): Pool => {
  const baseConfig = createBasePoolConfig();

  if (config.type === 'connection-string') {
    return createConnectionStringPool(config.url);
  }

  return createStandardPool(config, baseConfig);
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

const getTableColumns = async (
  pool: Pool,
  dbName: string,
  tableName: string
): Promise<ColumnInfo[]> => {
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

const getSampleData = async (
  pool: Pool,
  tableName: string
): Promise<Record<string, any> | undefined> => {
  try {
    const [rows] = await pool.query(`SELECT * FROM ${tableName} LIMIT 1`);
    const sampleRows = rows as RowDataPacket[];
    return sampleRows.length > 0 ? sampleRows[0] : undefined;
  } catch (error) {
    console.error(`Error fetching sample data from ${tableName}:`, error);
    return undefined;
  }
};

const buildSchema = async (
  pool: Pool,
  dbName: string,
  tables: string[]
): Promise<TableSchema[]> => {
  const schema: TableSchema[] = [];
  for (const tableName of tables) {
    const columns = await getTableColumns(pool, dbName, tableName);
    const sampleData = await getSampleData(pool, tableName);
    schema.push({ tableName, columns, sampleData });
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

const processSchemaRequest = async (config: DatabaseConfig): Promise<TableSchema[]> => {
  const pool = createDatabasePool(config);
  try {
    await testConnection(pool);
    const dbName = getDatabaseName(config);
    const tables = await getTables(pool, dbName);
    const schema = await buildSchema(pool, dbName, tables);
    return schema;
  } finally {
    await pool.end();
  }
};

const handleSchemaRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    let config = req.body as DatabaseConfig;

    // Use DB_TEST connection string if useDummyDB is true
    if (req.body.useDummyDB && process.env.DB_TEST) {
      config = {
        type: 'connection-string',
        url: process.env.DB_TEST,
      };
    }

    const schema = await processSchemaRequest(config);
    res.json({ schema });
  } catch (error) {
    handleDatabaseError(error as Error, res);
  }
};

app.post('/api/schema', handleSchemaRequest);

// Serve the main page
// Generate SQL query using Gemini
interface QueryRequest {
  error: string | undefined;
  schema: TableSchema[];
  question: string;
  referenceText?: string;
  chartType?: string | undefined;
}

const validateQueryRequest = (req: QueryRequest): void => {
  if (!req.schema || !req.question) {
    throw new Error('Schema and question are required');
  }
  if (req.chartType && !['pie', 'line', 'bar'].includes(req.chartType)) {
    throw new Error('Chart type must be one of: pie, line, bar');
  }
};

const handleQueryGeneration = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const queryRequest = req.body as QueryRequest;
    validateQueryRequest(queryRequest);
    log('handle query generation', queryRequest.chartType)
    const queryResult = await geminiService.generateQuery(
      queryRequest.schema,
      queryRequest.question,
      queryRequest.error,
      queryRequest.referenceText || req.app.locals.referenceText,
      queryRequest.chartType
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
  schema?: TableSchema[];
  question?: string;
  referenceText?: string;
  chartType?: string | null;
}

const validateQuerySafety = (isUnsafe: boolean): void => {
  if (isUnsafe && process.env.ALLOW_UNSAFE_QUERIES !== 'true') {
    throw new Error(
      'Unsafe queries (UPDATE/DELETE) are not allowed. Update ALLOW_UNSAFE_QUERIES ' +
        'in .env to enable.'
    );
  }
};

const handleQueryExecution = async (req: express.Request, res: express.Response): Promise<void> => {
  let pool;
  try {
    let { config, query, isUnsafe, schema, question, referenceText } = req.body as ExecuteQueryRequest;

    // Use DB_TEST connection string if useDummyDB is true
    if (req.body.useDummyDB && process.env.DB_TEST) {
      config = {
        type: 'connection-string',
        url: process.env.DB_TEST,
      };
    }

    validateQuerySafety(isUnsafe);

    pool = await initializeDatabasePool(config);
    await executeQuery(pool, query, schema, question, res, referenceText, req.body.chartType);
  } catch (error: unknown) {
    handleExecutionError(error, res);
  } finally {
    if (pool) await pool.end();
  }
};

const executeQuery = async (
  pool: Pool,
  query: string,
  schema: TableSchema[] | undefined,
  question: string | undefined,
  res: express.Response,
  referenceText?: string,
  chartType?: string | undefined
): Promise<void> => {
  await executeQueryWithHandling(pool, query, schema, question, res, chartType);
};

const initializeDatabasePool = async (config: DatabaseConfig): Promise<Pool> => {
  const pool = createDatabasePool(config);
  await testConnection(pool);
  return pool;
};

const executeQueryWithHandling = async (
  pool: Pool,
  query: string,
  schema: TableSchema[] | undefined,
  question: string | undefined,
  res: express.Response,
  referenceText?: string,
  chartType?: string | undefined
): Promise<void> => {
  try {
    const results = await pool.query(query);
    res.json({ success: true, results: results[0] });
  } catch (queryError: unknown) {
    if (schema && question) {
      log('handle query regeneration', chartType)
      await handleQueryRegeneration(pool, queryError, schema, question, res, referenceText, chartType);
    } else {
      log('handle query error')
      handleQueryError(queryError, res);
    }
  }
};

const handleQueryRegeneration = async (
  pool: Pool,
  queryError: unknown,
  schema: TableSchema[],
  question: string,
  res: express.Response,
  referenceText?: string,
  chartType?: string | undefined
): Promise<void> => {
  const errorMessage = extractErrorMessage(queryError);
  try {
    log('handle query regeneration...', chartType)
    const regenerated = await regenerateQuery(schema, question, errorMessage, referenceText, chartType);
    await executeRegeneratedQuery(pool, regenerated, errorMessage, res);
  } catch (regenerateError: unknown) {
    handleRegenerationError(regenerateError, queryError, res);
  }
};

const extractErrorMessage = (queryError: unknown): string => {
  return queryError instanceof Error ? queryError.message : 'Unknown error';
};

const regenerateQuery = async (
  schema: TableSchema[],
  question: string,
  errorMessage: string,
  referenceText?: string,
  chartType?: string | undefined
): Promise<{ sql: string; explanation: string }> => {
  log('Regenerating query...', chartType);
  return geminiService.generateQuery(schema, question, errorMessage, referenceText, chartType);
};

const executeRegeneratedQuery = async (
  pool: Pool,
  regenerated: { sql: string; explanation: string },
  errorMessage: string,
  res: express.Response
): Promise<void> => {
  const results = await pool.query(regenerated.sql);
  res.json({
    success: true,
    results: results[0],
    regeneratedQuery: {
      sql: regenerated.sql,
      explanation: regenerated.explanation,
    },
    originalError: errorMessage,
  });
};

const handleRegenerationError = (
  regenerateError: unknown,
  queryError: unknown,
  res: express.Response
): void => {
  res.status(500).json({
    success: false,
    error: regenerateError instanceof Error ? regenerateError.message : 'Unknown error',
    originalError: queryError instanceof Error ? queryError.message : 'Unknown error',
  });
};

const handleQueryError = (queryError: unknown, res: express.Response): void => {
  const status =
    queryError instanceof Error && queryError.message.includes('Unsafe queries') ? 403 : 500;
  res.status(status).json({
    success: false,
    error: queryError instanceof Error ? queryError.message : 'Unknown error',
  });
};

const handleExecutionError = (error: unknown, res: express.Response): void => {
  const status = error instanceof Error && error.message.includes('Unsafe queries') ? 403 : 500;
  res.status(status).json({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
  });
};

// TODO: execute query should not auto-regenerate. It should return the error and let the client handle it.
// TODO: remove unnecessary parameters and auto-regenerate from handleQueryExecution
// TODO: handleQueryExecution should only receive query as param
app.post('/api/execute-query', handleQueryExecution);

const upload = multer({ dest: 'uploads/' });

// eslint-disable-next-line max-lines-per-function
app.post('/api/upload-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Rename file to keep the original extension
    const fileExtension = path.extname(req.file.originalname);
    const newFilePath = `${req.file.path}${fileExtension}`;
    fs.renameSync(req.file.path, newFilePath);

    const text = await extractTextFromFile(newFilePath);
    req.app.locals.referenceText = text;

    res.json({
      success: true,
      message: 'Document processed successfully',
      referenceText: text,
    });
  } catch (error) {
    logger.info(JSON.stringify(error));
    if (error instanceof Error) {
      res.status((error as any).status || 520).json({
        error: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Server error',
      });
    }
  }
});

app.get('/api/test-dummy-db', async (_req, res) => {
  try {
    const connectionString = process.env.DB_TEST;
    if (!connectionString) {
      return res.status(400).json({ error: 'DB_TEST environment variable is not set' });
    }

    const config: ConnectionStringConfig = {
      type: 'connection-string',
      url: connectionString,
    };

    const schema = await processSchemaRequest(config);
    res.json({ schema });
  } catch (error) {
    logger.info(JSON.stringify(error));
    handleDatabaseError(error as Error, res);
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
