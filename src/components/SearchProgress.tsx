import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface SearchProgressEvent {
  type: 'searchStart' | 'iterationStart' | 'iterationComplete' | 'analysis' | 'queries';
  query?: string;
  maxIterations?: number;
  current?: number;
  total?: number;
  confidence?: number;
  reasoning?: string;
  newDocs?: number;
}

interface SearchProgressProps {
  events: SearchProgressEvent[];
}

export const SearchProgress: React.FC<SearchProgressProps> = ({ events }) => {
  console.log('SearchProgress received events:', events);
  const currentIteration = events.find(e => e.type === 'iterationStart')?.current || 0;
  const maxIterations = events.find(e => e.type === 'searchStart')?.maxIterations || 0;
  const lastAnalysis = events.filter(e => e.type === 'analysis').slice(-1)[0];
  const progress = Math.round((currentIteration / maxIterations) * 100);

  return (
    <Card className="mb-4 border-2 border-primary">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Процесс поиска</span>
            <span className="text-sm text-muted-foreground">
              Итерация {currentIteration} из {maxIterations}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Всего событий: {events.length}
          </div>
          
          <Progress value={progress} className="w-full" />
          
          {lastAnalysis && (
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Последний анализ:</div>
              <div className="text-muted-foreground">
                {lastAnalysis.reasoning}
              </div>
              {lastAnalysis.confidence !== undefined && (
                <div className="mt-2">
                  Уверенность: {Math.round(lastAnalysis.confidence * 100)}%
                </div>
              )}
            </div>
          )}

          {events.filter(e => e.type === 'queries').length > 0 && (
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Дополнительные запросы:</div>
              <ul className="list-disc list-inside text-muted-foreground">
                {events
                  .filter(e => e.type === 'queries' && e.query)
                  .map((e, i) => (
                    <li key={i}>{e.query}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchProgress;
