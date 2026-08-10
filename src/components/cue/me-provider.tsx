"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { Person } from "@/lib/types";

const STORAGE_KEY = "hij-cue-me";
const ME_EVENT = "hij-cue-me";

type MeContextValue = {
  meId: string | null;
  me: Person | null;
  setMeId: (id: string | null) => void;
};

const MeContext = createContext<MeContextValue | null>(null);

function subscribeMe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ME_EVENT, onStoreChange);
  };
}

function readStoredMeId(people: Person[]): string | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && people.some((p) => p.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

export function MeProvider({
  people,
  children,
}: {
  people: Person[];
  children: React.ReactNode;
}) {
  const meId = useSyncExternalStore(
    subscribeMe,
    () => readStoredMeId(people),
    () => null
  );

  const setMeId = useCallback((id: string | null) => {
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(ME_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      meId,
      me: people.find((p) => p.id === meId) ?? null,
      setMeId,
    }),
    [meId, people, setMeId]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within MeProvider");
  return ctx;
}
