/* eslint-disable max-lines-per-function */
/**
 * Changes made:
 * 2025-03-16: Created Gemini service for SQL query generation
 * 2025-03-16: Fixed method binding and model configuration
 * 2025-03-31: Added chart generation support for pie, line, and bar charts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from 'console';

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

  private readonly responseSchema = {
    type: 'object',
    description: 'SQL query generation response format',
    properties: {
      sql: {
        type: 'string',
        description: 'The generated SQL query that matches the database schema',
      },
      isUnsafe: {
        type: 'boolean',
        description:
          'Indicates if the query contains data-modifying operations (UPDATE, DELETE, etc.)',
      },
      explanation: {
        type: 'string',
        description: 'A brief, clear explanation of what the SQL query does',
      },
      chartConfig: {
        type: 'object',
        description: 'Configuration for chart visualization of query results',
        properties: {
          type: {
            type: 'string',
            description: 'Type of chart to generate (pie, line, bar)',
            enum: ['pie', 'line', 'bar']
          },
          labelColumn: {
            type: 'string',
            description: 'Column to use for labels (pie chart) or x-axis (line/bar charts)'
          },
          valueColumn: {
            type: 'string',
            description: 'Column to use for values (pie chart) or y-axis (line/bar charts)'
          },
          categoryColumn: {
            type: 'string',
            description: 'Column to use for categories in bar charts'
          },
          seriesColumns: {
            type: 'array',
            description: 'Columns to use for multiple series in line or stacked bar charts',
            items: {
              type: 'string'
            }
          },
          timeColumn: {
            type: 'string',
            description: 'Column to use for time series data in line charts'
          }
        },
        required: ['type']
      }
    },
    required: ['sql', 'isUnsafe', 'explanation'],
    propertyOrdering: ['sql', 'explanation', 'isUnsafe', 'chartConfig'],
    nullable: false,
  };

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

  private getPromptRules(chartType: string | null = null): string {
    const chartExample = chartType ? this.getChartConfigExample(chartType) : '';
    
    const format = chartType
      ? `FORMAT:
{
  "sql": "query",
  "isUnsafe": false,
  "explanation": "brief",
  "chartConfig": ${chartExample}
}`
      : `FORMAT:
{
  "sql": "query",
  "isUnsafe": false,
  "explanation": "brief"
}`;

    return `${format}

RULES:
1. No markdown/code blocks
2. Double quotes in JSON
3. isUnsafe=true for UPDATE/DELETE
4. Efficient JOINs
5. Valid SQL syntax${chartType ? '\n6. Query results must be suitable for the requested chart type' : ''}`;
  }

  private getChartConfigExample(chartType: string): string {
    switch (chartType) {
      case 'pie':
        return `{
    "type": "pie",
    "labelColumn": "category_name",
    "valueColumn": "total_count"
  }`;
      case 'line':
        return `{
    "type": "line",
    "timeColumn": "date",
    "seriesColumns": ["sales", "profit"]
  }`;
      case 'bar':
        return `{
    "type": "bar",
    "categoryColumn": "product_category",
    "seriesColumns": ["revenue", "cost"]
  }`;
      default:
        return '{}';
    }
  }

  private generatePrompt(
    schema: TableSchema[],
    question: string,
    referenceText?: string,
    chartType?: string | undefined
  ): string {
    log('Generating prompt??...', chartType)
    this.validateInputs(schema, question);
    const schemaInfo = schema.map(this.formatTableSchema).join('\n');
    const rules = this.getPromptRules(chartType);

    const referenceContext = referenceText ? `REFERENCE DOCUMENT:\n${referenceText}\n\n` : '';
    
    const chartContext = chartType
      ? `\nThe results should be visualized as a ${chartType} chart. ` +
        `Make sure the SQL query returns data in a format suitable for this chart type.`
      : '';

    return `You are a Data Analyst with MySQL expertise.
    Given the following database schema and user question, 
    generate an SQL query that answers user's question. 
    SQL must return data from database provided.
    Use given reference document for additional context.
    Return ONLY a valid JSON object.

    Database Schema:
    ${schemaInfo}

    ${referenceContext}

    User Question: ${question} ${chartContext}

    ${rules}`;
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
    log('Generating query??...', chartType);
    this.validateServiceState();
    try {
      log('error??...', errorMessage)
      const prompt = errorMessage
        ? this.generateErrorFixPrompt(schema, question, errorMessage, chartType)
        : this.generatePrompt(schema, question, referenceText, chartType);
      // log('Generated prompt:', prompt);
      const response = await this.generateContent(prompt);
      const queryResult = await this.parseAndValidateResponse(response);
      queryResult.isUnsafe ||= this.checkUnsafeOperations(queryResult.sql);
      return queryResult;
    } catch (error) {
      log('Failed to generate SQL query??...', chartType)
      throw new Error(`Failed to generate SQL query: ${(error as Error).message}`);
    }
  }

  private generateErrorFixPrompt(
    schema: TableSchema[],
    question: string,
    errorMessage: string,
    chartType: string | null = null
  ): string {
    const schemaInfo = schema.map(this.formatTableSchema).join('\n');
    
    const chartContext = chartType
      ? `The results should be visualized as a ${chartType} chart. ` +
        `Make sure the SQL query returns data in a format suitable for this chart type.`
      : 'The results will not be visualized.';

    return `You are a MySQL expert. Given the following database schema and user question, 
    generate a corrected SQL query that fixes the error from a previous attempt.

    Database Schema:
    ${schemaInfo}

    User Question: ${question}
    ${chartContext}

    Previous Error: ${errorMessage}

    Please generate a valid SQL query that:
    1. Fixes the error from the previous attempt
    2. Correctly answers the user's question
    3. Uses only the tables and columns defined in the schema
    4. Returns the most relevant data
    5. ${chartContext}

    Respond with a JSON object containing:
    - sql: The corrected SQL query
    - explanation: A brief explanation of what the query does and how it fixes the error
    - isUnsafe: true if the query modifies data (UPDATE, DELETE, etc.)`;
  }
}
