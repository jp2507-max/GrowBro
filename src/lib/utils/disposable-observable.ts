import { Observable } from 'rxjs';

/**
 * Disposable Observable Utility
 *
 * Provides a reusable pattern for creating RxJS observables with proper disposal safety.
 * This eliminates duplication across nutrient engine services.
 */
export function createDisposableObservable<T>(
  subscribe: (
    onNext: (value: T) => void,
    onError: (error: unknown) => void,
    isDisposed: () => boolean
  ) => Promise<{ unsubscribe: () => void } | undefined>
): Observable<T> {
  return new Observable((subscriber) => {
    let isDisposed = false;
    let subscription: { unsubscribe: () => void } | undefined;

    void subscribe(
      (value) => {
        if (!isDisposed) subscriber.next(value);
      },
      (error) => {
        if (!isDisposed) subscriber.error(error);
      },
      () => isDisposed
    )
      .then((sub) => {
        if (isDisposed) {
          sub?.unsubscribe();
          return;
        }

        subscription = sub;
      })
      .catch((error) => {
        if (!isDisposed) subscriber.error(error);
      });

    return () => {
      isDisposed = true;
      subscription?.unsubscribe();
    };
  });
}
