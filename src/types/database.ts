export type DatabaseType = 'mysql2' | 'mssql' | 'postgresql' | 'sqlite';

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

export type DatabaseConfig = StandardConfig | ConnectionStringConfig;

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  sampleData?: Record<string, any>;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  defaultConstraintId?: number;
  maxLength?: number;
  precision?: number;
  scale?: number;
  key?: string;
  default?: string;
  extra?: string;
}

export interface ExecuteQueryRequest {
  config: DatabaseConfig;
  query: string;
  isUnsafe: boolean;
}

export interface QueryRequest {
  error: string | undefined;
  schema: TableSchema[];
  question: string;
  referenceText?: string;
  chartType?: string | undefined;
}
