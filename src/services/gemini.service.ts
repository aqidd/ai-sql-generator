/* eslint-disable max-lines-per-function */
/**
 * Changes made:
 * 2025-03-16: Created Gemini service for SQL query generation
 * 2025-03-16: Fixed method binding and model configuration
 * 2025-03-31: Added chart generation support for pie, line, and bar charts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from 'console';
import { 
  responseSchema, 
  getReferenceContext, 
  generatePromptTemplate,
} from '../constants/gemini.constant';

interface ChartConfig {
  type: 'pie' | 'line' | 'bar';
  labelColumn?: string;
  valueColumn?: string;
  categoryColumn?: string;
  seriesColumns?: string[];
  timeColumn?: string;
}

interface QueryResult {
  sql: string;
  isUnsafe: boolean;
  explanation: string;
  chartConfig?: ChartConfig;
}

interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
  sampleData?: Record<string, any>;
}

interface ColumnSchema {
  name: string;
  type: string;
  key?: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private readonly unsafePatterns = [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\b/i,
    /\bDELETE\b/i,
    /\bUPDATE\b/i,
  ];

  private readonly responseSchema = responseSchema;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    // Bind methods to preserve this context
    this.formatColumnInfo = this.formatColumnInfo.bind(this);
    this.formatTableSchema = this.formatTableSchema.bind(this);
    this.generatePrompt = this.generatePrompt.bind(this);
    this.generateQuery = this.generateQuery.bind(this);
  }

  private formatColumnInfo(col: ColumnSchema): string {
    const keyInfo = col.key === 'PRI' ? ' PRIMARY KEY' : '';
    return `${col.name} (${col.type})${keyInfo}`;
  }

  private formatTableSchema(table: TableSchema): string {
    const columns = table.columns.map(col => this.formatColumnInfo(col)).join(', ');

    let schemaInfo = `Table ${table.tableName}: ${columns}`;

    // Add sample data if available
    if (table.sampleData && Object.keys(table.sampleData).length > 0) {
      const sampleDataStr = Object.entries(table.sampleData)
        .map(([key, value]) => `${key}: ${value === null ? 'NULL' : JSON.stringify(value)}`)
        .join(', ');

      schemaInfo += `\nSample Data: { ${sampleDataStr} }`;
    }

    return schemaInfo;
  }

  private validateInputs(schema: TableSchema[], question: string): void {
    if (!schema?.length) {
      throw new Error('Database schema is required');
    }
    if (!question?.trim()) {
      throw new Error('Question is required');
    }
  }

  private generatePrompt(
    schema: TableSchema[],
    question: string,
    referenceText?: string,
    chartType?: string | undefined
  ): string {
    log('Generating prompt...', chartType);
    this.validateInputs(schema, question);
    const schemaInfo = schema.map(this.formatTableSchema).join('\n');
    const referenceContext = getReferenceContext(referenceText);

    return generatePromptTemplate(schemaInfo, question, referenceContext, chartType);
  }

  private async generateContent(prompt: string): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 1024,
      },
    });
    return result.response.text();
  }

  private cleanResponse(response: string): string {
    return response
      .trim()
      .replace(/^```(json)?\s*/, '')
      .replace(/\s*```$/, '')
      .replace(/\/\/.*/g, '')
      .trim();
  }

  private validateQueryResult(result: QueryResult): void {
    const { sql, isUnsafe, explanation, chartConfig } = result;
    const isValid =
      sql &&
      typeof sql === 'string' &&
      typeof isUnsafe === 'boolean' &&
      explanation &&
      typeof explanation === 'string';

    if (!isValid) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    // Validate chart config if present
    if (chartConfig) {
      const validChartTypes = ['pie', 'line', 'bar'];
      if (!validChartTypes.includes(chartConfig.type)) {
        throw new Error(`Invalid chart type: ${chartConfig.type}`);
      }
    }
  }

  private checkUnsafeOperations(sql: string): boolean {
    return this.unsafePatterns.some(pattern => pattern.test(sql));
  }

  private async parseAndValidateResponse(response: string): Promise<QueryResult> {
    const cleanedResponse = this.cleanResponse(response);
    const queryResult = JSON.parse(cleanedResponse) as QueryResult;
    this.validateQueryResult(queryResult);
    return queryResult;
  }

  private validateServiceState(): void {
    if (!this.genAI || !this.model) {
      throw new Error('Gemini service not properly initialized');
    }
  }

  public async generateQuery(
    schema: TableSchema[],
    question: string,
    errorMessage?: string,
    referenceText?: string,
    chartType?: string | undefined
  ): Promise<QueryResult> {
    log('Generating query...', chartType);
    this.validateServiceState();
    try {
      const schemaInfo = schema.map(this.formatTableSchema).join('\n');
      const prompt = generatePromptTemplate(schemaInfo, question, referenceText, 
        chartType, errorMessage);
      const response = await this.generateContent(prompt);
      const queryResult = await this.parseAndValidateResponse(response);
      queryResult.isUnsafe ||= this.checkUnsafeOperations(queryResult.sql);
      return queryResult;
    } catch (error) {
      throw new Error(`Failed to generate SQL query: ${(error as Error).message}`);
    }
  }

}
