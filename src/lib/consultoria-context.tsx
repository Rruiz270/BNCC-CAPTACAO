"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface Municipality {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
  totalEscolas: number | null;
  totalDocentes: number | null;
  codigoIbge: string | null;
  pctInternet: number | null;
  pctBiblioteca: number | null;
}

interface Session {
  id: number;
  municipalityId: number;
  status: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  municipality?: Municipality;
  complianceProgress?: number;
  actionPlanProgress?: number;
}

interface ConsultoriaContextType {
  sessions: Session[];
  activeSession: Session | null;
  municipality: Municipality | null;
  loading: boolean;
  startSession: (municipalityId: number) => Promise<Session | null>;
  switchSession: (sessionId: number) => void;
  endSession: (sessionId: number) => Promise<void>;
  refreshSessions: () => Promise<Session[]>;
}

const ConsultoriaContext = createContext<ConsultoriaContextType | null>(null);

const STORAGE_KEY = "bncc-active-session-id";
const CUSTOM_EVENT = "bncc-active-session-change";

// --- localStorage as an external store (React 19 pattern) ---

function readActiveSessionId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = parseInt(stored, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function writeActiveSessionId(id: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (id != null) {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Notify same-tab subscribers (storage event only fires cross-tab)
    window.dispatchEvent(new Event(CUSTOM_EVENT));
  } catch {
    // ignore
  }
}

function subscribeActiveSessionId(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(CUSTOM_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CUSTOM_EVENT, callback);
  };
}

function getServerSnapshot(): number | null {
  return null;
}

export function ConsultoriaProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // localStorage-backed, SSR-safe, no setState-in-effect
  const activeSessionId = useSyncExternalStore(
    subscribeActiveSessionId,
    readActiveSessionId,
    getServerSnapshot,
  );

  const setActiveSessionId = useCallback((id: number | null) => {
    writeActiveSessionId(id);
  }, []);

  // Derived: use stored id if valid+active, else fall back to most recent active
  const activeSession = useMemo<Session | null>(() => {
    if (activeSessionId != null) {
      const chosen = sessions.find((s) => s.id === activeSessionId);
      if (chosen && chosen.status === "active") return chosen;
    }
    return sessions.find((s) => s.status === "active") ?? null;
  }, [sessions, activeSessionId]);

  const municipality = activeSession?.municipality ?? null;

  const refreshSessions = useCallback(async (): Promise<Session[]> => {
    try {
      const res = await fetch("/api/consultorias");
      if (!res.ok) return [];
      const data = await res.json();
      const list = data.sessions || [];
      setSessions(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Mount: load sessions from API.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legit "fetch on mount"; setLoading(false) only runs inside the async .finally callback
    refreshSessions().finally(() => setLoading(false));
  }, [refreshSessions]);

  const startSession = useCallback(
    async (municipalityId: number): Promise<Session | null> => {
      try {
        const res = await fetch("/api/consultorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ municipalityId }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const newId = (data.session as Session).id;
        const updated = await refreshSessions();
        const full = updated.find((s) => s.id === newId) ?? null;
        setActiveSessionId(newId);
        return full;
      } catch {
        return null;
      }
    },
    [refreshSessions, setActiveSessionId],
  );

  const switchSession = useCallback(
    (sessionId: number) => {
      setActiveSessionId(sessionId);
    },
    [setActiveSessionId],
  );

  const endSession = useCallback(
    async (sessionId: number) => {
      try {
        await fetch(`/api/consultorias/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        await refreshSessions();
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      } catch {
        // ignore
      }
    },
    [activeSessionId, refreshSessions, setActiveSessionId],
  );

  return (
    <ConsultoriaContext.Provider
      value={{
        sessions,
        activeSession,
        municipality,
        loading,
        startSession,
        switchSession,
        endSession,
        refreshSessions,
      }}
    >
      {children}
    </ConsultoriaContext.Provider>
  );
}

export function useConsultoria() {
  const ctx = useContext(ConsultoriaContext);
  if (!ctx) throw new Error("useConsultoria must be used within ConsultoriaProvider");
  return ctx;
}
