"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { COMPLIANCE_SECTIONS } from "@/lib/constants";
import { janelasAtivas, formatDataBR, SEVERIDADE_COLORS, type JanelaComStatus } from "@/lib/fundeb/prazos";

type ItemStatus = "pending" | "progress" | "done";

interface ItemState {
  checked: boolean;
  status: ItemStatus;
  notes: string;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pendente", bg: "bg-gray-100", text: "text-gray-600" },
  progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700" },
  done: { label: "Concluído", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_CYCLE: ItemStatus[] = ["pending", "progress", "done"];

type SaveState = "idle" | "saving" | "saved";

export default function ComplianceSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { activeSession, municipality } = useConsultoria();
  const municipalityId = activeSession?.municipalityId;

  const sectionIndex = COMPLIANCE_SECTIONS.findIndex((s) => s.id === slug.toUpperCase());
  const section = sectionIndex >= 0 ? COMPLIANCE_SECTIONS[sectionIndex] : undefined;
  const prevSection = sectionIndex > 0 ? COMPLIANCE_SECTIONS[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex >= 0 && sectionIndex < COMPLIANCE_SECTIONS.length - 1
      ? COMPLIANCE_SECTIONS[sectionIndex + 1]
      : null;

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [janela, setJanela] = useState<JanelaComStatus | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Janela regulatória mais urgente que cobre esta seção (client-only: depende de "hoje")
  useEffect(() => {
    if (!section) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown depende de "hoje", só existe no client
    setJanela(janelasAtivas().find((j) => j.diasRestantes >= 0 && j.secoes.includes(section.id)) ?? null);
  }, [section]);

  // Load items from DB (fetch-on-key-change; setState on initial load / reset is legitimate here)
  useEffect(() => {
    if (!section) return;
    if (!municipalityId) {
      // Initialize from constants with default state
      const initial: Record<string, ItemState> = {};
      for (const item of section.items) {
        initial[item.key] = { checked: false, status: "pending", notes: "" };
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to defaults when no session; no external system to sync
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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      debounceRef.current = setTimeout(() => {
        setSaveState("saving");
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
          .then(() => {
            setSaveState("saved");
            savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
          })
          .catch(() => setSaveState("idle"));
      }, 500);
    },
    [municipalityId, section]
  );

  if (!section) {
    return (
      <div>
        <PageHeader title="Seção não encontrada" />
        <div className="max-w-7xl mx-auto px-8 py-12 text-center">
          <p className="text-[var(--text2)] mb-4">
            A seção &quot;{slug}&quot; não foi encontrada.
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
  const inProgressCount = Object.values(itemStates).filter((s) => s.status === "progress").length;
  const pendingCount = Object.values(itemStates).filter((s) => s.status === "pending").length;
  const totalCount = section.items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const prazoDescricao = janela
    ? `Prazo: ${formatDataBR(janela.data)} (${janela.diasRestantes} dias) — ${totalCount} itens`
    : `${totalCount} itens`;

  if (!loaded) {
    return (
      <div>
        <PageHeader title={`Seção ${section.id}: ${section.name}`} description={prazoDescricao} />
        <div className="max-w-5xl mx-auto px-8 py-12 text-center text-[var(--text3)] text-sm animate-pulse-slow">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Seção ${section.id}: ${section.name}`}
        description={prazoDescricao}
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
            </div>
          )}
        </div>

        {!activeSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-sm text-amber-700">
            <p>Inicie uma consultoria para salvar o progresso no banco de dados.</p>
            <Link
              href="/wizard"
              className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-[var(--navy)] text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              + Iniciar consultoria
            </Link>
          </div>
        )}

        {/* Progress Summary — sticky no topo para não exigir scroll */}
        <div className="sticky top-0 z-10 bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="text-xl font-extrabold shrink-0"
                style={{ color: progressPercent === 100 ? "var(--green)" : "var(--cyan)" }}
              >
                {progressPercent}%
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text)] truncate">
                  {completedCount} de {totalCount} concluídos
                </div>
                <div className="flex gap-3 text-[11px] text-[var(--text3)]">
                  <span>{pendingCount} pendentes</span>
                  <span>{inProgressCount} em andamento</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {janela && (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `${SEVERIDADE_COLORS[janela.severidade]}18`,
                    color: SEVERIDADE_COLORS[janela.severidade],
                  }}
                  title={`${janela.titulo} — ${janela.emJogo}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: SEVERIDADE_COLORS[janela.severidade] }}
                  />
                  {janela.diasRestantes} dias
                </span>
              )}
              <span
                className={`text-[11px] font-semibold transition-opacity ${
                  saveState === "saving"
                    ? "text-[var(--text3)] animate-pulse-slow"
                    : saveState === "saved"
                      ? "text-emerald-600"
                      : "opacity-0"
                }`}
              >
                {saveState === "saving" ? "Salvando..." : "✓ Salvo"}
              </span>
            </div>
          </div>
          <div className="mt-2.5 w-full bg-[var(--bg)] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? "var(--green)" : "var(--cyan)",
              }}
            />
          </div>
        </div>

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
                    aria-label={state.checked ? "Marcar como pendente" : "Marcar como concluído"}
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
                        placeholder="Adicionar observação..."
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

        {/* Navegação entre seções */}
        <div className="flex items-center justify-between gap-4 pt-2">
          {prevSection ? (
            <Link
              href={`/compliance/${prevSection.id}`}
              className="flex-1 group bg-white border border-[var(--border)] rounded-xl p-4 hover:border-[var(--cyan)] transition-all"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                ← Seção anterior
              </div>
              <div className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--navy)] mt-0.5">
                {prevSection.id}: {prevSection.name}
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {nextSection ? (
            <Link
              href={`/compliance/${nextSection.id}`}
              className="flex-1 group bg-white border border-[var(--border)] rounded-xl p-4 text-right hover:border-[var(--cyan)] transition-all"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Próxima seção →
              </div>
              <div className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--navy)] mt-0.5">
                {nextSection.id}: {nextSection.name}
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </div>
  );
}
