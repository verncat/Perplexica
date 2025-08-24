/* eslint-disable @next/next/no-img-element */
'use client';

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Search, RefreshCcwDot } from 'lucide-react';
import { Fragment, useState } from 'react';

interface IterationDetail {
  iteration: number;
  query: string;
  analysis?: string;
}

const SearchIterations = ({ 
  iterationDetails 
}: { 
  iterationDetails?: IterationDetail[] 
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  if (!iterationDetails || iterationDetails.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4">
      <button
        onClick={openModal}
        className="flex items-center space-x-2 text-sm px-3 py-1.5 rounded-lg bg-light-100 dark:bg-dark-100 hover:bg-light-200 dark:hover:bg-dark-200 text-black/70 dark:text-white/70"
      >
        <RefreshCcwDot size={14} />
        <span>Search completed in {iterationDetails.length} iterations</span>
      </button>

      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-200"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-2xl transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 text-black dark:text-white flex items-center space-x-2">
                    <Search size={20} />
                    <span>Iterative Search Details</span>
                  </DialogTitle>
                  <div className="mt-4 overflow-auto max-h-[500px] pr-2">
                    <div className="space-y-4">
                      {iterationDetails.map((detail, index) => (
                        <div 
                          key={index} 
                          className="bg-light-100 dark:bg-dark-100 rounded-lg p-4 border border-light-200 dark:border-dark-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-black dark:text-white text-md">
                              Iteration {detail.iteration}
                            </h3>
                            {index === iterationDetails.length - 1 && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full">
                                Final
                              </span>
                            )}
                          </div>
                          
                          <div className="mb-2">
                            <h4 className="text-xs text-black/60 dark:text-white/60 mb-1">Query:</h4>
                            <div className="bg-light-secondary dark:bg-dark-secondary p-2 rounded border border-light-200 dark:border-dark-200 text-sm text-black dark:text-white">
                              {detail.query}
                            </div>
                          </div>

                          {detail.analysis && (
                            <div>
                              <h4 className="text-xs text-black/60 dark:text-white/60 mb-1">Analysis:</h4>
                              <div className="bg-light-secondary dark:bg-dark-secondary p-2 rounded border border-light-200 dark:border-dark-200 text-sm text-black/80 dark:text-white/80">
                                {detail.analysis}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default SearchIterations;
