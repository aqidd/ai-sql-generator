/* eslint-disable max-len */
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
      "seriesColumns": ["x_value", "y_value"] // must be number datatype
    }`;
      case 'bubble':
        return `{
      "type": "bubble",
      "seriesColumns": ["x_value", "y_value", "radius"] // must be number datatypes
    }`;
      case 'mixed':
        return `{
      "type": "mixed",
      // LLM should return multiple chart types. 
      // For example, a line chart and a bar chart in the same dataset
      "labelColumn": "product_name",
      "charts": [
        {
          "type": "line",
          "label": "Line Dataset",
          "column": "sales" // number datatype
        },
        {
          "type": "bar",
          "label": "Bar Dataset",
          "column": "profit" // number datatype
        }
      ],
    }`;
      case 'any':
        return `{
      "type": "any", // LLM can choose any supported type [pie, line, bar, scatter, bubble, radar, mixed, etc.]
      "categoryColumn": "category_name", // Return category column for bar chart ( paired with series columns)
      "labelColumn": "label", // Return label column for pie, doughnut and polar area chart (should be paired with value columns)
      "valueColumn": "value" // Return value column for pie, doughnut and polar area chart (number as the datatype and paired with label columns)
      "seriesColumns": ["series1", "series2"] // Return series columns if applicable (each column should have data type number, not string/enum)
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

const getReferenceContext = (referenceText?: string): string => {
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

  ${getReferenceContext(referenceContext)}

  User Question: ${question} 

  ${rules}
  
  ${errorMessage ? analyzeError(errorMessage) : ""}`;
};

const analyzeError = (errorMessage: string): string => {
  let errorAnalysis;
  // Analyze the errorMessage to categorize the problem and suggest a fix.
  if (errorMessage.toLowerCase().includes("syntax error")) {
    errorAnalysis = `The previous query had a syntax error. Carefully check for typos, incorrect use of keywords (e.g., SELECT, FROM, WHERE, JOIN), and missing semicolons. Double check all column and table names used in query are present in schema.`;
  } else if (errorMessage.toLowerCase().includes("ambiguous column")) {
    errorAnalysis = `The previous query had an ambiguous column name. This means the same column name exists in multiple tables you are joining.  Explicitly specify the table name when referencing the column (e.g., table1.columnName).`;
  } else if (errorMessage.toLowerCase().includes("invalid column")) {
    errorAnalysis = `The previous query used an invalid column name. Double-check the schema to make sure that the column exists and is spelled correctly. Also verify the correct table name.`;
  } else if (errorMessage.toLowerCase().includes("table not found")) {
    errorAnalysis = `The previous query used a table name that does not exist. Double-check the schema to make sure that the table exists and is spelled correctly.`;
  } else if (errorMessage.toLowerCase().includes("group by")) {
    errorAnalysis = `The previous query used a 'GROUP BY' clause incorrectly. Ensure that all non-aggregated columns in the SELECT statement are also included in the GROUP BY clause. If you are trying to filter after grouping, use a 'HAVING' clause instead of 'WHERE'.`;
  } else if (errorMessage.toLowerCase().includes("incorrect number of arguments")) {
      errorAnalysis = `The previous query used a function or operator with an incorrect number of arguments. Check the documentation for the specific function you're using to ensure you're passing the correct number and type of parameters.`;
  } else if (errorMessage.toLowerCase().includes("does not exist")) {
    errorAnalysis = `The previous query used a function or column that does not exist in the database or is not valid in this context.  Carefully review the database schema to ensure that the function or column is available and spelled correctly. Pay close attention to case sensitivity, the function might have different casing in schema definition. Also verify if you are using column with correct table.`;
  } else {
    errorAnalysis = `The previous query generated resulted in an error: "${errorMessage}".  Please analyze the error message carefully and identify the cause of the problem. Ensure all column and table names used in query are present in schema. Use given reference document for additional context.`;
  }

  errorAnalysis += " Based on the previous error, make sure the query generated have no issue. Do not repeat the same mistake."; // IMPORTANT!
  return errorAnalysis;
}

