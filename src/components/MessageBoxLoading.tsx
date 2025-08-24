import React from 'react';
import { SearchProgress } from './SearchProgress';
import { cn } from '@/lib/utils';
import { Disc3 } from 'lucide-react';

interface MessageBoxLoadingProps {
  searchEvents?: any[];
  optimizationMode?: string;
}

const MessageBoxLoading = ({ searchEvents, optimizationMode }: MessageBoxLoadingProps) => {
  const isQualityMode = optimizationMode === 'quality';
  const hasSearchEvents = searchEvents && searchEvents.length > 0;

  console.log('MessageBoxLoading:', { optimizationMode, isQualityMode, hasSearchEvents, searchEventsLength: searchEvents?.length });

  return (
    <div className="flex flex-col space-y-6 w-full lg:w-9/12">
      {/* Answer header - скрываем в качественном режиме */}
      <div className={cn("flex flex-col", isQualityMode ? "space-y-4" : "space-y-2")}>
        {!isQualityMode && (
          <div className="flex flex-row items-center space-x-2">
            <Disc3
              className="text-black dark:text-white animate-spin"
              size={20}
            />
            <h3 className="text-black dark:text-white font-medium text-xl">
              Answer
            </h3>
          </div>
        )}

        {/* Search Progress Timeline for Quality Mode */}
        {isQualityMode && (
          <div>
            {hasSearchEvents ? (
              <div className="animate-fadeInUp">
                <SearchProgress events={searchEvents} compact={true} />
              </div>
            ) : (
              <div className="animate-fadeInUp">
                <div className="bg-light-100/50 dark:bg-dark-100/50 border border-light-200 dark:border-dark-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Disc3 className="w-3 h-3 text-white animate-spin" />
                      </div>
                      <div className="absolute inset-0 w-6 h-6 bg-blue-500/30 rounded-full animate-ping" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">Quality Search</p>
                      <p className="text-xs text-black/60 dark:text-white/60">Preparing iterative analysis...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        <div className="flex flex-col space-y-2 bg-light-primary dark:bg-dark-primary animate-pulse rounded-lg py-3 px-4">
          <div className="h-2 rounded-full w-full bg-light-secondary dark:bg-dark-secondary" />
          <div className="h-2 rounded-full w-9/12 bg-light-secondary dark:bg-dark-secondary" />
          <div className="h-2 rounded-full w-10/12 bg-light-secondary dark:bg-dark-secondary" />
        </div>
      </div>
    </div>
  );
};

export default MessageBoxLoading;
