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
          description:
            'Type of chart to generate (pie, line, bar, doughnut, polarArea, radar, scatter, bubble, mixed)',
          enum: [
            'pie',
            'line',
            'bar',
            'doughnut',
            'polarArea',
            'radar',
            'scatter',
            'bubble',
            'mixed',
          ],
        },
        labelColumn: {
          type: 'string',
          description: 'Column to use for labels (pie chart) or x-axis (line/bar charts)',
        },
        valueColumn: {
          type: 'string',
          description: 'Column to use for values (pie chart) or y-axis (line/bar charts)',
        },
        categoryColumn: {
          type: 'string',
          description: 'Column to use for categories in bar charts',
        },
        seriesColumns: {
          type: 'array',
          description: 'Columns to use for multiple series in line or stacked bar charts',
          items: {
            type: 'string',
          },
        },
        timeColumn: {
          type: 'string',
          description: 'Column to use for time series data in line charts',
        },
      },
      required: ['type'],
    },
  },
  required: ['sql', 'isUnsafe', 'explanation'],
  propertyOrdering: ['sql', 'explanation', 'isUnsafe', 'chartConfig'],
  nullable: false,
};

// eslint-disable-next-line max-lines-per-function
export const getChartDetails = (chartType?: string): { example: string; context: string } => {
  // eslint-disable-next-line complexity
  const chartExample: string = ((): string => {
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
      case 'doughnut':
        return `{
      "type": "doughnut",
      "labelColumn": "category_name",
      "valueColumn": "total_count"
    }`;
      case 'polarArea':
        return `{
      "type": "polarArea",
      "labelColumn": "category_name",
      "valueColumn": "total_count"
    }`;
      case 'radar':
        return `{
      "type": "radar",
      "seriesColumns": ["metric1", "metric2", "metric3"]
    }`;
      case 'scatter':
        return `{
      "type": "scatter",
      "seriesColumns": ["x_value", "y_value"]
    }`;
      case 'bubble':
        return `{
      "type": "bubble",
      "seriesColumns": ["x_value", "y_value", "radius"]
    }`;
      case 'mixed':
        return `{
      "type": "mixed",
      "seriesColumns": ["bar_data", "line_data", "area_data"]
    }`;
      case 'any':
        return `{
      "type": "any", // LLM can choose any supported type [pie, line, bar, scatter, bubble, etc.]
      "categoryColumn": "category_name", // Return category column for bar chart ( paired with series columns)
      "labelColumn": "label", // Return label column for pie, doughnut and polar area chart (should be paired with value columns)
      "valueColumn": "value" // Return value column for pie, doughnut and polar area chart (should be paired with label columns)
      "seriesColumns": ["series1", "series2"] // Return series columns if applicable
      "timeColumn": "timestamp" // Return time column for line chart (should be paired with series columns)
    }`;
      default:
        return '{}';
    }
  })();

  const chartContext = chartType
    ? chartType === 'any'
      ? 'The results should be visualized as a chart. Choose an appropriate chart type supported by Chart.js based on the query results.'
      : `The results should be visualized as a ${chartType} chart. ` +
        `Make sure the SQL query returns data in a format suitable for this chart type.`
    : 'The results will not be visualized.';

  return { example: chartExample, context: chartContext };
};

export const getPromptRules = (chartType: string | undefined): string => {
  const { example: chartExample, context: chartContext } = getChartDetails(chartType);

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
5. Valid SQL syntax
${chartType ? `\n6. Query results must be suitable for the requested chart type. ${chartContext}` : ''}`;
};

export const getReferenceContext = (referenceText?: string): string => {
  return referenceText ? `REFERENCE DOCUMENT:\n${referenceText}\n\n` : '';
};

export const generatePromptTemplate = (
  schemaInfo: string,
  question: string,
  referenceContext?: string,
  chartType?: string,
  errorMessage?: string
): string => {
  const rules = getPromptRules(chartType);

  return `You are a Data Analyst with MySQL expertise.
  Given the following database schema and user question, 
  generate an SQL query that answers user's question. 
  SQL must return data from database provided.
  Use given reference document for additional context.
  Return ONLY a valid JSON object.

  Database Schema:
  ${schemaInfo}

  Additional Context: ${referenceContext}

  User Question: ${question} 

  ${rules}
  
  The previous attempt on generating SQL query resulting in this error: ${errorMessage}.
  Avoid getting into the same error again.`;
};
