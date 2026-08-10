"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Person } from "@/lib/types";

const STORAGE_KEY = "hij-cue-me";

type MeContextValue = {
  meId: string | null;
  me: Person | null;
  setMeId: (id: string | null) => void;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({
  people,
  children,
}: {
  people: Person[];
  children: React.ReactNode;
}) {
  const [meId, setMeIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && people.some((p) => p.id === stored)) {
      setMeIdState(stored);
    }
  }, [people]);

  const setMeId = (id: string | null) => {
    setMeIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      meId,
      me: people.find((p) => p.id === meId) ?? null,
      setMeId,
    }),
    [meId, people]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used within MeProvider");
  return ctx;
}
