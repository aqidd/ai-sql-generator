import Knex from 'knex';
import { Knex as KnexType } from 'knex';
import { log } from 'console';
import { DatabaseConfig, ColumnInfo, TableSchema } from '../types/database';

export class DatabaseService {
  private knex: KnexType;

  constructor(config: DatabaseConfig) {
    this.knex = Knex(this.getKnexConfig(config));
  }

  private getKnexConfig(config: DatabaseConfig): KnexType.Config {
    if (config.type === 'connection-string') {
      return {
        client: config.dbType,
        connection: config.url,
      };
    }

    return {
      client: config.dbType,
      connection: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
      },
    };
  }

  public async getTables(): Promise<string[]> {
    try {
      if (this.knex.client.config.client === 'mssql') {
        const result = await this.knex.raw(`
          SELECT 
            SCHEMA_NAME(schema_id) + '.' + name as TableName
          FROM sys.tables
          ORDER BY schema_id, name
        `);
        return result.map((row: { TableName: string }) => row.TableName);
      } else {
        const result = await this.knex.raw(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = ?`, 
          [this.knex.client.database()]
        );
        return result[0].map((row: { TABLE_NAME: string }) => row.TABLE_NAME);
      }
    } catch (error) {
      return [];
    }
  }

  public async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    try {
      if (this.knex.client.config.client === 'mssql') {
        const [schema, table] = tableName.split('.');
        const result = await this.knex.raw(`
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
          WHERE c.object_id = OBJECT_ID(?, 'U')
          ORDER BY c.column_id`,
          [`${schema}.${table}`]
        );
        return result;
      } else {
        const result = await this.knex.raw(`
          SELECT 
            COLUMN_NAME as name,
            COLUMN_TYPE as type,
            IS_NULLABLE as nullable,
            COLUMN_KEY as \`key\`,
            COLUMN_DEFAULT as \`default\`,
            EXTRA as extra
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [this.knex.client.database(), tableName]
        );
        return result[0];
      }
    } catch (error) {
      console.error(`Error getting columns for ${tableName}:`, error);
      return [];
    }
  }

  public async getSampleData(tableName: string): Promise<Record<string, any> | undefined> {
    try {
      if (this.knex.client.config.client === 'mssql') {
        const [schema, table] = tableName.split('.');
        const result = await this.knex.raw(`SELECT TOP 1 * FROM [${schema}].[${table}]`);
        return result.length > 0 ? result[0] : undefined;
      } else {
        const result = await this.knex.raw(`SELECT * FROM ?? LIMIT 1`, [tableName]);
        const sampleRows = result[0];
        return sampleRows.length > 0 ? sampleRows[0] : undefined;
      }
    } catch (error) {
      console.error(`Error fetching sample data from ${tableName}:`, error);
      return undefined;
    }
  }

  public async executeQuery(query: string): Promise<any> {
    try {
      const result = await this.knex.raw(query);
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${(error as Error).message}`);
    }
  }

  public async buildSchema(tables: string[]): Promise<TableSchema[]> {
    const schema: TableSchema[] = [];
    for (const table of tables) {
      const columns = await this.getTableColumns(table);
      const sampleData = await this.getSampleData(table);
      schema.push({
        tableName: table,
        columns,
        sampleData,
      });
    }
    return schema;
  }

  public async processSchemaRequest(): Promise<TableSchema[]> {
    const tables = await this.getTables();
    return await this.buildSchema(tables);
  }

  public async destroy(): Promise<void> {
    await this.knex.destroy();
  }
}