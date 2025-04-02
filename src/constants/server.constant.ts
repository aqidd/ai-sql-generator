import { createPool, RowDataPacket } from 'mysql2/promise';
import { Pool, PoolOptions } from 'mysql2/promise';

// Interfaces
export type DatabaseConfig = StandardConfig | ConnectionStringConfig;

export interface ConnectionStringConfig {
  type: 'connection-string';
  url: string;
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

interface StandardConfig {
  type: 'standard';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
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
  key: string;
  default: string | null;
  extra: string;
}

// Arrow functions
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

export const processSchemaRequest = async (config: DatabaseConfig): Promise<TableSchema[]> => {
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

export const validateQueryRequest = (req: QueryRequest): void => {
  if (!req.schema || !req.question) {
    throw new Error('Schema and question are required');
  }
  if (req.chartType && !['pie', 'line', 'bar'].includes(req.chartType)) {
    throw new Error('Chart type must be one of: pie, line, bar');
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

export const initializeDatabasePool = async (config: DatabaseConfig): Promise<Pool> => {
  const pool = createDatabasePool(config);
  await testConnection(pool);
  return pool;
};
