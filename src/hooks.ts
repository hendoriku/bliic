import { useEffect, useState } from "react";

/** useState yang diingat di localStorage. Aman bila storage kosong/diblokir; nilai tak valid diabaikan. */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null;
      return v && allowed.includes(v) ? v : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* abaikan */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
