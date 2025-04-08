/* eslint-disable max-lines */
/**
 * Changes made:
 * 2025-03-16: Initial setup with MySQL connection and schema retrieval
 * 2025-03-16: Added Gemini integration and error handling
 * 2025-03-16: Added proper Gemini service initialization
 * 2025-03-28: Added sample data retrieval for each table
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';

import { DatabaseConfig, ExecuteQueryRequest, DatabaseType, ConnectionStringConfig, testConnection, QueryRequest } from './constants/server.constant';

import { ConnectionPool } from 'mssql';

// Extend the Request interface to include the 'file' property
type MulterFile = Express.Multer.File;

declare module 'express-serve-static-core' {
  interface Request {
    file?: MulterFile;
  }
}
import path from 'path';
import dotenv from 'dotenv';
import { GeminiService } from './services/gemini.service';
import { OpenAIService } from './services/openai.service';
import winston from 'winston';
import { extractTextFromFile } from './utils/document-processor'; // Utility for text extraction
import fs from 'fs';

import {
  handleDatabaseError,
  processSchemaRequest,
  validateQueryRequest,
  validateQuerySafety,
  validateDatabaseConfig,
  createDatabasePool,
} from './constants/server.constant';
import { log } from 'console';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
  throw new Error('Either GEMINI_API_KEY or OPENAI_API_KEY is required in .env file');
}
let aiService;
if (process.env.GEMINI_API_KEY) {
  aiService = new GeminiService({apiKey: process.env.GEMINI_API_KEY});
} else if (process.env.OPENAI_API_KEY) {
  aiService = new OpenAIService({apiKey: process.env.OPENAI_API_KEY});
} else {
  throw new Error('Either GEMINI_API_KEY or OPENAI_API_KEY is required in .env file');
}

// Security and middleware configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use(cors());

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

const handleSchemaRequest = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    let config = req.body as DatabaseConfig;
    config.dbType = process.env.DB_TYPE as DatabaseType || 'mysql';

    if (req.body.useDummyDB) {
      config = getDummyConfig();
    }

    const schema = await processSchemaRequest(config);
    res.json({ schema });
  } catch (error) {
    handleDatabaseError(error as Error, res);
  }
};

app.post('/api/schema', handleSchemaRequest);
  
const handleQueryGeneration = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  try {
    const queryRequest = req.body as QueryRequest;
    validateQueryRequest(queryRequest);

    // Validate chart type
    const validChartTypes = [
      'any',
      'pie',
      'line',
      'bar',
      'doughnut',
      'polarArea',
      'radar',
      'scatter',
      'bubble',
      'mixed',
    ];
    if (queryRequest.chartType && !validChartTypes.includes(queryRequest.chartType)) {
      throw new Error(`Invalid chart type: ${queryRequest.chartType}`);
    }

    const queryResult = await aiService.generateQuery(
      queryRequest.schema,
      queryRequest.question,
      queryRequest.error,
      queryRequest.referenceText || req.app.locals.referenceText,
      queryRequest.chartType
    );
    logger.info(`Generated result: ${JSON.stringify(queryResult)}`);
    res.json(queryResult);
  } catch (error: unknown) {
    const status = error instanceof Error && error.message.includes('required') ? 400 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

app.post('/api/generate-query', handleQueryGeneration);

const handleQueryExecution = async (req: express.Request, res: express.Response): Promise<void> => {
  let pool;
  try {
    // eslint-disable-next-line prefer-const
    let { config, query, isUnsafe } = req.body as ExecuteQueryRequest;

    if (req.body.useDummyDB) {
      config = getDummyConfig();
    }
    
    config.dbType = process.env.DB_TYPE as DatabaseType || 'mysql';
    validateDatabaseConfig(config);
    validateQuerySafety(isUnsafe);

    let pool: any; // Using any since we're handling both MySQL and MSSQL
    try {
      pool = await createDatabasePool(config);
      await testConnection(pool);
      const results = await executeQuery(pool, query);
      logger.info(`Query executed successfully: ${JSON.stringify(results)}`);
      res.json({ success: true, results: results });
    } catch (error: unknown) {
      logger.error(
        `Query execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      handleQueryError(error, res);
    } finally {
      if (pool) {
        if (pool instanceof ConnectionPool) {
          await pool.close();
        } else {
          await pool.end();
        }
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Query execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    handleQueryError(error, res);
  }
};

const executeQuery = async (pool: any, query: string): Promise<any[]> => {
  if (pool instanceof ConnectionPool) {
    const result = await pool.query(query);
    return result.recordset || [];
  } else {
    const [rows] = await pool.query(query);
    return rows || [];
  }
};

const handleQueryError = (queryError: unknown, res: express.Response): void => {
  res.status(500).json({
    success: false,
    error: queryError instanceof Error ? queryError.message : 'Unknown error',
  });
};

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
    const config: DatabaseConfig = getDummyConfig();

    const schema = await processSchemaRequest(config);
    res.json({ schema });
  } catch (error) {
    logger.info(JSON.stringify(error));
    handleDatabaseError(error as Error, res);
  }
});

const getDummyConfig = (): DatabaseConfig => {
  if (process.env.DB_CS) {
    return {
      type: 'connection-string',
      dbType: process.env.DB_TYPE as DatabaseType || 'mysql',
      url: process.env.DB_CS,
    };
  } else if (process.env.DB_PASSWORD) {
    return {
      type: 'standard',
      dbType: process.env.DB_TYPE as DatabaseType || 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    };
  } else {
    throw new Error('DB DUMMY environment variable is not set');
  }
};

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
