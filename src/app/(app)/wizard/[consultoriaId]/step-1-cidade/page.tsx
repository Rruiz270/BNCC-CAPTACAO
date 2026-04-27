"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

interface SessionData {
  id: number;
  municipality?: {
    id: number;
    nome: string;
    totalMatriculas: number | null;
    receitaTotal: number | null;
    totalEscolas: number | null;
    codigoIbge: string | null;
  };
}

interface StepPayload {
  confirmed?: boolean;
  muniId?: number;
  muniNome?: string;
  confirmedAt?: string;
}

interface MuniDetail {
  financials: { receitaTotal: number; contribuicao: number; recursosReceber: number; vaat: number; vaar: number; ganhoPerda: number; coeficiente: number; nse: number };
  revenue: { icms: number; ipva: number; fpm: number; totalEstado: number; totalUniao: number };
  historico: Record<string, number>;
  enrollmentSummary: { totalMatriculas: number; categoriasAtivas: number };
  potencial: { potTotal: number; pctPotTotal: number; nFaltantes: number };
  schools: { total: number; municipais: number | null; rurais: number; totalDocentes: number };
  infrastructure: { pctInternet: number | null; pctBiblioteca: number | null };
  educationMetrics: { saebPort5: number | null; saebMat5: number | null; saebPort9: number | null; saebMat9: number | null };
  crescimento_4anos?: number;
  recebe_vaar?: boolean;
  recebe_vaat?: boolean;
  quick_win_score?: number;
  cats_faltantes?: string;
  n_estrategias?: number;
  pot_t1?: number; pot_t2?: number; pot_t3?: number; pot_t4?: number; pot_t5_vaar?: number; pot_t5_vaat?: number; pot_t6?: number;
}

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "—";

