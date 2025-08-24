import React, { useState, useEffect, useRef } from 'react';
import { Search, Clock, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SearchProgressEvent {
  type: 'searchStart' | 'iterationStart' | 'iterationComplete' | 'analysis' | 'queries' | 'searchComplete';
  timestamp: number;
  current?: number;
  total?: number;
  maxIterations?: number;
  reasoning?: string;
  query?: string;
  newDocs?: number;
  confidence?: number;
  totalDocuments?: number;
  totalIterations?: number;
}

interface SearchProgressProps {
  events: SearchProgressEvent[];
  compact?: boolean;
  loading?: boolean;
}

export const SearchProgress: React.FC<SearchProgressProps> = ({ events, compact = false, loading = false }) => {
  console.log('SearchProgress received events:', events);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNewEvent, setIsNewEvent] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastEventRef = useRef<HTMLDivElement>(null);
  const prevEventsLength = useRef(events.length);
  
  const currentIteration = events.find(e => e.type === 'iterationStart')?.current || 0;
  const maxIterations = events.find(e => e.type === 'searchStart')?.maxIterations || 0;
  const lastAnalysis = events.filter(e => e.type === 'analysis').slice(-1)[0];
  
  // Enhanced progress calculation logic
  const calculateProgress = () => {
    if (maxIterations === 0) return 0;
    
    // Check if there's a search completion event
    const searchCompleteEvent = events.find(e => e.type === 'searchComplete');
    if (searchCompleteEvent) {
      return 100;
    }
    
    // Find all completed iterations
    const completedIterations = events.filter(e => e.type === 'iterationComplete');
    const maxCompletedIteration = Math.max(0, ...completedIterations.map(e => e.current || 0));
    
    // If there are completed iterations, use the maximum one
    if (completedIterations.length > 0) {
      // If the last iteration is completed, progress is 100%
      if (maxCompletedIteration >= maxIterations) {
        return 100;
      }
      // Otherwise calculate based on completed iterations
      return Math.round((maxCompletedIteration / maxIterations) * 100);
    }
    
    // If no completed iterations, use current iteration
    return Math.round((currentIteration / maxIterations) * 100);
  };
  
  const progress = calculateProgress();

  // Automatic scroll to last event when events are updated
  useEffect(() => {
    // Check if new events have been added
    if (events.length > prevEventsLength.current) {
      setIsNewEvent(true);
      prevEventsLength.current = events.length;
      
      // Remove new event indication after a short time
      const highlightTimer = setTimeout(() => {
        setIsNewEvent(false);
      }, 1000);

      if (!isCollapsed && lastEventRef.current) {
        // Small delay to allow time for rendering the new element
        const scrollTimer = setTimeout(() => {
          lastEventRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        }, 100);

        return () => {
          clearTimeout(highlightTimer);
          clearTimeout(scrollTimer);
        };
      }

      return () => clearTimeout(highlightTimer);
    }
  }, [events.length, isCollapsed]);

  // Scroll to last event when expanding timeline
  useEffect(() => {
    if (!isCollapsed && events.length > 0 && lastEventRef.current) {
      // Delay for completion of expand animation
      const timer = setTimeout(() => {
        lastEventRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 300); // 300ms corresponds to CSS transition time

      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  const getEventIcon = (event: SearchProgressEvent | { type: 'grouped-queries' }) => {
    switch (event.type) {
      case 'searchStart':
        return Search;
      case 'iterationStart':
        return Loader2;
      case 'iterationComplete':
        return CheckCircle;
      case 'analysis':
        return Clock;
      case 'queries':
      case 'grouped-queries':
        return Search;
      case 'searchComplete':
        return CheckCircle;
      default:
        return Clock;
    }
  };

  const getEventTitle = (event: SearchProgressEvent | { type: 'grouped-queries', queries: SearchProgressEvent[] }) => {
    switch (event.type) {
      case 'searchStart':
        return 'Search Started';
      case 'iterationStart':
        return `Iteration ${(event as SearchProgressEvent).current}`;
      case 'iterationComplete':
        return `Iteration ${(event as SearchProgressEvent).current} Complete`;
      case 'analysis':
        return 'Results Analysis';
      case 'queries':
        return 'Additional Query';
      case 'grouped-queries':
        return 'Additional Queries';
      case 'searchComplete':
        return 'Search Complete';
      default:
        return 'Search Event';
    }
  };

  const getEventDescription = (event: SearchProgressEvent | { type: 'grouped-queries', queries: SearchProgressEvent[] }) => {
    switch (event.type) {
      case 'searchStart':
        return `Quality search launched with maximum ${(event as SearchProgressEvent).maxIterations} iterations`;
      case 'iterationStart':
        return `Executing iteration ${(event as SearchProgressEvent).current} of ${(event as SearchProgressEvent).total}`;
      case 'iterationComplete':
        return (event as SearchProgressEvent).newDocs ? `Found ${(event as SearchProgressEvent).newDocs} new documents` : 'Iteration completed';
      case 'analysis':
        return (event as SearchProgressEvent).reasoning || 'Analyzing search results quality';
      case 'queries':
        return (event as SearchProgressEvent).query || 'Executing additional search query';
      case 'grouped-queries':
        return `Executing ${(event as { queries: SearchProgressEvent[] }).queries.length} additional search queries`;
      case 'searchComplete':
        return `Found ${(event as SearchProgressEvent).totalDocuments || 0} documents in ${(event as SearchProgressEvent).totalIterations || 0} iterations`;
      default:
        return 'Processing search event';
    }
  };

  // Group events, combining multiple queries events into one
  const groupEvents = (events: SearchProgressEvent[]) => {
    const grouped: (SearchProgressEvent | { type: 'grouped-queries', queries: SearchProgressEvent[], timestamp: number })[] = [];
    let currentQueries: SearchProgressEvent[] = [];
    
    events.forEach((event, index) => {
      if (event.type === 'queries') {
        currentQueries.push(event);
        // If this is the last event or next event is not queries, group them
        if (index === events.length - 1 || events[index + 1]?.type !== 'queries') {
          if (currentQueries.length > 0) {
            grouped.push({
              type: 'grouped-queries',
              queries: [...currentQueries],
              timestamp: currentQueries[0].timestamp
            });
            currentQueries = [];
          }
        }
      } else {
        // If we have pending queries, add them first
        if (currentQueries.length > 0) {
          grouped.push({
            type: 'grouped-queries',
            queries: [...currentQueries],
            timestamp: currentQueries[0].timestamp
          });
          currentQueries = [];
        }
        grouped.push(event);
      }
    });
    
    return grouped;
  };

  // Check if event is between iteration start and complete
  const isEventBetweenIterations = (events: (SearchProgressEvent | { type: 'grouped-queries', queries: SearchProgressEvent[], timestamp: number })[], currentIndex: number) => {
    const event = events[currentIndex];
    
    // Skip if this is an iteration event itself
    if (isIterationEvent(event)) return false;
    
    // Look backwards for the nearest iteration start
    let hasIterationStart = false;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevEvent = events[i];
      if (prevEvent.type === 'iterationComplete') {
        // If we hit a complete before a start, we're not between iterations
        break;
      }
      if (prevEvent.type === 'iterationStart') {
        hasIterationStart = true;
        break;
      }
    }
    
    // Look forwards for the nearest iteration complete
    let hasIterationComplete = false;
    for (let i = currentIndex + 1; i < events.length; i++) {
      const nextEvent = events[i];
      if (nextEvent.type === 'iterationStart') {
        // If we hit a start before a complete, we're not between iterations
        break;
      }
      if (nextEvent.type === 'iterationComplete') {
        hasIterationComplete = true;
        break;
      }
    }
    
    return hasIterationStart && hasIterationComplete;
  };

  // Check if event is an iteration milestone
  const isIterationEvent = (event: SearchProgressEvent | { type: 'grouped-queries' }) => {
    return event.type === 'iterationStart' || event.type === 'iterationComplete';
  };

  // Get special styling for iteration events (more subtle/flat)
  const getIterationEventStyle = (event: SearchProgressEvent | { type: 'grouped-queries' }) => {
    if (!isIterationEvent(event)) return {};
    
    return {
      backgroundColor: 'rgba(148, 163, 184, 0.05)', // Very subtle gray background
      borderLeft: `2px solid rgba(148, 163, 184, 0.3)` // Muted gray border
    };
  };

  // Generate random color for badges
  const getBadgeColor = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    ];
    return colors[index % colors.length];
  };

  const isEventActive = (event: SearchProgressEvent, index: number) => {
    // Analysis is always active if it's the last event
    if (event.type === 'analysis' && index === events.length - 1) return true;
    
    // Check that current iteration is not yet completed
    if (event.type === 'iterationStart') {
      const hasCompletionAfter = events.slice(index + 1).some(e => 
        e.type === 'iterationComplete' && e.current === event.current
      );
      return !hasCompletionAfter;
    }
    
    // Search start is active only at the very beginning
    if (event.type === 'searchStart' && events.length === 1) return true;
    
    return false;
  };

  const getEventColor = (event: SearchProgressEvent | { type: 'grouped-queries' }, isActive: boolean) => {
    if (isActive) {
      switch (event.type) {
        case 'searchStart':
          return 'from-blue-500 to-blue-600';
        case 'iterationStart':
          return 'from-purple-500 to-purple-600';
        case 'analysis':
          return 'from-pink-500 to-pink-600';
        case 'queries':
        case 'grouped-queries':
          return 'from-orange-500 to-orange-600';
        default:
          return 'from-gray-500 to-gray-600';
      }
    }
    
    switch (event.type) {
      case 'iterationComplete':
        return 'from-green-500 to-green-600';
      case 'searchComplete':
        return 'from-green-600 to-green-700';
      case 'grouped-queries':
        return 'from-orange-400 to-orange-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <Card className={cn(
      "border border-light-200 dark:border-dark-200 overflow-hidden",
      compact 
        ? "mb-2 bg-light-100/50 dark:bg-dark-100/50" 
        : "mb-4 bg-light-50 dark:bg-dark-50"
    )}>
      <CardContent className="p-0">
        {/* Header - clickable for collapsing */}
        <div 
          className={cn(
            "bg-gradient-to-r from-light-100 to-light-200 dark:from-dark-100 dark:to-dark-200 border-b border-light-200 dark:border-dark-200 cursor-pointer",
            compact ? "px-4 py-3" : "px-6 py-4"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className={cn(
                  "bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg",
                  compact ? "w-6 h-6" : "w-8 h-8"
                )}>
                  <Search className={cn("text-white", compact ? "w-3 h-3" : "w-4 h-4")} />
                </div>
                <div className={cn(
                  "absolute inset-0 bg-blue-500/30 rounded-full animate-ping",
                  compact ? "w-6 h-6" : "w-8 h-8"
                )} />
              </div>
              <div>
                <h3 className={cn(
                  "font-medium text-dark-900 dark:text-light-100",
                  compact ? "text-sm" : "text-base"
                )}>
                  Quality Search Progress
                </h3>
                <p className={cn(
                  "text-dark-600 dark:text-light-400",
                  compact ? "text-xs" : "text-sm"
                )}>
                  Iteration {currentIteration} of {maxIterations}
                </p>
              </div>
            </div>
            
            {/* Progress bar and collapse icon */}
            <div className="flex items-center space-x-4">
              <div className={cn(
                "flex flex-col items-end space-y-1",
                compact ? "min-w-[80px]" : "min-w-[100px]"
              )}>
                <div className="flex items-center space-x-2">
                  <span className={cn(
                    "text-dark-700 dark:text-light-300 font-medium",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {progress}%
                  </span>
                  <div className={cn(
                    "bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden",
                    compact ? "w-12 h-1" : "w-16 h-2"
                  )}>
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  "text-dark-500 dark:text-light-500",
                  compact ? "text-xs" : "text-xs"
                )}>
                  {events.some(e => e.type === 'searchComplete') ? 'Completed' : 'Processing...'}
                </span>
              </div>
              
              {/* Collapse icon */}
              <button className="text-dark-600 dark:text-light-400 hover:text-dark-900 dark:hover:text-light-100 transition-colors">
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Timeline content - hidden when collapsed */}
        {!isCollapsed && (
          <div className={cn("px-4 py-3", compact ? "" : "px-6 py-4")}>
            {lastAnalysis?.confidence && (
              <div className={cn(
                "mb-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700",
                compact ? "text-xs" : "text-sm"
              )}>
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Confidence Score: {Math.round(lastAnalysis.confidence * 100)}%
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between text-sm text-black/60 dark:text-white/60 mb-2">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3" ref={timelineRef}>
              {events.length === 0 ? (
                <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Launching quality search...
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      Waiting for search events
                    </div>
                  </div>
                </div>
              ) : (
                groupEvents(events).map((event, index) => {
                  const Icon = getEventIcon(event);
                  const isActive = event.type === 'grouped-queries' ? false : isEventActive(event as SearchProgressEvent, index);
                  const colorClass = getEventColor(event, isActive);
                  const isLastEvent = index === groupEvents(events).length - 1;
                  const isIteration = isIterationEvent(event);
                  const iterationStyle = getIterationEventStyle(event);
                  const isBetweenIterations = isEventBetweenIterations(groupEvents(events), index);
                  
                  return (
                    <div 
                      key={event.type === 'grouped-queries' ? `grouped-queries-${event.timestamp}` : `${event.type}-${event.timestamp}-${index}`}
                      ref={isLastEvent ? lastEventRef : null}
                      className={cn(
                        "relative flex items-start timeline-enter rounded-lg transition-all duration-300",
                        compact ? "p-2" : "p-3",
                        isLastEvent && isNewEvent && "animate-pulse",
                        // Add left margin and subtle background for events between iterations
                        isBetweenIterations ? "ml-6 pl-4 space-x-3 bg-blue-50/20 dark:bg-blue-900/10" : "space-x-3"
                      )}
                      style={{
                        animationDelay: `${index * 0.1}s`,
                        ...iterationStyle
                      }}
                    >
                      
                      {/* Connecting line */}
                      {index < groupEvents(events).length - 1 && (
                        <>
                          {/* Main connecting line */}
                          <div className={cn(
                            "absolute left-4 mt-8 w-0.5 bg-gradient-to-b from-light-300 to-transparent dark:from-dark-300",
                            compact ? "h-8" : "h-10"
                          )} />
                        </>
                      )}
                      
                      {/* Event icon */}
                      <div className="flex-shrink-0 relative z-10">
                        <div className={cn(
                          `bg-gradient-to-br ${colorClass} rounded-full flex items-center justify-center transition-all duration-300`,
                          // Same size for all events - no special sizing for iterations
                          compact ? "w-6 h-6" : "w-8 h-8",
                          isActive && "ring-2 ring-blue-300 dark:ring-blue-600",
                          // Remove extra effects for iterations - just subtle shadow
                          isIteration && "shadow-sm"
                        )}>
                          <Icon className={cn(
                            "text-white",
                            // Same size for all event icons
                            compact ? "w-3 h-3" : "w-4 h-4",
                            isActive && (event as SearchProgressEvent).type === 'iterationStart' && "animate-spin"
                          )} />
                        </div>
                        
                        {/* Pulsing animation for active events */}
                        {isActive && (
                          <div className={cn(
                            "absolute inset-0 bg-blue-500/30 rounded-full animate-ping",
                            // Same size for all events
                            compact ? "w-6 h-6" : "w-8 h-8"
                          )} />
                        )}
                      </div>
                      
                      {/* Event content */}
                      <div className="flex-grow min-w-0">
                        <div className={cn(
                          "font-medium text-dark-900 dark:text-light-100",
                          compact ? "text-sm" : "text-base",
                          // More subtle styling for iteration titles
                          isIteration && "text-gray-600 dark:text-gray-400 font-normal text-sm"
                        )}>
                          <div className="flex items-center gap-2">
                            {getEventTitle(event)}
                            {/* Subtle badge for iteration events */}
                            {isIteration && (
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-normal",
                                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              )}>
                                {event.type === 'iterationStart' ? 'start' : 'done'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "text-dark-600 dark:text-light-400 mt-1",
                          compact ? "text-xs" : "text-sm"
                        )}>
                          {getEventDescription(event)}
                        </div>
                        
                        {/* Query badges for grouped queries */}
                        {event.type === 'grouped-queries' && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(event as { queries: SearchProgressEvent[] }).queries.map((query, queryIndex) => (
                              <span
                                key={queryIndex}
                                className={cn(
                                  "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                  getBadgeColor(queryIndex)
                                )}
                              >
                                {query.query || `Query ${queryIndex + 1}`}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Timestamp */}
                        <div className={cn(
                          "text-dark-500 dark:text-light-500 mt-1",
                          compact ? "text-xs" : "text-xs"
                        )}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
