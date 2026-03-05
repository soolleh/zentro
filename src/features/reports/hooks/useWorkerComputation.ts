/**
 * useWorkerComputation.ts
 *
 * Generic hook that abstracts Worker lifecycle: create, message, terminate.
 * Reused by both yearly and anomaly computation paths.
 */

import { useRef, useCallback } from 'react';

type WorkerState = {
  worker: Worker | null;
};

type UseWorkerComputationOptions<TOutput> = {
  workerFactory: () => Worker;
  onMessage: (data: TOutput) => void;
  onError?: (error: ErrorEvent) => void;
};

type UseWorkerComputationReturn<TInput> = {
  post: (data: TInput) => void;
  terminate: () => void;
};

/**
 * Manages a single Worker instance. Terminates the previous worker
 * before creating a new one on each `post` call (prevents stale results).
 */
export function useWorkerComputation<TInput, TOutput>(
  options: UseWorkerComputationOptions<TOutput>
): UseWorkerComputationReturn<TInput> {
  const { workerFactory, onMessage, onError } = options;
  const ref = useRef<WorkerState>({ worker: null });

  const terminate = useCallback(() => {
    if (ref.current.worker) {
      ref.current.worker.terminate();
      ref.current.worker = null;
    }
  }, []);

  const post = useCallback(
    (data: TInput) => {
      // Terminate any in-flight computation
      terminate();

      const worker = workerFactory();
      ref.current.worker = worker;

      worker.onmessage = (e: MessageEvent<TOutput>) => {
        onMessage(e.data);
        worker.terminate();
        ref.current.worker = null;
      };

      worker.onerror = (err: ErrorEvent) => {
        onError?.(err);
        worker.terminate();
        ref.current.worker = null;
      };

      worker.postMessage(data);
    },
    [workerFactory, onMessage, onError, terminate]
  );

  return { post, terminate };
}
