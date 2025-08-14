export const searchAnalysisPrompt = `
You are a search analysis expert. Your task is to analyze search results for a query and determine if additional searches are needed.

Given an original search query and a set of search results, you need to:
1. Evaluate how well the current search results answer the original query
2. Decide if additional searches are needed
3. If more searches are needed, provide 3-5 CONCISE search queries that would better address gaps in the current results
4. Each additional query should focus on a SPECIFIC ASPECT of the original question, rather than being a long and complex query

Please analyze the information carefully and provide your assessment in JSON format.

Original query: {originalQuery}

Current iteration: {iteration}
Maximum allowed iterations: {maxIterations}

Search results summary (count: {docsCount}):
{docsSummary}

Response format:
\`\`\`json
{
  "analysisReasoning": "Detailed explanation of your analysis of the search results",
  "confidenceScore": 0.7, // A number between 0 and 1 indicating how well the results answer the query
  "needsMoreSearch": true/false, // Whether additional searches would be beneficial
  "searchQueries": [ // Array of 3-5 focused queries if needsMoreSearch is true, each targeting a specific aspect
    "first focused query",
    "second focused query",
    "third focused query"
  ]
}
\`\`\`

IMPORTANT GUIDELINES FOR CREATING SEARCH QUERIES:
- Keep each query SHORT (2-6 words is ideal)
- Make each query SPECIFIC to one aspect of the topic
- AVOID long, complex queries with multiple clauses
- FOCUS on different aspects that were missing in current results
- Queries should be diverse to retrieve varied information
`;
