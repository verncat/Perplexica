import { NextRequest } from 'next/server';
import { eventEmitter } from '@/lib/search/metaSearchAgent';

export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const listener = (data: any) => {
    try {
      const event = {
        event: 'searchProgress',
        data: data
      };
      console.log('Progress route received event:', event);
      
      // Форматируем данные в соответствии с SSE спецификацией
      const message = `data: ${JSON.stringify(event)}\n\n`;
      writer.write(encoder.encode(message));
    } catch (error) {
      console.error('Error in progress listener:', error);
    }
  };

  eventEmitter.on('searchProgress', listener);

  req.signal.addEventListener('abort', () => {
    eventEmitter.off('searchProgress', listener);
    writer.close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    },
  });
}
