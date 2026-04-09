"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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

export function ConsultoriaProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const municipality = activeSession?.municipality ?? null;

  // Load sessions from API
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

  // On mount: restore active session from localStorage and load sessions
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setActiveSessionId(parseInt(stored, 10));
    }
    refreshSessions().finally(() => setLoading(false));
  }, [refreshSessions]);

  // Auto-select: if stored id doesn't match any session, pick the most recent active one
  useEffect(() => {
    if (loading || sessions.length === 0) return;
    const current = sessions.find((s) => s.id === activeSessionId);
    if (!current || current.status !== "active") {
      const mostRecent = sessions.find((s) => s.status === "active");
      setActiveSessionId(mostRecent?.id ?? null);
    }
  }, [loading, sessions, activeSessionId]);

  // Persist active session to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEY, String(activeSessionId));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeSessionId]);

  const startSession = useCallback(async (municipalityId: number): Promise<Session | null> => {
    try {
      const res = await fetch("/api/consultorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipalityId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newId = (data.session as Session).id;
      // Refresh sessions first, then set active so the session data is available
      const updated = await refreshSessions();
      const full = updated.find((s) => s.id === newId) ?? null;
      setActiveSessionId(newId);
      return full;
    } catch {
      return null;
    }
  }, [refreshSessions]);

  const switchSession = useCallback((sessionId: number) => {
    setActiveSessionId(sessionId);
  }, []);

  const endSession = useCallback(async (sessionId: number) => {
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
  }, [activeSessionId, refreshSessions]);

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
