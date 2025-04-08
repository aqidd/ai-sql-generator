import { createPool, RowDataPacket, PoolOptions } from 'mysql2/promise';
import { ConnectionPool } from 'mssql';
import express from 'express';
import { log } from 'console';

// Database types
export type DatabaseType = 'mysql' | 'mssql';

// Interfaces
export type DatabaseConfig = StandardConfig | ConnectionStringConfig;

export interface ConnectionStringConfig {
  type: 'connection-string';
  dbType: DatabaseType;
  url: string;
}

export interface StandardConfig {
  type: 'standard';
  dbType: DatabaseType;
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

export interface QueryRequest {
  error: string | undefined;
  schema: TableSchema[];
  question: string;
  referenceText?: string;
  chartType?: string | undefined;
}

export interface ExecuteQueryRequest {
  config: DatabaseConfig;
  query: string;
  isUnsafe: boolean;
}

interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  sampleData?: Record<string, any>;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  key?: string;
  default?: string;
  extra?: string;
}

// Base pool configuration
const baseConfig: PoolOptions = {
  connectionLimit: 10,
  queueLimit: 0,
};

const createConnectionStringPool = (url: string, dbType: DatabaseType): any => {
  if (dbType === 'mysql') {
    return createPool(url);
  } else if (dbType === 'mssql') {
    return new ConnectionPool(url);
  } else {
    throw new Error('Unsupported database type');
  }
};

const createStandardPool = (config: StandardConfig, baseConfig: PoolOptions): any => {
  if (config.dbType === 'mysql') {
    const poolConfig = {
      ...baseConfig,
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    };
    return createPool(poolConfig);
  } else if (config.dbType === 'mssql') {
    const mssqlConfig = {
      user: config.user,
      password: config.password,
      server: config.host,
      port: config.port,
      database: config.database,
      options: {
        trustServerCertificate: true,
      },
    };
    return new ConnectionPool(mssqlConfig);
  } else {
    throw new Error('Unsupported database type');
  }
};

export const createDatabasePool = async (config: DatabaseConfig): Promise<any> => {
  if (!config) {
    throw new Error('Database configuration is required');
  }

  let pool: any;

  if (config.type === 'connection-string') {
    pool = createConnectionStringPool(config.url, config.dbType);
  } else {
    pool = createStandardPool(config, baseConfig);
  }

  // Connect to the pool
  if (pool instanceof ConnectionPool) {
    await pool.connect();
  }

  return pool;
};

export const testConnection = async (pool: any): Promise<void> => {
  try {
    if (pool instanceof ConnectionPool) {
      await pool.query('SELECT 1');
    } else {
      const connection = await pool.getConnection();
      await connection.query('SELECT 1');
      await connection.release();
    }
  } catch (error) {
    if (pool instanceof ConnectionPool) {
      await pool.close();
    } else {
      await pool.end();
    }
    throw new Error(`Failed to connect to database: ${(error as Error).message}`);
  }
};

export const executeQuery = async (pool: any, query: string): Promise<any> => {
  if (pool instanceof ConnectionPool) {
    const result = await pool.query(query);
    return result.recordset;
  } else {
    const [rows] = await pool.query(query);
    return rows;
  }
};

export const getTableColumns = async (
  pool: any,
  dbName: string,
  tableName: string
): Promise<ColumnInfo[]> => {
  try {
    if (pool instanceof ConnectionPool) {
      const result = await pool.query`
          SELECT 
            c.name as name,
            t.name as type,
            c.is_nullable as nullable,
            c.default_object_id as defaultConstraintId,
            c.max_length as maxLength,
            c.precision as precision,
            c.scale as scale
          FROM sys.columns c
          INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
          WHERE c.object_id = OBJECT_ID(${tableName}, 'U')
          ORDER BY c.column_id`;
      log('column result', result)
      return result.recordset as ColumnInfo[];
    } else {
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
    }
  } catch (error) {
    console.error(`Error getting columns for ${tableName}:`, error);
    return [];
  }
};

export const getTables = async (pool: any, dbName: string): Promise<string[]> => {
  try {
    if (pool instanceof ConnectionPool) {
      const result = await pool.query`
        SELECT 
          SCHEMA_NAME(schema_id) + '.' + name as TableName
        FROM sys.tables
        ORDER BY schema_id, name
      `;
      const resp = result.recordset.map((t: any) => t.TableName);
      log('table result', resp);
      return resp;
    } else {
      const [tables] = await pool.query<RowDataPacket[]>(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
        [dbName]
      );
      return tables.map((t: RowDataPacket) => t.TABLE_NAME);
    }
  } catch (error) {
    console.error(`Error getting tables:`, error);
    return [];
  }
};

export const getSampleData = async (
  pool: any,
  tableName: string
): Promise<Record<string, any> | undefined> => {
  try {
    if (pool instanceof ConnectionPool) {
      const [schema, table] = tableName.split('.');
      const result = await pool.query(`SELECT TOP 1 * FROM [${schema}].[${table}]`);
      const sampleRows = result.recordset;
      return sampleRows.length > 0 ? sampleRows[0] : undefined;
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${tableName} LIMIT 1`);
      const sampleRows = rows as RowDataPacket[];
      return sampleRows.length > 0 ? sampleRows[0] : undefined;
    }
  } catch (error) {
    console.error(`Error fetching sample data from ${tableName}:`, error);
    return undefined;
  }
};

const getDatabaseName = (config: DatabaseConfig): string => {
  return config.type === 'connection-string'
    ? new URL(config.url).pathname.slice(1)
    : config.database;
};

const buildSchema = async (
  pool: any,
  dbName: string,
  tables: string[]
): Promise<TableSchema[]> => {
  const schema: TableSchema[] = [];

  for (const table of tables) {
    log(dbName, table)
    const columns = await getTableColumns(pool, dbName, table);
    log('columns', columns);
    const sampleData = await getSampleData(pool, table);
    log('sampleData', sampleData);
    schema.push({ tableName: table, columns, sampleData });
  }

  return schema;
};

export const processSchemaRequest = async (config: DatabaseConfig): Promise<TableSchema[]> => {
  const pool = await createDatabasePool(config);
  try {
    await testConnection(pool);
    const dbName = getDatabaseName(config);
    const tables = await getTables(pool, dbName);
    const schema = await buildSchema(pool, dbName, tables);
    return schema;
  } finally {
    if (pool instanceof ConnectionPool) {
      await pool.close();
    } else {
      await pool.end();
    }
  }
};

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

export const initializeDatabasePool = async (config: DatabaseConfig): Promise<any> => {
  const pool = await createDatabasePool(config);
  await testConnection(pool);
  return pool;
};
