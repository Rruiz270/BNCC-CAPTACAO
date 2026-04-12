"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { useConsultoria } from "@/lib/consultoria-context";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Municipality {
  id: number;
  nome: string;
  receitaTotal: number;
  totalMatriculas: number;
  potTotal: number;
  pctPotTotal: number;
  ganhoPerda: number;
  hist: {
    "2022": number;
    "2023": number;
    "2024": number;
    "2025": number;
    "2026": number;
  };
}

interface Stats {
  totalMunicipalities: number;
  gaining: number;
  losing: number;
  totalGanhoPerda: number;
  totalPotencial: number;
  avgPotPct: number;
  totalEnrollments: number;
  totalRevenue: number;
}

interface ApiResponse {
  data: Municipality[];
  stats: Stats;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 rounded mb-6" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-6 animate-pulse">
      <div className="h-5 w-56 bg-gray-200 rounded mb-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          <div className="h-4 flex-1 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

const COLORS_PIE = ["#00E5A0", "#D4553A"];

export default function DashboardPage() {
  const { activeSession, municipality } = useConsultoria();
  const [data, setData] = useState<Municipality[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/municipalities?limit=645");
        if (!res.ok) throw new Error("Falha ao carregar dados");
        const json: ApiResponse = await res.json();
        setData(json.data);
        setStats(json.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const revenueHistory = data.length > 0
    ? (["2022", "2023", "2024", "2025", "2026"] as const).map((year) => ({
        year,
        total: data.reduce((sum, m) => sum + (Number(m.hist[year]) || 0), 0),
      }))
    : [];

  const top10 = [...data]
    .sort((a, b) => (Number(b.potTotal) || 0) - (Number(a.potTotal) || 0))
    .slice(0, 10);

  const pieData =
    stats
      ? [
          { name: "Ganham", value: stats.gaining },
          { name: "Perdem", value: stats.losing },
        ]
      : [];

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Visao geral do FUNDEB SP 2026 - 645 municipios" />
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-semibold">Erro ao carregar dados</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Visao geral do FUNDEB SP 2026 - 645 municipios" />

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Session-Aware Panel */}
        {activeSession && municipality && (
          <div className="bg-gradient-to-r from-[var(--navy)] to-[#0A2463]/80 rounded-xl p-6 text-white animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#00B4D8] mb-1">
              Consultoria Ativa
            </div>
            <div className="text-xl font-extrabold mb-4">{municipality.nome}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] uppercase text-white/50">Compliance</div>
                <div className="text-lg font-bold text-[#00E5A0]">{activeSession.complianceProgress ?? 0}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/50">Plano de Acao</div>
                <div className="text-lg font-bold text-[#48CAE4]">{activeSession.actionPlanProgress ?? 0}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/50">Matriculas</div>
                <div className="text-lg font-bold">{municipality.totalMatriculas ? formatNumber(municipality.totalMatriculas) : "-"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/50">Receita FUNDEB</div>
                <div className="text-lg font-bold">{municipality.receitaTotal ? formatCurrency(municipality.receitaTotal) : "-"}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Link href="/compliance" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors">
                Compliance
              </Link>
              <Link href="/plano-de-acao" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors">
                Plano de Acao
              </Link>
              <Link href="/implementacao/minuta" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors">
                Minuta CME
              </Link>
              <Link href="/simulador" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors">
                Simulador
              </Link>
            </div>
          </div>
        )}

        {/* KPI Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : stats ? (
            <>
              <StatCard label="Total Municipios" value={formatNumber(stats.totalMunicipalities)} icon="&#x1f3db;&#xfe0f;" color="#0A2463" />
              <StatCard label="Total Matriculas" value={formatNumber(Number(stats.totalEnrollments))} icon="&#x1f393;" color="#0A2463" />
              <StatCard label="Receita Total FUNDEB" value={formatCurrency(Number(stats.totalRevenue))} icon="&#x1f4b0;" color="#00B4D8" />
              <StatCard label="Potencial de Captacao" value={formatCurrency(Number(stats.totalPotencial))} sub="Valor total recuperavel" icon="&#x1f680;" color="#00E5A0" />
            </>
          ) : null}
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : stats ? (
            <>
              <StatCard label="Municipios que Ganham" value={formatNumber(stats.gaining)} sub={`${((stats.gaining / stats.totalMunicipalities) * 100).toFixed(1)}% do total`} icon="&#x1f4c8;" color="#00E5A0" />
              <StatCard label="Municipios que Perdem" value={formatNumber(stats.losing)} sub={`${((stats.losing / stats.totalMunicipalities) * 100).toFixed(1)}% do total`} icon="&#x1f4c9;" color="#D4553A" />
              <StatCard label="Impacto Medio" value={formatPercent(Number(stats.avgPotPct))} sub="% medio de potencial sobre receita" icon="&#x26a1;" color="#0A2463" />
            </>
          ) : null}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="lg:col-span-2"><SkeletonChart /></div>
          ) : (
            <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-sm font-bold text-[var(--text1)] mb-1">Historico de Receita FUNDEB</h2>
              <p className="text-xs text-[var(--text3)] mb-4">Receita total agregada por ano (todos os municipios)</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueHistory} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#6b7280" }} />
                    <YAxis tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11, fill: "#6b7280" }} width={90} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), "Receita Total"]}
                      labelFormatter={(label) => `Ano ${label}`}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {revenueHistory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.year === "2026" ? "#00B4D8" : "#0A2463"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {loading ? (
            <SkeletonChart />
          ) : (
            <div className="bg-white border border-[var(--border)] rounded-xl p-6">
              <h2 className="text-sm font-bold text-[var(--text1)] mb-1">Distribuicao Ganho/Perda</h2>
              <p className="text-xs text-[var(--text3)] mb-4">Municipios que ganham vs. perdem com o FUNDEB</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="value"
                      stroke="none"
                      label={({ name, value }) => `${name ?? ""}: ${value ?? ""}`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`pie-${index}`} fill={COLORS_PIE[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#00E5A0]" />
                  <span className="text-xs text-[var(--text2)]">Ganham ({stats?.gaining ?? 0})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#D4553A]" />
                  <span className="text-xs text-[var(--text2)]">Perdem ({stats?.losing ?? 0})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top 10 Table */}
        {loading ? (
          <SkeletonTable />
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[var(--text1)] mb-1">Top 10 Municipios por Potencial de Captacao</h2>
            <p className="text-xs text-[var(--text3)] mb-4">Municipios com maior potencial de recuperacao de recursos FUNDEB</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">#</th>
                    <th className="text-left py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Municipio</th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Matriculas</th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Receita Total</th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Potencial</th>
                    <th className="text-right py-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">% Potencial</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((m, i) => (
                    <Link key={m.id} href={`/diagnostico/${m.id}`} className="contents">
                      <tr className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer">
                        <td className="py-3 px-3 text-[var(--text3)] font-mono text-xs">{i + 1}</td>
                        <td className="py-3 px-3 font-semibold text-[var(--text1)]">{m.nome}</td>
                        <td className="py-3 px-3 text-right text-[var(--text2)]">{formatNumber(Number(m.totalMatriculas))}</td>
                        <td className="py-3 px-3 text-right text-[var(--text2)]">{formatCurrency(Number(m.receitaTotal))}</td>
                        <td className="py-3 px-3 text-right font-semibold text-[#00B4D8]">{formatCurrency(Number(m.potTotal))}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${Number(m.pctPotTotal) > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                            {formatPercent(Number(m.pctPotTotal))}
                          </span>
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
