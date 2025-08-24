'use client';

import React, { useState, useEffect } from 'react';
import { SearchProgress, SearchProgressEvent } from '@/components/SearchProgress';
import { Card, CardContent } from '@/components/ui/card';

const SearchProgressDemo = () => {
  const [events, setEvents] = useState<SearchProgressEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const demoEvents: Omit<SearchProgressEvent, 'timestamp'>[] = [
    {
      type: 'searchStart',
      query: 'Comparison table of temperature sensors on i2c',
      maxIterations: 2
    },
    {
      type: 'iterationStart',
      current: 1,
      total: 2
    },
    {
      type: 'analysis',
      confidence: 0.4,
      reasoning: 'The current search results contain several relevant documents about temperature sensors and some mention I2C, but they lack a comprehensive comparison table specifically for I2C temperature sensors.'
    },
    {
      type: 'queries',
      query: 'I2C temperature sensor comparison table',
      current: 1,
      total: 5
    },
    {
      type: 'queries',
      query: 'I2C temp sensor specs comparison',
      current: 2,
      total: 5
    },
    {
      type: 'queries',
      query: 'digital I2C temperature sensors comparison',
      current: 3,
      total: 5
    },
    {
      type: 'iterationComplete',
      current: 1,
      total: 2,
      newDocs: 99
    },
    {
      type: 'iterationStart',
      current: 2,
      total: 2
    },
    {
      type: 'analysis',
      confidence: 0.4,
      reasoning: 'The current search results provide some relevant information about temperature sensors with I2C interface, but they lack a comprehensive comparison table specifically for I2C temperature sensors.'
    },
    {
      type: 'queries',
      query: 'I2C temperature sensor datasheet comparison',
      current: 1,
      total: 3
    },
    {
      type: 'iterationComplete',
      current: 2,
      total: 2,
      newDocs: 19
    }
  ];

  const runDemo = () => {
    setIsRunning(true);
    setEvents([]);
    
    const startTime = Date.now();
    
    demoEvents.forEach((event, index) => {
      setTimeout(() => {
        const eventWithTimestamp = {
          ...event,
          timestamp: startTime + (index * 1000)
        };
        setEvents(prev => [...prev, eventWithTimestamp]);
        
        if (index === demoEvents.length - 1) {
          setIsRunning(false);
        }
      }, index * 1000);
    });
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-4">
          SearchProgress Timeline Demo
        </h1>
        <p className="text-black/70 dark:text-white/70 mb-6">
          Демонстрация нового Timeline компонента для отображения прогресса итеративного поиска в качественном режиме.
        </p>
        
        <button
          onClick={runDemo}
          disabled={isRunning}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200"
        >
          {isRunning ? 'Демо запущено...' : 'Запустить демо'}
        </button>
      </div>

      <div className="space-y-8">
        {/* Полная версия */}
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
            Полная версия (для главной страницы)
          </h2>
          {events.length > 0 && (
            <SearchProgress events={events} compact={false} />
          )}
        </div>

        {/* Компактная версия */}
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
            Компактная версия (для блока ответа)
          </h2>
          {events.length > 0 && (
            <Card className="border border-light-200 dark:border-dark-200">
              <CardContent className="p-6">
                <div className="flex flex-col space-y-2">
                  <div className="flex flex-row items-center space-x-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full animate-pulse"></div>
                    <h3 className="text-black dark:text-white font-medium text-xl">
                      Answer
                    </h3>
                  </div>
                  
                  <SearchProgress events={events} compact={true} />
                  
                  <div className="mt-4 p-4 bg-light-100 dark:bg-dark-100 rounded-lg">
                    <p className="text-black/80 dark:text-white/80">
                      Здесь будет отображаться ответ AI. Timeline появляется во время загрузки 
                      и автоматически сворачивается после завершения поиска.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Описание особенностей */}
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
            Особенности реализации
          </h2>
          <Card className="border border-light-200 dark:border-dark-200">
            <CardContent className="p-6">
              <div className="space-y-4 text-black/80 dark:text-white/80">
                <div>
                  <h4 className="font-medium text-black dark:text-white mb-2">✨ Анимации</h4>
                  <p>Плавные появления элементов с задержкой, пульсация активных состояний, вращение иконок</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-black dark:text-white mb-2">🎨 Визуальные эффекты</h4>
                  <p>Градиенты, тени, эффекты hover, индикаторы уверенности с прогресс-барами</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-black dark:text-white mb-2">📱 Адаптивность</h4>
                  <p>Компактная версия для интеграции в блок ответа, возможность сворачивания</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-black dark:text-white mb-2">⚡ Реалтайм обновления</h4>
                  <p>События SSE через WebSocket, живые обновления прогресса и состояния</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-black dark:text-white mb-2">🌙 Тёмная тема</h4>
                  <p>Полная поддержка светлой и тёмной темы с красивыми переходами</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SearchProgressDemo;
