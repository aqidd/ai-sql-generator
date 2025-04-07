/* eslint-disable max-lines-per-function */
/**
 * OpenAI service for SQL query generation
 * 2025-04-01: Created OpenAI service with functionality matching GeminiService
 * 2025-04-07: Fixed Vercel AI SDK implementation
 */

import OpenAI from 'openai';
import {
  responseSchema,
  generatePromptTemplate,
} from '../constants/prompt.constant';
import { log } from 'node:console';
import {
  AIServiceOptions,
  TableSchema,
  ColumnSchema,
  QueryResult,
  IQueryGenerationService,
} from '../types/ai-services.types';

export class OpenAIService implements IQueryGenerationService {
  private model: OpenAI;
  private readonly unsafePatterns = [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\b/i,
    /\bDELETE\b/i,
    /\bUPDATE\b/i,
  ];

  private readonly responseSchema = responseSchema;

  constructor(options: AIServiceOptions) {
    const { apiKey, modelName, temperature, maxOutputTokens } = options;
    
    this.model = new OpenAI({
      apiKey,
    });
    
    // Store model configuration for later use
    this.modelName = modelName || process.env.OPENAI_MODEL || 'gpt-4-turbo';
    this.temperature = temperature || 0.1;
    this.maxOutputTokens = maxOutputTokens || 1024;

    // Bind methods to preserve this context
    this.formatColumnInfo = this.formatColumnInfo.bind(this);
    this.formatTableSchema = this.formatTableSchema.bind(this);
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

  private modelName: string;
  private temperature: number;
  private maxOutputTokens: number;

  private async generateContent(prompt: string): Promise<string> {
    const response = await this.model.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
      max_tokens: this.maxOutputTokens,
    });
    
    return response.choices[0]?.message?.content || '';
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
      throw new Error('Invalid response format from OpenAI API');
    }

    // Validate chart config if present
    if (chartConfig) {
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
    if (!this.model) {
      throw new Error('OpenAI service not properly initialized');
    }
  }

  public async generateQuery(
    schema: TableSchema[],
    question: string,
    errorMessage?: string,
    referenceText?: string,
    chartType?: string | undefined
  ): Promise<QueryResult> {
    this.validateServiceState();
    this.validateInputs(schema, question);
    
    try {
      const schemaInfo = schema.map(this.formatTableSchema).join('\n');
      const prompt = generatePromptTemplate(
        schemaInfo,
        question,
        referenceText,
        chartType,
        errorMessage
      );
      log('Generated prompt:', prompt);
      const response = await this.generateContent(prompt);
      const queryResult = await this.parseAndValidateResponse(response);
      queryResult.isUnsafe ||= this.checkUnsafeOperations(queryResult.sql);
      return queryResult;
    } catch (error) {
      throw new Error(`Failed to generate SQL query: ${(error as Error).message}`);
    }
  }
}
