"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { MunicipalitySelector } from "@/components/municipality-selector";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { useConsultoria } from "@/lib/consultoria-context";

/* ---------- Types ---------- */
interface Municipality {
  id: number;
  nome: string;
  receitaTotal: number | null;
  ganhoPerda: number | null;
  potTotal: number | null;
  pctPotTotal: number | null;
  totalMatriculas: number | null;
  totalEscolas: number | null;
  totalDocentes: number | null;
  pctInternet: number | null;
  pctBiblioteca: number | null;
  revenue: {
    icms: number | null;
    ipva: number | null;
    ipiExp: number | null;
    totalEstado: number | null;
    fpm: number | null;
    itr: number | null;
    totalUniao: number | null;
  };
  hist: {
    "2022": number | null;
    "2023": number | null;
    "2024": number | null;
    "2025": number | null;
    "2026": number | null;
  };
  saeb: {
    port5: number | null;
    mat5: number | null;
    port9: number | null;
    mat9: number | null;
  };
}

/* ---------- Constants ---------- */
const COLOR_A = "#0A2463";
const COLOR_B = "#00B4D8";

/* ---------- Helpers ---------- */
function safe(v: number | null | undefined): number {
  return v ?? 0;
}

function ComparisonCard({
  label,
  valueA,
  valueB,
  nameA,
  nameB,
  formatter,
}: {
  label: string;
  valueA: number;
  valueB: number;
  nameA: string;
  nameB: string;
  formatter: (v: number) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 animate-fade-in">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-4">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--text3)] mb-1 truncate" title={nameA}>
            {nameA}
          </div>
          <div className="text-lg font-bold" style={{ color: COLOR_A }}>
            {formatter(valueA)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--text3)] mb-1 truncate" title={nameB}>
            {nameB}
          </div>
          <div className="text-lg font-bold" style={{ color: COLOR_B }}>
            {formatter(valueB)}
          </div>
        </div>
      </div>
      {/* Comparison bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden flex">
          {valueA + valueB > 0 && (
            <>
              <div
                className="h-full rounded-l-full"
                style={{
                  width: `${(valueA / (valueA + valueB)) * 100}%`,
                  background: COLOR_A,
                }}
              />
              <div
                className="h-full rounded-r-full"
                style={{
                  width: `${(valueB / (valueA + valueB)) * 100}%`,
                  background: COLOR_B,
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressComparison({
  label,
  valueA,
  valueB,
  nameA,
  nameB,
}: {
  label: string;
  valueA: number;
  valueB: number;
  nameA: string;
  nameB: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
      {/* City A */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--text3)] w-28 truncate" title={nameA}>
          {nameA}
        </span>
        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(valueA, 100)}%`, background: COLOR_A }}
          />
        </div>
        <span className="text-xs font-bold w-12 text-right" style={{ color: COLOR_A }}>
          {formatPercent(valueA)}
        </span>
      </div>
      {/* City B */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-[var(--text3)] w-28 truncate" title={nameB}>
          {nameB}
        </span>
        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(valueB, 100)}%`, background: COLOR_B }}
          />
        </div>
        <span className="text-xs font-bold w-12 text-right" style={{ color: COLOR_B }}>
          {formatPercent(valueB)}
        </span>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function ComparativoPage() {
  const { activeSession, municipality: activeMunicipality } = useConsultoria();
  const [allMunicipalities, setAllMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [idA, setIdA] = useState<number | undefined>(undefined);
  const [idB, setIdB] = useState<number | undefined>(undefined);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    fetch("/api/municipalities?limit=645")
      .then((r) => r.json())
      .then((data) => {
        setAllMunicipalities(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-select municipalities when consultoria is active
  useEffect(() => {
    if (autoSelectedRef.current || loading || allMunicipalities.length === 0) return;
    if (!activeSession || !activeMunicipality) return;

    autoSelectedRef.current = true;
    const activeId = activeSession.municipalityId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-select on consultoria change; guarded by autoSelectedRef
    setIdA(activeId);

    // Find a similar municipality by closest receitaTotal
    const activeMuni = allMunicipalities.find((m) => m.id === activeId);
    const activeReceita = activeMuni?.receitaTotal ?? activeMunicipality.receitaTotal ?? 0;

    if (activeReceita > 0) {
      const similar = allMunicipalities
        .filter((m) => m.id !== activeId && m.receitaTotal != null)
        .sort((a, b) =>
          Math.abs((a.receitaTotal ?? 0) - activeReceita) -
          Math.abs((b.receitaTotal ?? 0) - activeReceita)
        );
      if (similar.length > 0) {
        setIdB(similar[0].id);
      }
    }
  }, [activeSession, activeMunicipality, allMunicipalities, loading]);

  const muniA = allMunicipalities.find((m) => m.id === idA) ?? null;
  const muniB = allMunicipalities.find((m) => m.id === idB) ?? null;
  const bothSelected = muniA && muniB;

  const handleSelectA = useCallback((_id: number, muni: { id: number }) => {
    setIdA(muni.id);
  }, []);

  const handleSelectB = useCallback((_id: number, muni: { id: number }) => {
    setIdB(muni.id);
  }, []);

  /* ---------- Chart Data ---------- */
  const metricsChartData = bothSelected
    ? [
        {
          metric: "Receita Total",
          [muniA.nome]: safe(muniA.receitaTotal),
          [muniB.nome]: safe(muniB.receitaTotal),
        },
        {
          metric: "Matriculas",
          [muniA.nome]: safe(muniA.totalMatriculas),
          [muniB.nome]: safe(muniB.totalMatriculas),
        },
        {
          metric: "Potencial",
          [muniA.nome]: safe(muniA.potTotal),
          [muniB.nome]: safe(muniB.potTotal),
        },
        {
          metric: "Escolas",
          [muniA.nome]: safe(muniA.totalEscolas),
          [muniB.nome]: safe(muniB.totalEscolas),
        },
        {
          metric: "Docentes",
          [muniA.nome]: safe(muniA.totalDocentes),
          [muniB.nome]: safe(muniB.totalDocentes),
        },
      ]
    : [];

  const revenueChartData = bothSelected
    ? [
        {
          fonte: "ICMS",
          [muniA.nome]: safe(muniA.revenue.icms),
          [muniB.nome]: safe(muniB.revenue.icms),
        },
        {
          fonte: "IPVA",
          [muniA.nome]: safe(muniA.revenue.ipva),
          [muniB.nome]: safe(muniB.revenue.ipva),
        },
        {
          fonte: "IPI-Exp",
          [muniA.nome]: safe(muniA.revenue.ipiExp),
          [muniB.nome]: safe(muniB.revenue.ipiExp),
        },
        {
          fonte: "FPM",
          [muniA.nome]: safe(muniA.revenue.fpm),
          [muniB.nome]: safe(muniB.revenue.fpm),
        },
        {
          fonte: "ITR",
          [muniA.nome]: safe(muniA.revenue.itr),
          [muniB.nome]: safe(muniB.revenue.itr),
        },
        {
          fonte: "Total Estado",
          [muniA.nome]: safe(muniA.revenue.totalEstado),
          [muniB.nome]: safe(muniB.revenue.totalEstado),
        },
        {
          fonte: "Total Uniao",
          [muniA.nome]: safe(muniA.revenue.totalUniao),
          [muniB.nome]: safe(muniB.revenue.totalUniao),
        },
      ]
    : [];

  const years = ["2022", "2023", "2024", "2025", "2026"] as const;
  const histChartData = bothSelected
    ? years.map((yr) => ({
        ano: yr,
        [muniA.nome]: safe(muniA.hist[yr]),
        [muniB.nome]: safe(muniB.hist[yr]),
      }))
    : [];

  /* ---------- Custom Tooltip ---------- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currencyTooltipFormatter = (value: any) => formatCurrency(Number(value ?? 0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numberTooltipFormatter = (value: any) => formatNumber(Number(value ?? 0));

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Comparativo Municipal"
        description="Compare indicadores entre municipios paulistas"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-8">
        {/* ---------- Consultoria Banner ---------- */}
        {activeSession && activeMunicipality && (
          <div className="px-4 py-3 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/30 flex items-center gap-3 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-[#00B4D8]" />
            <span className="text-sm font-semibold text-[var(--navy)]">
              Consultoria ativa: {activeMunicipality.nome}
            </span>
            <span className="text-xs text-[var(--text3)]">
              Municipio A pre-selecionado com municipio similar sugerido
            </span>
          </div>
        )}

        {/* ---------- Municipality Selectors ---------- */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 animate-fade-in">
          <div className="text-sm font-semibold text-[var(--text)] mb-4">
            Selecione dois municipios para comparar
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-2"
                  style={{ background: COLOR_A }}
                />
                Municipio A
              </label>
              <MunicipalitySelector value={idA as number} onChange={handleSelectA} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-2"
                  style={{ background: COLOR_B }}
                />
                Municipio B
              </label>
              <MunicipalitySelector value={idB as number} onChange={handleSelectB} />
            </div>
          </div>
        </div>

        {/* ---------- Loading ---------- */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[var(--cyan)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ---------- Empty State ---------- */}
        {!loading && !bothSelected && (
          <div className="text-center py-20 text-[var(--text3)]">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm font-medium">
              Selecione dois municipios acima para iniciar a comparacao
            </p>
          </div>
        )}

        {/* ---------- Comparison Content ---------- */}
        {bothSelected && (
          <>
            {/* ===== Financial Comparison Cards ===== */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
                Comparacao Financeira
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ComparisonCard
                  label="Receita Total"
                  valueA={safe(muniA.receitaTotal)}
                  valueB={safe(muniB.receitaTotal)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                  formatter={formatCurrency}
                />
                <ComparisonCard
                  label="Ganho / Perda"
                  valueA={safe(muniA.ganhoPerda)}
                  valueB={safe(muniB.ganhoPerda)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                  formatter={formatCurrency}
                />
                <ComparisonCard
                  label="Potencial de Captacao"
                  valueA={safe(muniA.potTotal)}
                  valueB={safe(muniB.potTotal)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                  formatter={formatCurrency}
                />
                <ComparisonCard
                  label="Total Matriculas"
                  valueA={safe(muniA.totalMatriculas)}
                  valueB={safe(muniB.totalMatriculas)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                  formatter={formatNumber}
                />
              </div>
            </section>

            {/* ===== Bar Chart: Key Metrics ===== */}
            <section className="bg-white rounded-xl border border-[var(--border)] p-6 animate-fade-in">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
                Indicadores-Chave
              </h2>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={metricsChartData}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12, fill: "#5A6B80" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#5A6B80" }} tickFormatter={(v: number) => {
                    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                    return String(v);
                  }} />
                  <Tooltip
                    formatter={numberTooltipFormatter}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #DDE3EB",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={muniA.nome} fill={COLOR_A} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={muniB.nome} fill={COLOR_B} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            {/* ===== Revenue Breakdown ===== */}
            <section className="bg-white rounded-xl border border-[var(--border)] p-6 animate-fade-in">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
                Composicao de Receita
              </h2>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={revenueChartData}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="fonte" tick={{ fontSize: 12, fill: "#5A6B80" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#5A6B80" }} tickFormatter={(v: number) => {
                    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                    return String(v);
                  }} />
                  <Tooltip
                    formatter={currencyTooltipFormatter}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #DDE3EB",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={muniA.nome} fill={COLOR_A} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={muniB.nome} fill={COLOR_B} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            {/* ===== Historical Trend ===== */}
            <section className="bg-white rounded-xl border border-[var(--border)] p-6 animate-fade-in">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-4">
                Evolucao Historica (2022-2026)
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={histChartData}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12, fill: "#5A6B80" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#5A6B80" }} tickFormatter={(v: number) => {
                    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                    return String(v);
                  }} />
                  <Tooltip
                    formatter={currencyTooltipFormatter}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #DDE3EB",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey={muniA.nome}
                    stroke={COLOR_A}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLOR_A }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={muniB.nome}
                    stroke={COLOR_B}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: COLOR_B }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </section>

            {/* ===== Infrastructure Comparison ===== */}
            <section className="bg-white rounded-xl border border-[var(--border)] p-6 animate-fade-in">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text3)] mb-6">
                Infraestrutura
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ProgressComparison
                  label="Acesso a Internet (%)"
                  valueA={safe(muniA.pctInternet)}
                  valueB={safe(muniB.pctInternet)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                />
                <ProgressComparison
                  label="Biblioteca (%)"
                  valueA={safe(muniA.pctBiblioteca)}
                  valueB={safe(muniB.pctBiblioteca)}
                  nameA={muniA.nome}
                  nameB={muniB.nome}
                />
              </div>

              {/* SAEB scores table */}
              <div className="mt-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-3">
                  Indicadores SAEB
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-[var(--text3)]">
                          Indicador
                        </th>
                        <th className="text-right py-2 px-4 text-xs font-semibold" style={{ color: COLOR_A }}>
                          {muniA.nome}
                        </th>
                        <th className="text-right py-2 pl-4 text-xs font-semibold" style={{ color: COLOR_B }}>
                          {muniB.nome}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Portugues 5o ano", a: muniA.saeb.port5, b: muniB.saeb.port5 },
                        { label: "Matematica 5o ano", a: muniA.saeb.mat5, b: muniB.saeb.mat5 },
                        { label: "Portugues 9o ano", a: muniA.saeb.port9, b: muniB.saeb.port9 },
                        { label: "Matematica 9o ano", a: muniA.saeb.mat9, b: muniB.saeb.mat9 },
                      ].map((row) => (
                        <tr key={row.label} className="border-b border-[var(--border)]/50">
                          <td className="py-2.5 pr-4 font-medium text-[var(--text)]">{row.label}</td>
                          <td className="py-2.5 px-4 text-right font-semibold" style={{ color: COLOR_A }}>
                            {row.a != null ? row.a.toFixed(1) : "\u2014"}
                          </td>
                          <td className="py-2.5 pl-4 text-right font-semibold" style={{ color: COLOR_B }}>
                            {row.b != null ? row.b.toFixed(1) : "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
