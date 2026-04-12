"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizard } from "@/components/wizard/wizard-provider";
import { getStepById } from "@/lib/wizard/steps";

type EtlSource = "censo_escolar" | "siope" | "fnde" | "ibge" | "local";

interface IntakeEnrollmentEntry {
  publicValue: number;
  realValue: number;
  difference: number;
}

interface IntakeResponse {
  respondentName: string;
  respondentRole: string;
  respondentEmail: string;
  submittedAt: string;
  data: {
    enrollmentData?: Record<string, IntakeEnrollmentEntry>;
    schoolsTotal?: number;
    schoolsRural?: number;
    observations?: string;
  };
}

interface PipelineResult {
  extract: { importId: number; rowsTotal: number; contentHash: string; alreadyExists: boolean };
  treat: { importId: number; rowsOk: number; rowsRejected: number };
  catalog: { importId: number; cataloged: number; lineageRows: number };
}

interface SessionData {
  id: number;
  municipality?: { id: number; nome: string };
}

interface StepPayload {
  lastRun?: PipelineResult;
  source?: EtlSource;
  ranAt?: string;
}

const SOURCES: Array<{ value: EtlSource; label: string }> = [
  { value: "censo_escolar", label: "Censo Escolar (INEP)" },
  { value: "siope", label: "SIOPE (FNDE)" },
  { value: "fnde", label: "FNDE direto" },
  { value: "ibge", label: "IBGE" },
  { value: "local", label: "Base local/manual" },
];

function makeSampleRows(count: number): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    out.push({
      row_id: i + 1,
      inep: `350000${i.toString().padStart(3, "0")}`,
      escola: `Escola Sample ${i + 1}`,
      categoria: i % 3 === 0 ? "EI" : i % 3 === 1 ? "EF" : "DM",
      matriculas: 20 + (i % 15),
      ativa: i % 7 !== 0,
    });
  }
  return out;
}

