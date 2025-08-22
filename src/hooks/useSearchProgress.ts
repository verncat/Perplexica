import { useState, useEffect } from 'react';
import { SearchProgressEvent } from '../components/SearchProgress';

export function useSearchProgress(enabled: boolean) {
  const [searchEvents, setSearchEvents] = useState<SearchProgressEvent[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSearchEvents([]);
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
          setSearchEvents(prev => {
            const newEvents = [...prev, data.data];
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

  return searchEvents;
}
