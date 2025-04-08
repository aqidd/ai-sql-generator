import express from 'express';
import { DatabaseConfig, QueryRequest} from '../types/database';

export const handleDatabaseError = (error: Error, res: express.Response): void => {
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

export const validateQueryRequest = (req: QueryRequest): void => {
  if (!req.schema || !req.question) {
    throw new Error('Schema and question are required');
  }
  if (req.chartType && !['any', 'pie', 'line', 'bar', 'doughnut', 'polarArea', 'radar', 'scatter', 'bubble', 'mixed'].includes(req.chartType)) {
    throw new Error(`Chart type ${req.chartType} is not supported`);
  }
};

export const validateQuerySafety = (isUnsafe: boolean): void => {
  if (isUnsafe && process.env.ALLOW_UNSAFE_QUERIES !== 'true') {
    throw new Error(
      'Unsafe queries (UPDATE/DELETE) are not allowed. Update ALLOW_UNSAFE_QUERIES ' +
        'in .env to enable.'
    );
  }
};

export const validateDatabaseConfig = (config: DatabaseConfig): void => {
  if (config.type === 'standard') {
    if (!config.host || !config.user || !config.password || !config.database) {
      throw new Error('Missing required DB Config fields: host, user, password, or database.');
    }
  } else if (config.type === 'connection-string') {
    if (!config.url) {
      throw new Error('Missing required database connection string.');
    }
  } else {
    throw new Error('Invalid database configuration type.');
  }
};
