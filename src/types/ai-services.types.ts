export interface ChartConfig {
  type:
    | 'pie'
    | 'line'
    | 'bar'
    | 'doughnut'
    | 'polarArea'
    | 'radar'
    | 'scatter'
    | 'bubble'
    | 'mixed';
  labelColumn?: string;
  valueColumn?: string;
  categoryColumn?: string;
  seriesColumns?: string[];
  timeColumn?: string;
}

export interface QueryResult {
  sql: string;
  isUnsafe: boolean;
  explanation: string;
  chartConfig?: ChartConfig;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
  sampleData?: Record<string, any>;
}

export interface ColumnSchema {
  name: string;
  type: string;
  key?: string;
}

export interface AIServiceOptions {
  apiKey: string;
  modelName?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface IQueryGenerationService {
  generateQuery(
    schema: TableSchema[],
    question: string,
    errorMessage?: string,
    referenceText?: string,
    chartType?: string | undefined
  ): Promise<QueryResult>;
}
