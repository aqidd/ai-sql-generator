/* eslint-disable max-lines-per-function */
/**
 * Changes made:
 * 2025-03-16: Created Gemini service for SQL query generation
 * 2025-03-16: Fixed method binding and model configuration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { log } from 'winston';

interface QueryResult {
  sql: string;
  isUnsafe: boolean;
  explanation: string;
}

interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
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
    },
    required: ['sql', 'isUnsafe', 'explanation'],
    propertyOrdering: ['sql', 'explanation', 'isUnsafe'],
    nullable: false,
  };

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024
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
    const columns = table.columns
      .map((col) => this.formatColumnInfo(col))
      .join(', ');
    return `Table ${table.tableName}: ${columns}`;
  }

  private validateInputs(schema: TableSchema[], question: string): void {
    if (!schema?.length) {
      throw new Error('Database schema is required');
    }
    if (!question?.trim()) {
      throw new Error('Question is required');
    }
  }

  private getPromptRules(): string {
    return `FORMAT:
{
  "sql": "query",
  "isUnsafe": false,
  "explanation": "brief"
}

RULES:
1. No markdown/code blocks
2. Double quotes in JSON
3. isUnsafe=true for UPDATE/DELETE
4. Efficient JOINs
5. Valid SQL syntax`;
  }

  private generatePrompt(schema: TableSchema[], question: string, referenceText?: string): string {
    this.validateInputs(schema, question);
    const schemaInfo = schema.map(this.formatTableSchema).join('\n');
    const rules = this.getPromptRules();

    const referenceContext = referenceText 
        ? `REFERENCE DOCUMENT:\n${referenceText}\n\n`
        : '';
    log('info', `Generating reference for question: ${referenceContext  }`);

    return `You are a Data Analyst with MySQL expertise.
    Given the following database schema and user question, 
    generate an SQL query that answers user's question. 
    Read reference document for additional context.
    Return ONLY a valid JSON object.

    Database Schema:
    ${schemaInfo}

    ${referenceContext}

    User Question: ${question}

    ${rules}`;
  }

  private async generateContent(prompt: string): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 1024
      }
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
    const { sql, isUnsafe, explanation } = result;
    const isValid = sql && typeof sql === 'string' &&
      typeof isUnsafe === 'boolean' &&
      explanation && typeof explanation === 'string';
      
    if (!isValid) {
      throw new Error('Invalid response format from Gemini API');
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
    referenceText?: string
  ): Promise<QueryResult> {
    this.validateServiceState();

    try {
      const prompt = errorMessage
        ? this.generateErrorFixPrompt(schema, question, errorMessage)
        : this.generatePrompt(schema, question, referenceText);


      const response = await this.generateContent(prompt);
      const queryResult = await this.parseAndValidateResponse(response);
      queryResult.isUnsafe ||= this.checkUnsafeOperations(queryResult.sql);
      return queryResult;
    } catch (error) {
      throw new Error(`Failed to generate SQL query: ${(error as Error).message}`);
    }
  }

  private generateErrorFixPrompt(
    schema: TableSchema[],
    question: string,
    errorMessage: string
  ): string {
    const schemaInfo = schema.map(this.formatTableSchema).join('\n');
    return `You are a MySQL expert. Given the following database schema and user question, 
    generate a corrected SQL query that fixes the error from a previous attempt.

    Database Schema:
    ${schemaInfo}

    User Question: ${question}

    Previous Error: ${errorMessage}

    Please generate a valid SQL query that:
    1. Fixes the error from the previous attempt
    2. Correctly answers the user's question
    3. Uses only the tables and columns defined in the schema
    4. Returns the most relevant data

    Respond with a JSON object containing:
    - sql: The corrected SQL query
    - explanation: A brief explanation of what the query does and how it fixes the error
    - isUnsafe: true if the query modifies data (UPDATE, DELETE, etc.)`;
  }
}
