import { useState, useEffect, useRef, useCallback } from 'react';
import { ApiError } from './api';

export interface UseRateLimitCountdownOptions {
  /**
   * Default message prefix to display before the countdown.
   * e.g. "Too many login attempts. Please try again in"
   */
  defaultPrefix?: string;
  /**
   * Optional callback triggered when the countdown reaches 0 seconds.
   */
  onCountdownComplete?: () => void;
}

export function useRateLimitCountdown(options: UseRateLimitCountdownOptions | string = {}) {
  const defaultPrefix =
    typeof options === 'string' ? options : options.defaultPrefix || 'Too many attempts. Please try again in';
  const onCountdownComplete = typeof options === 'object' ? options.onCountdownComplete : undefined;

  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [currentPrefix, setCurrentPrefix] = useState<string>(defaultPrefix);

  const expiresAtRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    expiresAtRef.current = null;
    setIsRateLimited(false);
    setSecondsRemaining(0);
  }, [clearTimer]);

  const startCountdown = useCallback(
    (seconds: number, prefix?: string) => {
      clearTimer();
      const initialSeconds = Math.max(1, Math.round(seconds));
      expiresAtRef.current = Date.now() + initialSeconds * 1000;
      setCurrentPrefix(prefix || defaultPrefix);
      setSecondsRemaining(initialSeconds);
      setIsRateLimited(true);

      timerRef.current = setInterval(() => {
        if (!expiresAtRef.current) {
          clearTimer();
          return;
        }

        const remaining = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
        setSecondsRemaining(remaining);

        if (remaining <= 0) {
          clearTimer();
          expiresAtRef.current = null;
          setIsRateLimited(false);
          if (onCountdownComplete) {
            onCountdownComplete();
          }
        }
      }, 1000);
    },
    [clearTimer, defaultPrefix, onCountdownComplete]
  );

  /**
   * Intercepts an API error. If it is an HTTP 429 or contains rate-limit metadata,
   * starts a realtime countdown and returns true. Otherwise returns false.
   */
  const handleApiError = useCallback(
    (err: unknown, customPrefix?: string): boolean => {
      let seconds = 0;
      let detectedPrefix = customPrefix || defaultPrefix;

      if (err instanceof ApiError) {
        if (err.status === 429 || (err.retryAfterSeconds && err.retryAfterSeconds > 0)) {
          seconds = err.retryAfterSeconds || 60;
          // Extract prefix from error message if formatted like "... try again in X seconds"
          const match = err.message.match(/^(.*?)(?:try again in|slow down)/i);
          if (match && match[1] && !customPrefix) {
            detectedPrefix = `${match[1].trim()} Please try again in`;
          }
        }
      } else if (err instanceof Error) {
        // Fallback: detect retry-after seconds in error string
        const regexMatch = err.message.match(/(?:try again in|retry after)\s+(\d+)\s*(?:second|sec|s)?/i);
        if (regexMatch && regexMatch[1]) {
          seconds = parseInt(regexMatch[1], 10);
        }
      }

      if (seconds > 0) {
        startCountdown(seconds, detectedPrefix);
        return true;
      }

      return false;
    },
    [defaultPrefix, startCountdown]
  );

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const formattedMessage = isRateLimited
    ? `${currentPrefix} ${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'}.`
    : null;

  return {
    isRateLimited,
    secondsRemaining,
    formattedMessage,
    startCountdown,
    reset,
    handleApiError,
  };
}
