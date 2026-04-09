"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { COMPLIANCE_SECTIONS } from "@/lib/constants";

type ItemStatus = "pending" | "progress" | "done";

interface ItemState {
  checked: boolean;
  status: ItemStatus;
  notes: string;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluido", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: ItemStatus[] = ["pending", "progress", "done"];

export default function ComplianceSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { activeSession, municipality } = useConsultoria();
  const municipalityId = activeSession?.municipalityId;

  const section = COMPLIANCE_SECTIONS.find((s) => s.id === slug.toUpperCase());

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load items from DB
  useEffect(() => {
    if (!section) return;
    if (!municipalityId) {
      // Initialize from constants with default state
      const initial: Record<string, ItemState> = {};
      for (const item of section.items) {
        initial[item.key] = { checked: false, status: "pending", notes: "" };
      }
      setItemStates(initial);
      setLoaded(true);
      return;
    }

    fetch(`/api/compliance/${section.id}?municipalityId=${municipalityId}`)
      .then((r) => r.json())
      .then((data) => {
        const states: Record<string, ItemState> = {};
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            states[item.itemKey] = {
              checked: item.status === "done",
              status: item.status as ItemStatus,
              notes: item.notes || "",
            };
          }
        } else {
          // Fallback to constants
          for (const item of section.items) {
            states[item.key] = { checked: false, status: "pending", notes: "" };
          }
        }
        setItemStates(states);
      })
      .catch(() => {
        const initial: Record<string, ItemState> = {};
        for (const item of section.items) {
          initial[item.key] = { checked: false, status: "pending", notes: "" };
        }
        setItemStates(initial);
      })
      .finally(() => setLoaded(true));
  }, [section, municipalityId]);

  // Debounced save to DB
  const saveToDb = useCallback(
    (states: Record<string, ItemState>) => {
      if (!municipalityId || !section) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSaving(true);
        const items = Object.entries(states).map(([key, val]) => ({
          itemKey: key,
          status: val.status,
          notes: val.notes,
        }));
        fetch("/api/compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ municipalityId, items }),
        })
          .catch(() => {})
          .finally(() => setSaving(false));
      }, 500);
    },
    [municipalityId, section]
  );

  if (!section) {
    return (
      <div>
        <PageHeader title="Secao nao encontrada" />
        <div className="max-w-7xl mx-auto px-8 py-12 text-center">
          <p className="text-[var(--text2)] mb-4">
            A secao &quot;{slug}&quot; nao foi encontrada.
          </p>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Compliance
          </Link>
        </div>
      </div>
    );
  }

  const toggleCheck = (key: string) => {
    setItemStates((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          checked: !prev[key].checked,
          status: (!prev[key].checked ? "done" : "pending") as ItemStatus,
        },
      };
      saveToDb(next);
      return next;
    });
  };

  const cycleStatus = (key: string) => {
    setItemStates((prev) => {
      const current = prev[key].status;
      const idx = STATUS_CYCLE.indexOf(current);
      const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          status: nextStatus,
          checked: nextStatus === "done",
        },
      };
      saveToDb(next);
      return next;
    });
  };

  const updateNotes = (key: string, notes: string) => {
    setItemStates((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], notes },
      };
      saveToDb(next);
      return next;
    });
  };

  const completedCount = Object.values(itemStates).filter((s) => s.status === "done").length;
  const totalCount = section.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!loaded) {
    return (
      <div>
        <PageHeader title={`Secao ${section.id}: ${section.name}`} description={`Prazo: ${section.deadline}`} />
        <div className="max-w-5xl mx-auto px-8 py-12 text-center text-[var(--text3)] text-sm animate-pulse-slow">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Secao ${section.id}: ${section.name}`}
        description={`Prazo: ${section.deadline} - ${totalCount} itens`}
      />

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {/* Back link + session info */}
        <div className="flex items-center justify-between">
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cyan)] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar ao Compliance
          </Link>
          {municipality && (
            <div className="flex items-center gap-2 text-xs text-[var(--text2)]">
              <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
              {municipality.nome}
              {saving && <span className="text-[var(--text3)] animate-pulse-slow ml-2">Salvando...</span>}
            </div>
          )}
        </div>

        {!activeSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm text-amber-700">
            Inicie uma consultoria para salvar o progresso no banco de dados.
          </div>
        )}

        {/* Checklist Items */}
        <div className="space-y-3">
          {section.items.map((item) => {
            const state = itemStates[item.key];
            if (!state) return null;
            const statusCfg = STATUS_CONFIG[state.status];

            return (
              <div
                key={item.key}
                className={`bg-white border rounded-xl p-4 transition-all animate-fade-in ${
                  state.checked
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCheck(item.key)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      state.checked
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-[var(--border)] hover:border-[var(--cyan)]"
                    }`}
                  >
                    {state.checked && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--navy)] text-white">
                        {item.key}
                      </span>
                      <span
                        className={`text-sm ${
                          state.checked ? "line-through text-[var(--text3)]" : "text-[var(--text)]"
                        }`}
                      >
                        {item.text}
                      </span>
                    </div>

                    {/* Notes input */}
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Adicionar observacao..."
                        value={state.notes}
                        onChange={(e) => updateNotes(item.key, e.target.value)}
                        className="w-full text-xs px-3 py-1.5 border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--cyan)] bg-[var(--bg)] placeholder:text-[var(--text3)]"
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <button
                    onClick={() => cycleStatus(item.key)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCfg.bg} ${statusCfg.text} hover:opacity-80 transition-opacity`}
                    title="Clique para alterar o status"
                  >
                    {statusCfg.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Summary */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso da Secao {section.id}
              </div>
              <div className="text-xl font-extrabold mt-1 text-[var(--text)]">
                {completedCount} de {totalCount} concluidos
              </div>
            </div>
            <div className="text-2xl font-extrabold" style={{ color: progressPercent === 100 ? "var(--green)" : "var(--cyan)" }}>
              {progressPercent}%
            </div>
          </div>
          <div className="w-full bg-[var(--bg)] rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? "var(--green)" : "var(--cyan)",
              }}
            />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-[var(--text3)]">
            <span>
              {Object.values(itemStates).filter((s) => s.status === "pending").length} pendentes
            </span>
            <span>
              {Object.values(itemStates).filter((s) => s.status === "progress").length} em andamento
            </span>
            <span>
              {Object.values(itemStates).filter((s) => s.status === "done").length} concluidos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