export default function StepCidade() {
  const step = getStepById(1)!;
  const { consultoriaId, steps, updateStep, saving } = useWizard();
  const [session, setSession] = useState<SessionData | null>(null);
  const [detail, setDetail] = useState<MuniDetail | null>(null);

  useEffect(() => {
    // Busca direta por id em vez de filtrar a lista (que usa view=mine
    // por default e não enxerga sessão de outro consultor mesmo pra admin).
    fetch(`/api/consultorias/${consultoriaId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.municipality) {
          setSession(null);
          return;
        }
        setSession({ id: data.id, municipality: data.municipality });
        if (data.municipality?.id) {
          fetch(`/api/municipalities/${data.municipality.id}`)
            .then((r) => r.json())
            .then((d) => setDetail(d))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [consultoriaId]);

  const serverPayload = steps.find((s) => s.step === 1)?.payload as StepPayload | undefined;
  const confirmed = serverPayload?.confirmed === true;

  const muni = session?.municipality;
  const canAdvance = !!muni && confirmed;
  const blockReason = !muni
    ? "Sessao sem municipio vinculado"
    : !confirmed
    ? "Confirme o municipio para liberar o avanco"
    : undefined;

  async function handleToggle(next: boolean) {
    if (!muni) return;
    await updateStep(1, {
      status: next ? "in_progress" : "available",
      payload: {
        confirmed: next,
        muniId: muni.id,
        muniNome: muni.nome,
        confirmedAt: next ? new Date().toISOString() : null,
      },
    });
  }

  const histYears = ["2022", "2023", "2024", "2025", "2026"];
  const histValues = detail ? histYears.map((y) => detail.historico?.[y] || 0) : [];
  const maxHist = Math.max(...histValues, 1);

  // Flags from quick_win analysis
  const flags: { label: string; color: string }[] = [];
  if (detail?.cats_faltantes) flags.push({ label: `${detail.potencial?.nFaltantes || 0} categorias nao captadas`, color: "bg-red-500/20 text-red-300" });
  if (detail?.recebe_vaar === false && (detail?.financials?.vaar || 0) === 0) flags.push({ label: "Nao recebe VAAR", color: "bg-orange-500/20 text-orange-300" });
  if (detail?.quick_win_score && detail.quick_win_score > 50) flags.push({ label: `Quick-win score: ${detail.quick_win_score.toFixed(0)}`, color: "bg-[#00E5A0]/20 text-[#00E5A0]" });
  if (detail?.crescimento_4anos && detail.crescimento_4anos > 30) flags.push({ label: `Crescimento 4a: ${detail.crescimento_4anos.toFixed(0)}%`, color: "bg-[#00B4D8]/20 text-[#00B4D8]" });

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Ficha do Municipio</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        Perfil completo do municipio com dados financeiros, educacionais e de infraestrutura. Confirme para prosseguir.
      </p>

      {!muni ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Nao foi possivel carregar o municipio desta sessao. Verifique se a sessao #{consultoriaId} existe.
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="border border-[var(--border)] rounded-lg p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-1">Municipio</div>
                <div className="text-2xl font-extrabold text-[var(--text1)]">{muni.nome}</div>
                <div className="text-xs text-[var(--text3)] mt-1">IBGE {muni.codigoIbge ?? "—"} | Estado de Sao Paulo</div>
              </div>
              {detail?.potencial && (
                <div className="text-right">
                  <div className="text-[10px] uppercase text-[var(--text3)]">Potencial Captacao</div>
                  <div className="text-xl font-bold text-[#00E5A0]">+{fmt(detail.potencial.potTotal)}</div>
                  <div className="text-xs text-[var(--text3)]">{detail.potencial.pctPotTotal?.toFixed(1)}% da receita</div>
                </div>
              )}
            </div>

            {/* Alert flags */}
            {flags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {flags.map((f, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${f.color}`}>{f.label}</span>
                ))}
              </div>
            )}
          </div>

          {/* 4 Quadrants */}
          {detail && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Quadrant 1: Financial */}
              <div className="border border-[var(--border)] rounded-lg p-4">
                <div className="text-xs font-bold uppercase text-[#00B4D8] mb-3">Financeiro FUNDEB</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Receita Total</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{fmt(detail.financials?.receitaTotal)}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Ganho/Perda</div>
                    <div className={`text-sm font-bold ${(detail.financials?.ganhoPerda || 0) >= 0 ? "text-[#00A878]" : "text-red-500"}`}>
                      {fmt(detail.financials?.ganhoPerda)}
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">VAAT</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{fmt(detail.financials?.vaat)}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">VAAR</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{fmt(detail.financials?.vaar)}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Contribuicao</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{fmt(detail.financials?.contribuicao)}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">NSE</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.financials?.nse?.toFixed(4) ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* Quadrant 2: Educational */}
              <div className="border border-[var(--border)] rounded-lg p-4">
                <div className="text-xs font-bold uppercase text-[#00B4D8] mb-3">Educacional</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Total Matriculas</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.enrollmentSummary?.totalMatriculas?.toLocaleString("pt-BR") ?? "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Cat. Ativas</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.enrollmentSummary?.categoriasAtivas ?? "—"}/16</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">SAEB 5o LP/MT</div>
                    <div className="text-sm font-bold text-[var(--text1)]">
                      {detail.educationMetrics?.saebPort5?.toFixed(0) ?? "—"} / {detail.educationMetrics?.saebMat5?.toFixed(0) ?? "—"}
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">SAEB 9o LP/MT</div>
                    <div className="text-sm font-bold text-[var(--text1)]">
                      {detail.educationMetrics?.saebPort9?.toFixed(0) ?? "—"} / {detail.educationMetrics?.saebMat9?.toFixed(0) ?? "—"}
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Docentes</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.schools?.totalDocentes?.toLocaleString("pt-BR") ?? "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">N Faltantes</div>
                    <div className="text-sm font-bold text-red-500">{detail.potencial?.nFaltantes ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* Quadrant 3: Infrastructure */}
              <div className="border border-[var(--border)] rounded-lg p-4">
                <div className="text-xs font-bold uppercase text-[#00B4D8] mb-3">Infraestrutura</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Total Escolas</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.schools?.total ?? "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Escolas Municipais</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.schools?.municipais ?? "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">% Internet</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.infrastructure?.pctInternet != null ? `${detail.infrastructure.pctInternet.toFixed(0)}%` : "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">% Biblioteca</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.infrastructure?.pctBiblioteca != null ? `${detail.infrastructure.pctBiblioteca.toFixed(0)}%` : "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Escolas Rurais</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.schools?.rurais ?? "—"}</div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-lg p-2.5">
                    <div className="text-[10px] text-[var(--text3)]">Coeficiente</div>
                    <div className="text-sm font-bold text-[var(--text1)]">{detail.financials?.coeficiente?.toFixed(6) ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* Quadrant 4: Historical */}
              <div className="border border-[var(--border)] rounded-lg p-4">
                <div className="text-xs font-bold uppercase text-[#00B4D8] mb-3">
                  Historico FUNDEB
                  {detail.crescimento_4anos != null && (
                    <span className="ml-2 text-[10px] font-normal text-[var(--text3)]">
                      (crescimento 4a: {detail.crescimento_4anos.toFixed(1)}%)
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-1.5 h-28">
                  {histYears.map((year, i) => {
                    const val = histValues[i];
                    const h = maxHist > 0 ? (val / maxHist) * 100 : 0;
                    return (
                      <div key={year} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="text-[8px] text-[var(--text3)] tabular-nums">{fmt(val)}</div>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${Math.max(h, 5)}%`,
                            background: year === "2026" ? "#00B4D8" : "var(--border)",
                          }}
                        />
                        <div className="text-[10px] text-[var(--text3)]">{year}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Revenue composition */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <div className="text-[9px] text-[var(--text3)]">ICMS+IPVA</div>
                    <div className="text-xs font-bold text-[var(--text1)]">{fmt((detail.revenue?.icms || 0) + (detail.revenue?.ipva || 0))}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[var(--text3)]">FPM</div>
                    <div className="text-xs font-bold text-[var(--text1)]">{fmt(detail.revenue?.fpm)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-[var(--text3)]">Uniao</div>
                    <div className="text-xs font-bold text-[var(--text1)]">{fmt(detail.revenue?.totalUniao)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Categories warning */}
          {detail?.cats_faltantes && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
              <span className="font-bold">Categorias nao captadas:</span> {detail.cats_faltantes}
            </div>
          )}

          {/* Confirmation */}
          <div className="border border-[var(--border)] rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={saving}
                onChange={(e) => handleToggle(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[var(--text2)]">
                Confirmo que este e o municipio correto desta consultoria
              </span>
              {saving && <span className="text-xs text-[#00B4D8] ml-2">salvando...</span>}
            </label>
          </div>
        </>
      )}

      <div className="mt-6 text-xs text-[var(--text3)]">
        Caso precise mudar de municipio, encerre a sessao atual e abra uma nova em{" "}
        <Link href="/wizard" className="text-[#00B4D8] underline">
          /wizard
        </Link>
        .
      </div>
    </StepShell>
  );
}
