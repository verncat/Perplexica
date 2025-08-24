import { useState, useEffect } from 'react';
import { SearchProgressEvent } from '../components/SearchProgress';

export function useSearchProgress(enabled: boolean) {
  const [searchEvents, setSearchEvents] = useState<SearchProgressEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      // Не сбрасываем события сразу, оставляем для отображения
      return;
    }

    const eventSource = new EventSource('/api/chat/progress');
    console.log('Opening EventSource connection');
    
    const handleMessage = (event: MessageEvent) => {
      console.log('Raw event received:', event);
      try {
        const data = JSON.parse(event.data);
        console.log('Parsed event data:', data);
        if (data.event === 'searchProgress') {
          const eventWithTimestamp = {
            ...data.data,
            timestamp: data.data.timestamp || Date.now()
          };
          setSearchEvents(prev => {
            const newEvents = [...prev, eventWithTimestamp];
            console.log('Updated search events:', newEvents);
            return newEvents;
          });
        }
      } catch (error) {
        console.error('Error processing event:', error);
      }
    };

    eventSource.addEventListener('message', handleMessage);
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    eventSource.onopen = () => {
      console.log('EventSource connection opened');
    };

    return () => {
      console.log('Closing EventSource connection');
      eventSource.removeEventListener('message', handleMessage);
      eventSource.close();
    };
  }, [enabled]);

  // Reset events only when starting a new search
  useEffect(() => {
    if (enabled) {
      setSearchEvents([]);
    }
  }, [enabled]);

  return searchEvents;
}
