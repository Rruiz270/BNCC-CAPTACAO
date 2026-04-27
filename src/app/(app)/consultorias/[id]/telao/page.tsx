"use client";

/**
 * Modo Telão — overlay fullscreen para apresentação ao vivo com a secretaria.
 * Foi pensado pra projeção em videoconferência: números enormes, contraste alto,
 * polling a cada 15s pra refletir mudanças que o consultor faz em outra aba/tab.
 *
 * Usa `fixed inset-0 z-50` para cobrir o sidebar do (app) layout sem precisar
 * mexer na hierarquia de layouts.
 */

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { calculateGain, type GainResult, type IntakeInput, type MunicipalityInput } from "@/lib/fundeb/gain";
import { GainBigCard, GainBreakdownTable } from "@/components/gain-display";
import { formatCurrency } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

interface MuniDetail {
  id: number;
  nome: string;
  enrollmentSummary: { totalMatriculas: number | null; eiMat: number | null; efMat: number | null };
  financials: { receitaTotal: number | null; vaat: number | null; vaar: number | null };
  potencial: { potTotal: number | null };
  schools: { rurais: number | null };
  educationMetrics: { idebAi: number | null; idebAf: number | null };
  compliance: { summary: Record<string, { total: number; done: number; progress: number; pending: number }> };
}

interface SnapshotRow {
  id: number;
  screen: string;
  gain_total: number;
  captured_at: string;
}

export default function TelaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const consultoriaId = parseInt(id, 10);
  const router = useRouter();

  const [muni, setMuni] = useState<MuniDetail | null>(null);
  const [intakeData, setIntakeData] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<SnapshotRow[]>([]);
  const [now, setNow] = useState(new Date());

  const loadAll = async () => {
    try {
      // Busca direta — `/api/consultorias` (lista) filtra por dono.
      const consRes = await fetch(`/api/consultorias/${consultoriaId}`);
      const consJson = await consRes.json();
      if (consJson.error || !consJson.municipalityId) return;

      const [muniRes, intakeRes, snapsRes] = await Promise.all([
        fetch(`/api/municipalities/${consJson.municipalityId}`),
        fetch(`/api/intake?consultoriaId=${consultoriaId}`),
        fetch(`/api/gain-snapshots?consultoriaId=${consultoriaId}`),
      ]);
      const muniJson = await muniRes.json();
      const intakeJson = await intakeRes.json();
      const snapsJson = await snapsRes.json();
      setMuni(muniJson);
      setIntakeData(intakeJson.response?.data ?? null);
      setHistory(snapsJson.snapshots ?? []);
      setNow(new Date());
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultoriaId]);

  // ESC fecha o telão
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(`/consultorias/${consultoriaId}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [consultoriaId, router]);

  const gainResult: GainResult | null = useMemo(() => {
    if (!muni) return null;
    const complianceA = muni.compliance?.summary?.A;
    const muniInput: MunicipalityInput = {
      id: muni.id,
      nome: muni.nome,
      totalMatriculas: muni.enrollmentSummary?.totalMatriculas ?? null,
      receitaTotal: muni.financials?.receitaTotal ?? null,
      vaat: muni.financials?.vaat ?? null,
      vaar: muni.financials?.vaar ?? null,
      potTotal: muni.potencial?.potTotal ?? null,
      idebAi: muni.educationMetrics?.idebAi ?? null,
      idebAf: muni.educationMetrics?.idebAf ?? null,
      escolasRurais: muni.schools?.rurais ?? null,
      eiMat: muni.enrollmentSummary?.eiMat ?? null,
      efMat: muni.enrollmentSummary?.efMat ?? null,
      complianceASectionDone: complianceA?.done ?? null,
      complianceASectionTotal: complianceA?.total ?? null,
    };

    const intake: IntakeInput = intakeData
      ? {
          alunosAee: pickNum(intakeData, "alunosAee"),
          alunosCampo: pickNum(intakeData, "alunosCampo"),
          alunosIndigena: pickNum(intakeData, "alunosIndigena"),
          alunosQuilombola: pickNum(intakeData, "alunosQuilombola"),
          alunosIntegral: pickNum(intakeData, "alunosIntegral"),
        }
      : {};

    return calculateGain(muniInput, intake);
  }, [muni, intakeData]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[var(--navy)] to-[#0a1f4a] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div>
          <div className="text-[#00B4D8] font-extrabold text-base tracking-widest uppercase">
            INSTITUTO i10 — FUNDEB 2026
          </div>
          {muni && <div className="text-white text-2xl font-bold mt-0.5" style={{ fontFamily: "'Source Serif 4', serif" }}>{muni.nome}</div>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-white/40">
            <div>Atualizado às {now.toLocaleTimeString("pt-BR")}</div>
            <div className="mt-0.5">Pressione ESC para sair</div>
          </div>
          <button
            onClick={() => router.push(`/consultorias/${consultoriaId}`)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {gainResult ? (
          <>
            <GainBigCard result={gainResult} variant="telao" municipioName={muni?.nome} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GainBreakdownTable result={gainResult} />

              {history.length > 0 && (
                <div className="bg-white border border-[var(--border)] rounded-xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--navy)] mb-4">
                    Linha do tempo do ganho identificado
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {history.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border-b border-[var(--border)] pb-2 last:border-0">
                        <div>
                          <div className="text-[var(--text2)] font-medium">{prettyScreen(s.screen)}</div>
                          <div className="text-[10px] text-[var(--text3)]">
                            {new Date(s.captured_at).toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <div className="text-base font-bold tabular-nums text-[var(--navy)]">
                          {formatCurrency(s.gain_total)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-32 text-white/60">Carregando dados da consultoria…</div>
        )}
      </div>
    </div>
  );
}

function pickNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function prettyScreen(screen: string): string {
  if (screen.startsWith("intake:")) return "Resposta da Secretaria";
  if (screen.startsWith("wizard:")) return `Wizard — ${screen.replace("wizard:", "")}`;
  if (screen === "simulator") return "Simulação salva";
  return screen;
}
