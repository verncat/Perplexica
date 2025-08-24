import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import LineListOutputParser from '../outputParsers/listLineOutputParser';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { getDocumentsFromLinks } from '../utils/documents';
import { Document } from 'langchain/document';
import { searchSearxng } from '../searxng';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';

// Импорты Node.js для серверной части
// @ts-ignore - Next.js обработает эти импорты на стороне сервера
import path from 'node:path';
// @ts-ignore
import fs from 'node:fs';
// @ts-ignore 
import { EventEmitter } from 'events';

// Создаем локальный эмиттер событий
export const eventEmitter = new EventEmitter();

// Тип для потока событий LangChain
interface StreamEvent {
  event: string;
  name?: string;
  data: {
    chunk?: string;
    output?: any;
    [key: string]: any;
  };
}

// Типы для данных
interface SimilarityResult {
  index: number;
  similarity: number;
}

// Тип для Node.js process
declare global {
  namespace NodeJS {
    interface Process {
      cwd(): string;
    }
  }
  var process: NodeJS.Process;
}

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    maxIterations?: number,
  ) => Promise<EventEmitter>;
}

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  responsePrompt: string;
  activeEngines: string[];
}

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;
  private strParser = new StringOutputParser();

  constructor(config: Config) {
    this.config = config;
  }

  private async createSearchRetrieverChain(llm: BaseChatModel) {
    (llm as unknown as ChatOpenAI).temperature = 0;

    return RunnableSequence.from([
      PromptTemplate.fromTemplate(this.config.queryGeneratorPrompt),
      llm,
      this.strParser,
      RunnableLambda.from(async (input: string) => {
        const linksOutputParser = new LineListOutputParser({
          key: 'links',
        });

        const questionOutputParser = new LineOutputParser({
          key: 'question',
        });

        const links = await linksOutputParser.parse(input);
        let question = this.config.summarizer
          ? await questionOutputParser.parse(input)
          : input;

        if (question === 'not_needed') {
          return { query: '', docs: [] };
        }

        if (links.length > 0) {
          if (question.length === 0) {
            question = 'summarize';
          }

          let docs: Document[] = [];

          const linkDocs = await getDocumentsFromLinks({ links });

          const docGroups: Document[] = [];

          linkDocs.map((doc) => {
            const URLDocExists = docGroups.find(
              (d) =>
                d.metadata.url === doc.metadata.url &&
                d.metadata.totalDocs < 10,
            );

            if (!URLDocExists) {
              docGroups.push({
                ...doc,
                metadata: {
                  ...doc.metadata,
                  totalDocs: 1,
                },
              });
            }

            const docIndex = docGroups.findIndex(
              (d) =>
                d.metadata.url === doc.metadata.url &&
                d.metadata.totalDocs < 10,
            );

            if (docIndex !== -1) {
              docGroups[docIndex].pageContent =
                docGroups[docIndex].pageContent + `\n\n` + doc.pageContent;
              docGroups[docIndex].metadata.totalDocs += 1;
            }
          });

          await Promise.all(
            docGroups.map(async (doc) => {
              const res = await llm.invoke(`
            You are a web search summarizer, tasked with summarizing a piece of text retrieved from a web search. Your job is to summarize the 
            text into a detailed, 2-4 paragraph explanation that captures the main ideas and provides a comprehensive answer to the query.
            If the query is \"summarize\", you should provide a detailed summary of the text. If the query is a specific question, you should answer it in the summary.
            
            - **Journalistic tone**: The summary should sound professional and journalistic, not too casual or vague.
            - **Thorough and detailed**: Ensure that every key point from the text is captured and that the summary directly answers the query.
            - **Not too lengthy, but detailed**: The summary should be informative but not excessively long. Focus on providing detailed information in a concise format.

            The text will be shared inside the \`text\` XML tag, and the query inside the \`query\` XML tag.

            <example>
            1. \`<text>
            Docker is a set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers. 
            It was first released in 2013 and is developed by Docker, Inc. Docker is designed to make it easier to create, deploy, and run applications 
            by using containers.
            </text>

            <query>
            What is Docker and how does it work?
            </query>

            Response:
            Docker is a revolutionary platform-as-a-service product developed by Docker, Inc., that uses container technology to make application 
            deployment more efficient. It allows developers to package their software with all necessary dependencies, making it easier to run in 
            any environment. Released in 2013, Docker has transformed the way applications are built, deployed, and managed.
            \`
            2. \`<text>
            The theory of relativity, or simply relativity, encompasses two interrelated theories of Albert Einstein: special relativity and general
            relativity. However, the word "relativity" is sometimes used in reference to Galilean invariance. The term "theory of relativity" was based
            on the expression "relative theory" used by Max Planck in 1906. The theory of relativity usually encompasses two interrelated theories by
            Albert Einstein: special relativity and general relativity. Special relativity applies to all physical phenomena in the absence of gravity.
            General relativity explains the law of gravitation and its relation to other forces of nature. It applies to the cosmological and astrophysical
            realm, including astronomy.
            </text>

            <query>
            summarize
            </query>

            Response:
            The theory of relativity, developed by Albert Einstein, encompasses two main theories: special relativity and general relativity. Special
            relativity applies to all physical phenomena in the absence of gravity, while general relativity explains the law of gravitation and its
            relation to other forces of nature. The theory of relativity is based on the concept of "relative theory," as introduced by Max Planck in
            1906. It is a fundamental theory in physics that has revolutionized our understanding of the universe.
            \`
            </example>

            Everything below is the actual data you will be working with. Good luck!

            <query>
            ${question}
            </query>

            <text>
            ${doc.pageContent}
            </text>

            Make sure to answer the query in the summary.
          `);

              const document = new Document({
                pageContent: res.content as string,
                metadata: {
                  title: doc.metadata.title,
                  url: doc.metadata.url,
                },
              });

              docs.push(document);
            }),
          );

          return { query: question, docs: docs };
        } else {
          question = question.replace(/<think>.*?<\/think>/g, '');

          const res = await searchSearxng(question, {
            language: 'en',
            engines: this.config.activeEngines,
          });

          const documents = res.results.map(
            (result) =>
              new Document({
                pageContent:
                  result.content ||
                  (this.config.activeEngines.includes('youtube')
                    ? result.title
                    : '') /* Todo: Implement transcript grabbing using Youtubei (source: https://www.npmjs.com/package/youtubei) */,
                metadata: {
                  title: result.title,
                  url: result.url,
                  ...(result.img_src && { img_src: result.img_src }),
                },
              }),
          );

          return { query: question, docs: documents };
        }
      }),
    ]);
  }

  private async createAnsweringChain(
    llm: BaseChatModel,
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    systemInstructions: string,
    maxIterations?: number,
  ) {
    return RunnableSequence.from([
      RunnableMap.from({
        systemInstructions: () => systemInstructions,
        query: (input: BasicChainInput) => input.query,
        chat_history: (input: BasicChainInput) => input.chat_history,
        date: () => new Date().toISOString(),
        context: RunnableLambda.from(async (input: BasicChainInput) => {
          const processedHistory = formatChatHistoryAsString(
            input.chat_history,
          );

          let docs: Document[] | null = null;
          let query = input.query;

          if (this.config.searchWeb) {
            const searchRetrieverChain =
              await this.createSearchRetrieverChain(llm);

            const searchRetrieverResult = await searchRetrieverChain.invoke({
              chat_history: processedHistory,
              query,
            });

            query = searchRetrieverResult.query;
            docs = searchRetrieverResult.docs;
          }

          const sortedDocs = await this.rerankDocs(
            query,
            docs ?? [],
            fileIds,
            embeddings,
            optimizationMode,
            llm,
            maxIterations,
          );

          return sortedDocs;
        })
          .withConfig({
            runName: 'FinalSourceRetriever',
          })
          .pipe(this.processDocs),
      }),
      ChatPromptTemplate.fromMessages([
        ['system', this.config.responsePrompt],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]),
      llm,
      this.strParser,
    ]).withConfig({
      runName: 'FinalResponseGenerator',
    });
  }

  // Метод для анализа результатов поиска в качественном режиме с использованием LLM
  private async analyzeSearchResults(
    llm: BaseChatModel,
    originalQuery: string,
    docs: Document[],
    iteration: number,
    maxIterations?: number
  ): Promise<{ 
    needsMoreSearch: boolean; 
    searchQueries?: string[]; 
    confidence: number; 
    analysisReasoning?: string 
  }> {
    if (docs.length === 0) {
      return { 
        needsMoreSearch: true, 
        searchQueries: [originalQuery, `${originalQuery} basics`, `${originalQuery} explained`], 
        confidence: 0 
      };
    }
    
    try {
      // Используем LLM для анализа результатов поиска
      // Создаем краткое резюме из найденных документов для анализа
      const docsSummary = docs.slice(0, 10).map((doc, idx) => {
        return `[${idx+1}] ${doc.metadata.title || 'Без заголовка'}: ${doc.pageContent.substring(0, 150)}...`;
      }).join('\n\n');
      
      const maxIter = maxIterations || 2; // Если не указано, используем 2 итерации по умолчанию
      
      // Формируем промпт для LLM с нашим запросом и результатами поиска
      const { searchAnalysisPrompt } = await import('../prompts/searchAnalysis');
      const prompt = searchAnalysisPrompt
        .replace('{originalQuery}', originalQuery)
        .replace('{iteration}', iteration.toString())
        .replace('{maxIterations}', maxIter.toString())
        .replace('{docsCount}', docs.length.toString())
        .replace('{docsSummary}', docsSummary);
        
      // Запрос к LLM
      const llmResponse = await llm.invoke(prompt);
      const responseText = llmResponse.content as string;
      
      // Извлечение JSON из ответа LLM
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
                       
      if (!jsonMatch) {
        console.error("Failed to extract JSON from LLM response:", responseText);
        throw new Error("Invalid LLM response format");
      }
      
      let analysisResult;
      try {
        // Извлекаем и парсим JSON
        const jsonString = jsonMatch[1] || jsonMatch[0];
        analysisResult = JSON.parse(jsonString);
        
        console.log(`LLM Analysis details: iteration=${iteration}, docs=${docs.length}, confidence=${analysisResult.confidenceScore}`);
        console.log(`LLM analysis: ${analysisResult.analysisReasoning}`);
        
        // Проверяем наличие массива поисковых запросов
        const searchQueries = analysisResult.searchQueries || [];
        
        return {
          needsMoreSearch: analysisResult.needsMoreSearch && iteration < maxIter,
          confidence: analysisResult.confidenceScore,
          searchQueries: analysisResult.needsMoreSearch ? searchQueries : undefined,
          analysisReasoning: analysisResult.analysisReasoning
        };
      } catch (jsonError) {
        console.error("Error parsing JSON from LLM response:", jsonError);
        throw jsonError;
      }
    } catch (error) {
      console.error("Error in analyzeSearchResults:", error);
      // В случае ошибки возвращаем безопасное значение - используем старую эвристику
      const confidence = docs.length > 20 ? 0.9 : docs.length > 15 ? 0.7 : docs.length > 10 ? 0.5 : docs.length > 5 ? 0.3 : 0.1;
      const needsMoreSearch = iteration < 2 && confidence < 0.6;
      
      console.log(`Fallback to heuristic: iteration=${iteration}, docs=${docs.length}, confidence=${confidence}`);
      
      // Создаём несколько запросов в случае фоллбэка
      const fallbackQueries = this.generateFallbackQueries(originalQuery, iteration);
      
      return { 
        needsMoreSearch,
        confidence,
        searchQueries: needsMoreSearch ? fallbackQueries : undefined
      };
    }
  }

  // Генерируем набор фоллбек-запросов для каждой итерации
  private generateFallbackQueries(originalQuery: string, iteration: number): string[] {
    // Базовые аспекты для первой итерации
    if (iteration === 0) {
      return [
        `${originalQuery} basics`,
        `${originalQuery} explained`,
        `${originalQuery} introduction`,
        `${originalQuery} definition`
      ];
    }
    
    // Более продвинутые аспекты для второй итерации
    if (iteration === 1) {
      return [
        `${originalQuery} examples`,
        `${originalQuery} applications`,
        `${originalQuery} advanced concepts`,
        `${originalQuery} vs`
      ];
    }
    
    // Глубокие аспекты для последующих итераций
    return [
      `${originalQuery} research`,
      `${originalQuery} latest developments`,
      `${originalQuery} limitations`,
      `${originalQuery} future`
    ];
  }
  
  // Старый метод для обратной совместимости
  private generateRefinedQuery(originalQuery: string, iteration: number): string {
    const queries = this.generateFallbackQueries(originalQuery, iteration);
    return queries[0] || `${originalQuery} in depth`;
  }

  // Хелпер для создания задержки между запросами
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Простой метод для выполнения одиночного поиска
  private async performSingleSearch(query: string): Promise<Document[]> {
    try {
      const res = await searchSearxng(query, {
        language: 'en',
        engines: this.config.activeEngines,
      });

      return res.results.map(result => new Document({
        pageContent: result.content || result.title,
        metadata: {
          title: result.title,
          url: result.url,
          ...(result.img_src && { img_src: result.img_src }),
        },
      }));
    } catch (error) {
      console.error('Error in single search:', error);
      return [];
    }
  }

  // Итеративный поиск для качественного режима с деталями итераций и несколькими запросами
  private async performIterativeSearch(
    llm: BaseChatModel,
    originalQuery: string,
    initialDocs: Document[],
    maxIterations?: number,
    emitter?: EventEmitter
  ): Promise<{
    docs: Document[]; 
    iterationDetails: Array<{ 
      iteration: number; 
      query: string; 
      analysis?: string;
    }>
  }> {
    let allDocs = [...initialDocs];
    let iteration = 0;
    const maxIter = maxIterations || 2; // Дефолт 2 если не указано
    
    // Массив для хранения деталей итераций для UI
    const iterationDetails: Array<{ 
      iteration: number; 
      query: string; 
      analysis?: string;
    }> = [{
      iteration: 1,
      query: originalQuery
    }];
    
    console.log(`Starting iterative search for: "${originalQuery}" with up to ${maxIter} iterations`);
    
    if (eventEmitter) {
      const eventData = {
        type: 'searchStart',
        query: originalQuery,
        maxIterations: maxIter
      };
      console.log('Emitting searchProgress event:', eventData);
      eventEmitter.emit('searchProgress', eventData);
    }

    try {
      while (iteration < maxIter) {
        try {
          if (eventEmitter) {
            eventEmitter.emit('searchProgress', {
              type: 'iterationStart',
              current: iteration + 1,
              total: maxIter
            });
          }

          const analysis = await this.analyzeSearchResults(llm, originalQuery, allDocs, iteration, maxIter);
          
          if (eventEmitter) {
            eventEmitter.emit('searchProgress', {
              type: 'analysis',
              confidence: analysis.confidence,
              reasoning: analysis.analysisReasoning
            });
          }

          // Обновляем информацию о текущей итерации с анализом LLM
          if (iterationDetails[iteration]) {
            iterationDetails[iteration].analysis = analysis.analysisReasoning;
          }
          
          console.log(`Iteration ${iteration + 1}: Confidence ${analysis.confidence}, Need more: ${analysis.needsMoreSearch}`);
          
          // Если не нужно дополнительного поиска или не получили запросов, завершаем
          if (!analysis.needsMoreSearch || !analysis.searchQueries || analysis.searchQueries.length === 0) {
            break;
          }
          
          // Выполняем несколько поисков с разными запросами
          console.log(`Refining search with ${analysis.searchQueries.length} queries`);
          
          let totalNewDocs = 0;
          
          // Проходим по всем запросам и выполняем поиск для каждого
          for (let i = 0; i < analysis.searchQueries.length; i++) {
            const query = analysis.searchQueries[i];
            console.log(`Searching with query: "${query}"`);
            
            if (eventEmitter) {
              eventEmitter.emit('searchProgress', {
                type: 'queries',
                query: query,
                current: i + 1,
                total: analysis.searchQueries.length
              });
            }
            
            // Выполняем поиск с текущим запросом
            const newDocs = await this.performSingleSearch(query);
            
            // Добавляем новые уникальные документы
            const uniqueNewDocs = newDocs.filter(newDoc => 
              !allDocs.some(existingDoc => existingDoc.metadata.url === newDoc.metadata.url)
            );
            
            if (uniqueNewDocs.length > 0) {
              allDocs.push(...uniqueNewDocs);
              totalNewDocs += uniqueNewDocs.length;
              
              // Добавляем информацию о дополнительном запросе в итерации
              iterationDetails.push({
                iteration: iteration + 1,
                query: query
              });
            }
            
            // Добавляем задержку между запросами, но не после последнего
            if (i < analysis.searchQueries.length - 1) {
              console.log("Adding delay between search queries to avoid rate limiting...");
              await this.sleep(3000); // 3 секунды задержки между запросами
            }
          }
          
          console.log(`Added ${totalNewDocs} new documents from ${analysis.searchQueries.length} queries`);

          if (eventEmitter) {
            eventEmitter.emit('searchProgress', {
              type: 'iterationComplete',
              current: iteration + 1,
              total: maxIter,
              newDocs: totalNewDocs
            });
          }
          
          // Если не получили новых документов, прерываем цикл
          if (totalNewDocs === 0) {
            break;
          }
          
          // Увеличиваем счетчик итераций
          iteration++;
          
          // Добавляем задержку между итерациями, если это не последняя итерация
          if (iteration < maxIter) {
            console.log(`Waiting between iterations to avoid rate limiting...`);
            await this.sleep(5000); // 5 секунд задержки между итерациями
          }
        } catch (error) {
          console.error(`Error during iteration ${iteration + 1}:`, error);
          // Прерываем итерации при ошибке и возвращаем то, что уже нашли
          break;
        }
      }
    } catch (error) {
      console.error("Error in performIterativeSearch:", error);
      // Возвращаем исходные документы в случае критической ошибки
    }
    
    console.log(`Iterative search completed. Total documents: ${allDocs.length}`);
    console.log(`Iteration details:`, JSON.stringify(iterationDetails, null, 2));
    
    // Отправляем событие завершения всего итеративного поиска
    if (eventEmitter) {
      eventEmitter.emit('searchProgress', {
        type: 'searchComplete',
        totalDocuments: allDocs.length,
        totalIterations: iteration
      });
    }
    
    return {
      docs: allDocs,
      iterationDetails
    };
  }

  private async rerankDocs(
    query: string,
    docs: Document[],
    fileIds: string[],
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    llm?: BaseChatModel,
    maxIterations?: number,
  ) {
    if (docs.length === 0 && fileIds.length === 0) {
      return docs;
    }

    const filesData = fileIds
      .map((file) => {
        const filePath = path.join(process.cwd(), 'uploads', file);

        const contentPath = filePath + '-extracted.json';
        const embeddingsPath = filePath + '-embeddings.json';

        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'));

        const fileSimilaritySearchObject = content.contents.map(
          (c: string, i: number) => {
            return {
              fileName: content.title,
              content: c,
              embeddings: embeddings.embeddings[i],
            };
          },
        );

        return fileSimilaritySearchObject;
      })
      .flat();

    if (query.toLocaleLowerCase() === 'summarize') {
      return docs.slice(0, 15);
    }

    const docsWithContent = docs.filter(
      (doc) => doc.pageContent && doc.pageContent.length > 0,
    );

    if (optimizationMode === 'speed' || this.config.rerank === false) {
      if (filesData.length > 0) {
        const [queryEmbedding] = await Promise.all([
          embeddings.embedQuery(query),
        ]);

        const fileDocs = filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `File`,
            },
          });
        });

        const similarity = filesData.map((fileData, i) => {
          const sim = computeSimilarity(queryEmbedding, fileData.embeddings);

          return {
            index: i,
            similarity: sim,
          };
        });

        let sortedDocs = similarity
          .filter(
            (sim) => sim.similarity > (this.config.rerankThreshold ?? 0.3),
          )
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim) => fileDocs[sim.index]);

        sortedDocs =
          docsWithContent.length > 0 ? sortedDocs.slice(0, 8) : sortedDocs;

        return [
          ...sortedDocs,
          ...docsWithContent.slice(0, 15 - sortedDocs.length),
        ];
      } else {
        return docsWithContent.slice(0, 15);
      }
    } else if (optimizationMode === 'balanced') {
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(
          docsWithContent.map((doc) => doc.pageContent),
        ),
        embeddings.embedQuery(query),
      ]);

      docsWithContent.push(
        ...filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `File`,
            },
          });
        }),
      );

      docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

      const similarity = docEmbeddings.map((docEmbedding: number[], i: number) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);

        return {
          index: i,
          similarity: sim,
        };
      });

      const sortedDocs = similarity
        .filter((sim: SimilarityResult) => sim.similarity > (this.config.rerankThreshold ?? 0.3))
        .sort((a: SimilarityResult, b: SimilarityResult) => b.similarity - a.similarity)
        .slice(0, 15)
        .map((sim: SimilarityResult) => docsWithContent[sim.index]);

      return sortedDocs;
    } else if (optimizationMode === 'quality') {
      // Качественный режим с итеративным поиском
      if (!llm) {
        console.warn('LLM not provided for quality mode, falling back to balanced');
        // Fallback к balanced режиму
        const [docEmbeddings, queryEmbedding] = await Promise.all([
          embeddings.embedDocuments(
            docsWithContent.map((doc) => doc.pageContent),
          ),
          embeddings.embedQuery(query),
        ]);

        docsWithContent.push(
          ...filesData.map((fileData) => {
            return new Document({
              pageContent: fileData.content,
              metadata: {
                title: fileData.fileName,
                url: `File`,
              },
            });
          }),
        );

        docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

        const similarity = docEmbeddings.map((docEmbedding: number[], i: number) => {
          const sim = computeSimilarity(queryEmbedding, docEmbedding);
          return { index: i, similarity: sim };
        });

        const sortedDocs = similarity
          .filter((sim: { index: number; similarity: number }) => sim.similarity > (this.config.rerankThreshold ?? 0.3))
          .sort((a: { index: number; similarity: number }, b: { index: number; similarity: number }) => b.similarity - a.similarity)
          .slice(0, 15)
          .map((sim: { index: number; similarity: number }) => docsWithContent[sim.index]);

        return sortedDocs;
      }

      // Выполняем итеративный поиск для улучшения результатов
      const searchResult = await this.performIterativeSearch(
        llm,
        query,
        docsWithContent,
        maxIterations,
        eventEmitter
      );
      
      // Сохраняем информацию об итерациях для использования в UI
      console.log('Search iteration details:', JSON.stringify(searchResult.iterationDetails));
      
      // Добавляем информацию об итерациях ко всем документам
      searchResult.docs = searchResult.docs.map(doc => {
        // Копируем документ и добавляем метаданные
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            iterationDetails: searchResult.iterationDetails
          }
        });
      });
      
      // Получаем улучшенные документы из всех итераций поиска
      const enhancedDocs = searchResult.docs;
      console.log(`Total documents collected from iterative search: ${enhancedDocs.length}`);
      
      const [docEmbeddings, queryEmbedding] = await Promise.all([
        embeddings.embedDocuments(
          enhancedDocs.map((doc: Document) => doc.pageContent),
        ),
        embeddings.embedQuery(query),
      ]);

      const docsWithFiles = [...enhancedDocs];
      
      docsWithFiles.push(
        ...filesData.map((fileData) => {
          return new Document({
            pageContent: fileData.content,
            metadata: {
              title: fileData.fileName,
              url: `File`,
              // Добавляем метаданные о поиске
              iterationDetails: searchResult.iterationDetails
            },
          });
        }),
      );

      docEmbeddings.push(...filesData.map((fileData) => fileData.embeddings));

      const similarity = docEmbeddings.map((docEmbedding: number[], i: number) => {
        const sim = computeSimilarity(queryEmbedding, docEmbedding);
        return { index: i, similarity: sim };
      });

      // Сортируем все документы по релевантности, но не ограничиваем их количество
      const qualityThreshold = (this.config.rerankThreshold ?? 0.3); // Снижаем порог для учета большего количества документов
      const sortedDocs = similarity
        .filter((sim: { index: number; similarity: number }) => sim.similarity > qualityThreshold)
        .sort((a: { index: number; similarity: number }, b: { index: number; similarity: number }) => b.similarity - a.similarity)
        // Не ограничиваем количество документов, чтобы вернуть все найденные
        .map((sim: { index: number; similarity: number }) => {
          // Добавляем метаданные с информацией об итерациях в каждый документ
          const doc = docsWithFiles[sim.index];
          if (!doc.metadata.iterationDetails) {
            doc.metadata.iterationDetails = searchResult.iterationDetails;
          }
          return doc;
        });

      return sortedDocs;
    }

    return [];
  }

  private processDocs(docs: Document[]) {
    return docs
      .map(
        (_, index) =>
          `${index + 1}. ${docs[index].metadata.title} ${docs[index].pageContent}`,
      )
      .join('\n');
  }

  private async handleStream(
    stream: AsyncGenerator<StreamEvent, any, any>,
    emitter: EventEmitter,
  ) {
    for await (const event of stream) {
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalSourceRetriever'
      ) {
        // Передаем источники
        emitter.emit(
          'data',
          JSON.stringify({ type: 'sources', data: event.data.output }),
        );
        
        // Проверяем наличие информации об итерациях в первом источнике
        const sources = event.data.output;
        if (sources && sources.length > 0) {
          const firstSource = sources[0];
          if (firstSource && firstSource.metadata && firstSource.metadata.iterationDetails) {
            // Отдельно передаем информацию об итерациях
            emitter.emit(
              'data',
              JSON.stringify({ 
                type: 'iterations', 
                data: firstSource.metadata.iterationDetails 
              }),
            );
          }
        }
      }
      if (
        event.event === 'on_chain_stream' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: event.data.chunk }),
        );
      }
      if (
        event.event === 'on_chain_end' &&
        event.name === 'FinalResponseGenerator'
      ) {
        emitter.emit('end');
      }
    }
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    maxIterations?: number,
  ) {
    console.log('SearchAndAnswer called with maxIterations:', maxIterations, 'optimizationMode:', optimizationMode);
    const emitter = new EventEmitter();

    const answeringChain = await this.createAnsweringChain(
      llm,
      fileIds,
      embeddings,
      optimizationMode,
      systemInstructions,
      maxIterations,
    );

    const stream = answeringChain.streamEvents(
      {
        chat_history: history,
        query: message,
      },
      {
        version: 'v1',
      },
    );

    this.handleStream(stream, emitter);

    return emitter;
  }
}

export default MetaSearchAgent;