export default function StepDiscovery() {
  const step = getStepById(2)!;
  const { consultoriaId, steps, updateStep } = useWizard();
  const [muniId, setMuniId] = useState<number | null>(null);
  const [sourceOverride, setSourceOverride] = useState<EtlSource | null>(null);
  const [rowCount, setRowCount] = useState(20);
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intakeResponse, setIntakeResponse] = useState<IntakeResponse | null>(null);

  // Busca municipio da sessao
  useEffect(() => {
    fetch(`/api/consultorias`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.sessions?.find((x: SessionData) => x.id === consultoriaId);
        setMuniId(s?.municipality?.id ?? null);
      })
      .catch(() => {});
  }, [consultoriaId]);

  // Busca intake response — first by consultoriaId, then fallback by municipalityId
  useEffect(() => {
    fetch(`/api/intake?consultoriaId=${consultoriaId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.response) {
          setIntakeResponse(data.response);
        } else if (muniId) {
          // Fallback: look for pre-consultoria intake by municipality
          fetch(`/api/intake?municipalityId=${muniId}`)
            .then((r) => r.json())
            .then((fallback) => {
              if (fallback.response) setIntakeResponse(fallback.response);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [consultoriaId, muniId]);

  // Estado derivado do wizard_progress.payload (com overrides locais)
  const storedPayload = steps.find((s) => s.step === 2)?.payload as StepPayload | undefined;
  const source: EtlSource = sourceOverride ?? storedPayload?.source ?? "censo_escolar";
  const result: PipelineResult | null = localResult ?? storedPayload?.lastRun ?? null;

  async function runPipeline() {
    setRunning(true);
    setError(null);
    try {
      const rows = makeSampleRows(rowCount);
      const res = await fetch("/api/etl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          filename: `sample-${source}-${Date.now()}.json`,
          uploadedBy: `consultor-${consultoriaId}`,
          consultoriaId,
          municipalityId: muniId,
          rows,
          metadata: { generatedBy: "wizard-step-2", count: rowCount },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha no pipeline");

      const pipelineResult: PipelineResult = {
        extract: data.extract,
        treat: data.treat,
        catalog: data.catalog,
      };
      setLocalResult(pipelineResult);

      await updateStep(2, {
        status: "in_progress",
        payload: {
          lastRun: pipelineResult as unknown as Record<string, unknown>,
          source,
          ranAt: new Date().toISOString(),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setRunning(false);
    }
  }

  const rowsOk = result?.treat.rowsOk ?? 0;
  const rowsRejected = result?.treat.rowsRejected ?? 0;
  const cataloged = result?.catalog.cataloged ?? 0;
  const canAdvance = !!result && rowsOk > 0;
  const blockReason = !result
    ? "Execute o pipeline ETL para liberar o avanco"
    : rowsOk === 0
    ? "Nenhuma linha valida apos Treat — corrija a fonte antes de avancar"
    : undefined;

  return (
    <StepShell step={step} canAdvance={canAdvance} blockReason={blockReason}>
      {/* Intake response banner */}
      {intakeResponse && (
        <div className="mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-800">
                Secretaria preencheu em {new Date(intakeResponse.submittedAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <p className="text-xs text-emerald-700 ml-4">
              Responsavel: {intakeResponse.respondentName}
              {intakeResponse.respondentRole && ` (${intakeResponse.respondentRole})`}
            </p>
          </div>

          {/* Enrollment comparison table */}
          {intakeResponse.data?.enrollmentData && Object.keys(intakeResponse.data.enrollmentData).length > 0 && (
            <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-3">
                Matriculas — Publico vs Informado pela Secretaria
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-[var(--text3)] border-b border-[var(--border)]">
                      <th className="text-left px-3 py-2">Categoria</th>
                      <th className="text-right px-3 py-2">Publico</th>
                      <th className="text-right px-3 py-2">Real</th>
                      <th className="text-right px-3 py-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(intakeResponse.data.enrollmentData).map(([key, entry]) => {
                      const diff = entry.difference;
                      const pct = entry.publicValue > 0 ? Math.abs(diff / entry.publicValue * 100) : (diff !== 0 ? 100 : 0);
                      return (
                        <tr key={key} className={`border-b border-[var(--border)] ${pct > 10 ? "bg-red-50" : ""}`}>
                          <td className="px-3 py-1.5 font-medium">{key}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text2)]">
                            {entry.publicValue.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                            {entry.realValue.toLocaleString("pt-BR")}
                          </td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${
                            diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-700" : "text-gray-400"
                          }`}>
                            {diff > 0 ? "+" : ""}{diff.toLocaleString("pt-BR")}
                            {pct > 0 && <span className="text-[10px] text-[var(--text3)] ml-1">({pct.toFixed(0)}%)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {intakeResponse.data.observations && (
                <div className="mt-3 text-xs text-[var(--text2)] bg-[var(--bg)] rounded p-2">
                  <strong>Observacoes:</strong> {intakeResponse.data.observations}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-[var(--text1)] mb-2">Discovery — Dados Brutos & ETL</h2>
      <p className="text-sm text-[var(--text3)] mb-6">
        O pipeline percorre <strong>Extracao → Treat → Catalog</strong> sobre a fonte escolhida e
        popula o banco bruto (<code>raw.*</code>). O Onda 3 usa dados de demonstracao; Onda 4
        plugara fontes reais (Censo Escolar, SIOPE, FNDE).
      </p>

      <div className="space-y-3 mb-6">
        <PipelineStep n={1} title="Extracao" desc="Insere linhas em raw.imports + raw.import_rows (dedup por sha256)" />
        <PipelineStep n={2} title="Treat" desc="Valida cada linha, marca is_valid e grava errors" />
        <PipelineStep n={3} title="Catalog" desc="Marca cataloged_at e cria linhagem em raw.lineage" />
      </div>

      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text3)] mb-3">
          Configuracao do pipeline
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-[var(--text3)] block mb-1">Fonte</label>
            <select
              value={source}
              onChange={(e) => setSourceOverride(e.target.value as EtlSource)}
              disabled={running}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--text3)] block mb-1">Linhas de amostra</label>
            <input
              type="number"
              min={1}
              max={500}
              value={rowCount}
              onChange={(e) => setRowCount(parseInt(e.target.value, 10) || 1)}
              disabled={running}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runPipeline}
              disabled={running || !muniId}
              className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {running ? "Rodando..." : "Rodar pipeline"}
            </button>
          </div>
        </div>
        {!muniId && (
          <div className="text-xs text-amber-700 mt-2">
            Aguardando dados do municipio da sessao...
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          Erro: {error}
        </div>
      )}

      {result && (
        <div className="border border-[var(--border)] rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8]">
                Resultado
              </div>
              <div className="text-base font-bold text-[var(--text1)]">
                Import #{result.extract.importId}
                {result.extract.alreadyExists && (
                  <span className="text-[10px] ml-2 bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    dedup hit
                  </span>
                )}
              </div>
            </div>
            <div className="text-[10px] text-[var(--text3)] font-mono max-w-[200px] truncate" title={result.extract.contentHash}>
              {result.extract.contentHash.slice(0, 12)}...
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Metric label="Total" value={result.extract.rowsTotal} />
            <Metric label="OK" value={rowsOk} tone="emerald" />
            <Metric label="Rejeitadas" value={rowsRejected} tone={rowsRejected > 0 ? "red" : "gray"} />
            <Metric label="Catalogadas" value={cataloged} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/importar"
          target="_blank"
          className="text-xs px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:bg-white"
        >
          Abrir importador legado ↗
        </Link>
      </div>
    </StepShell>
  );
}

function PipelineStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-full bg-[#0A2463] text-white font-bold text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-[var(--text1)]">{title}</div>
        <div className="text-xs text-[var(--text3)]">{desc}</div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "red" | "gray";
}) {
  const colors: Record<string, string> = {
    slate: "text-[var(--text1)]",
    emerald: "text-emerald-700",
    red: "text-red-700",
    gray: "text-gray-400",
  };
  return (
    <div className="bg-[var(--bg)] rounded-lg p-3">
      <div className="text-[10px] uppercase text-[var(--text3)]">{label}</div>
      <div className={`text-lg font-bold ${colors[tone]}`}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
