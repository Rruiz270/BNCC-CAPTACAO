"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

type StatusValue = "done" | "progress" | "pending" | "late";
const STATUS_OPTIONS: Array<{ value: StatusValue; label: string; color: string }> = [
  { value: "done", label: "Done", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "progress", label: "Em andamento", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "pending", label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "late", label: "Atrasado", color: "bg-red-100 text-red-700 border-red-300" },
];

interface ComplianceItem {
  id: number;
  section: string;
  sectionName: string;
  itemKey: string;
  itemText: string;
  status: StatusValue;
  evidenceUrl: string | null;
  notes: string | null;
}

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string };
}

interface StepPayload {
  pct?: number;
  classifiedAll?: boolean;
}

export default function StepCompliance() {
  const step = getStepById(5)!;
  const { consultoriaId, steps, updateStep, saving } = useWizard();

  const [session, setSession] = useState<SessionData | null>(null);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega sessao
  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setSession(s || null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  const muniId = session?.municipality?.id ?? null;

  // Carrega itens
  const loadItems = useCallback(() => {
    if (!muniId) return;
    fetch(`/api/compliance?municipalityId=${muniId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) {
          setItems(data.items);
          setDirty(new Set());
        }
      })
      .catch((e) => setError(String(e)));
  }, [muniId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Atualiza localmente + marca dirty
  const updateItem = (id: number, patch: Partial<ComplianceItem>) => {
    setItems((cur) =>
      cur.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
    setDirty((cur) => new Set(cur).add(id));
  };

  // Agrupa por secao
  const bySection = useMemo(() => {
    const map: Record<string, { sectionName: string; items: ComplianceItem[] }> = {};
    for (const it of items) {
      if (!map[it.section]) map[it.section] = { sectionName: it.sectionName, items: [] };
      map[it.section].items.push(it);
    }
    return map;
  }, [items]);

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const classifiedAll =
    total > 0 && items.every((i) => i.status !== "pending");

  const salvar = useCallback(async () => {
    if (!muniId || dirty.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = items
        .filter((i) => dirty.has(i.id))
        .map((i) => ({
          itemKey: i.itemKey,
          status: i.status,
          notes: i.notes,
          evidenceUrl: i.evidenceUrl,
        }));
      const res = await fetch(`/api/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId: muniId,
          consultoriaId,
          items: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao salvar");
      setDirty(new Set());
      // Persiste no wizard_progress
      await updateStep(5, {
        status: "in_progress",
        payload: {
          pct: data?.stats?.progress ?? progress,
          classifiedAll: items.every((i) => i.status !== "pending"),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }, [muniId, dirty, items, consultoriaId, updateStep, progress]);

  // Estado derivado
  const storedPayload = steps.find((s) => s.step === 5)?.payload as StepPayload | undefined;
  const canAdvance = classifiedAll && dirty.size === 0 && (storedPayload?.classifiedAll ?? true);
  const blockReason = !classifiedAll
    ? "Ainda existem itens em status 'pending'"
    : dirty.size > 0
    ? "Salve as alteracoes antes de avancar"
    : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Compliance — 5 secoes A-E</h2>
      <p className="text-sm text-[var(--text3)] mb-4">
        Classifique cada item. Ao salvar, a SP <code>sp_atualizar_compliance</code> roda e
        atualiza as materialized views.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Stats + acao de salvar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border border-[var(--border)] rounded-lg p-3">
          <div className="text-[10px] uppercase text-[var(--text3)]">Progresso</div>
          <div className="text-xl font-extrabold text-[#00E5A0] mt-0.5">{progress}%</div>
          <div className="h-1.5 bg-[var(--bg)] rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00B4D8] to-[#00E5A0]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-3">
          <div className="text-[10px] uppercase text-[var(--text3)]">Itens</div>
          <div className="text-sm font-bold text-[var(--text1)] mt-0.5">
            {done} / {total} done
          </div>
          <div className="text-[10px] text-[var(--text3)]">
            {items.filter((i) => i.status === "progress").length} em andamento ·{" "}
            {items.filter((i) => i.status === "late").length} atrasados ·{" "}
            {items.filter((i) => i.status === "pending").length} pendentes
          </div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-3 flex flex-col justify-between">
          <div className="text-[10px] uppercase text-[var(--text3)]">
            Alteracoes nao salvas: {dirty.size}
          </div>
          <button
            onClick={salvar}
            disabled={submitting || dirty.size === 0}
            className="mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#00B4D8] text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            {submitting ? "Salvando..." : "Salvar + recalcular"}
          </button>
        </div>
      </div>

      {/* Items por secao */}
      {total === 0 ? (
        <div className="border border-[var(--border)] rounded-lg p-4 text-xs text-gray-400 mb-4">
          Nenhum item de compliance cadastrado para este municipio.
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {Object.entries(bySection).map(([section, group]) => (
            <div key={section} className="border border-[var(--border)] rounded-lg">
              <div className="px-3 py-2 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-widest text-[#00B4D8]">
                  {section} — {group.sectionName}
                </div>
                <div className="text-[10px] text-[var(--text3)]">
                  {group.items.filter((i) => i.status === "done").length} / {group.items.length}
                </div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {group.items.map((it) => (
                  <div key={it.id} className="p-3 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--text1)]">{it.itemText}</div>
                        <div className="text-[10px] text-[var(--text3)]">{it.itemKey}</div>
                      </div>
                      <select
                        value={it.status}
                        onChange={(e) =>
                          updateItem(it.id, { status: e.target.value as StatusValue })
                        }
                        className={`px-2 py-1 text-[10px] font-bold rounded border ${
                          STATUS_OPTIONS.find((s) => s.value === it.status)?.color ?? ""
                        }`}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="url"
                        placeholder="URL de evidencia"
                        value={it.evidenceUrl ?? ""}
                        onChange={(e) => updateItem(it.id, { evidenceUrl: e.target.value })}
                        className="px-2 py-1 text-[10px] border border-[var(--border)] rounded"
                      />
                      <input
                        type="text"
                        placeholder="Notas"
                        value={it.notes ?? ""}
                        onChange={(e) => updateItem(it.id, { notes: e.target.value })}
                        className="px-2 py-1 text-[10px] border border-[var(--border)] rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link legado */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3">
        {muniId ? (
          <Link
            href={`/compliance/${muniId}`}
            target="_blank"
            className="text-xs font-semibold text-[#00B4D8] hover:underline"
          >
            Abrir compliance completo (legado) ↗
          </Link>
        ) : (
          <div className="text-xs text-gray-400">Carregando sessao...</div>
        )}
      </div>

      {saving && <div className="mt-2 text-[10px] text-[#00B4D8]">salvando progresso...</div>}
    </StepShell>
  );
}
