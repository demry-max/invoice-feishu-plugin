import { useState, useEffect } from "react";

const NAMESPACE = "invoice-generator:";

/**
 * useState that also persists to window.localStorage. Restores on mount.
 * Errors (private mode, quota) degrade silently — behaves like normal useState.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const fullKey = NAMESPACE + key;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // ignore quota / private-mode errors
    }
  }, [fullKey, value]);

  return [value, setValue];
}
