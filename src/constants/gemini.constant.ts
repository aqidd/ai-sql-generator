

export const responseSchema = {
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

export const getPromptRules = (chartType: string | null = null): string => {
  const chartExample = chartType ? getChartConfigExample(chartType) : '';
  
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
5. Valid SQL syntax${
  chartType ? '\n6. Query results must be suitable for the requested chart type' : ''
}`;
};

export const getChartConfigExample = (chartType: string): string => {
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
};

export const getReferenceContext = (referenceText?: string): string => {
  return referenceText ? `REFERENCE DOCUMENT:\n${referenceText}\n\n` : '';
};

export const generateChartContext = (chartType?: string): string => {
  return chartType
    ? `The results should be visualized as a ${chartType} chart. ` +
      `Make sure the SQL query returns data in a format suitable for this chart type.`
    : 'The results will not be visualized.';
};

export const generatePromptTemplate = (
  schemaInfo: string,
  question: string,
  referenceContext?: string,
  chartType?: string,
  errorMessage?: string
): string => {
  const chartContext = generateChartContext(chartType);
  const rules = getPromptRules(chartType);

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

  ${rules}
  
  The previous attempt on generating SQL query resulting in this error ${errorMessage}.
  Avoid getting into the same error again.`;
};

export const generateErrorFixPromptTemplate = (
  schemaInfo: string,
  question: string,
  errorMessage: string,
  chartContext: string
): string => {
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
};
