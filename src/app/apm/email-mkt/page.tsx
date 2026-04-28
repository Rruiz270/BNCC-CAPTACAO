"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const STATS_URL = "https://apm-seven.vercel.app/api/stats";

interface MuniStat {
  nome: string;
  pdf: string;
  count: number;
  ultimo_acesso: string | null;
}

interface StatsData {
  total_downloads: number;
  municipios_com_download: number;
  municipios_total: number;
  taxa_abertura: string;
  municipios: MuniStat[];
  ultimos_50: Array<{ municipio: string; pdf: string; ts: string; ip: string }>;
  atualizado_em: string;
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function EmailMktPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(STATS_URL);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = data?.municipios?.filter((m) =>
    search ? m.nome.toLowerCase().includes(search.toLowerCase()) : true,
  ) ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-8">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="text-[#D97706] text-xs font-bold uppercase tracking-widest mb-1">
              Email Marketing &middot; Tracking
            </div>
            <h1 className="text-2xl font-bold">
              Downloads dos relatórios FUNDEB 2026
            </h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">
              Acompanhamento de quem baixou o PDF após o disparo de email para
              os 645 municípios de SP.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
            <Link
              href="/apm/dashboard"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              &larr; Hub APM
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Downloads totais"
            value={data?.total_downloads ?? "—"}
            color="#0D7377"
            loading={loading}
          />
          <StatCard
            label="Municípios que baixaram"
            value={
              data
                ? `${data.municipios_com_download} / ${data.municipios_total}`
                : "—"
            }
            color="#059669"
            loading={loading}
          />
          <StatCard
            label="Taxa de abertura"
            value={data ? `${data.taxa_abertura}%` : "—"}
            color="#D97706"
            loading={loading}
          />
          <StatCard
            label="Municípios sem download"
            value={
              data
                ? data.municipios_total - data.municipios_com_download
                : "—"
            }
            color="#DC2626"
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Recent activity */}
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] font-bold text-sm text-[#0D7377]">
              Atividade recente
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {!data || data.ultimos_50.length === 0 ? (
                <div className="p-8 text-center text-[var(--text3)] text-sm">
                  {loading
                    ? "Carregando..."
                    : "Nenhum download registrado ainda."}
                </div>
              ) : (
                data.ultimos_50.slice(0, 20).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#0D7377] mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-[var(--text)]">
                        {item.municipio}
                      </div>
                      <div className="text-xs text-[var(--text3)]">
                        {timeAgo(item.ts)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top municipalities */}
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] font-bold text-sm text-[#0D7377]">
              Top municípios por downloads
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {!data ||
              data.municipios.filter((m) => m.count > 0).length === 0 ? (
                <div className="p-8 text-center text-[var(--text3)] text-sm">
                  {loading
                    ? "Carregando..."
                    : "O ranking aparece após os primeiros downloads."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase text-[var(--text3)] bg-gray-50 border-b border-[var(--border)]">
                      <th className="text-left px-5 py-2 font-semibold tracking-wider">
                        Município
                      </th>
                      <th className="text-left px-5 py-2 font-semibold tracking-wider">
                        Downloads
                      </th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.municipios
                      .filter((m) => m.count > 0)
                      .slice(0, 15)
                      .map((m) => {
                        const max = data.municipios[0]?.count || 1;
                        return (
                          <tr
                            key={m.pdf}
                            className="border-b border-gray-50 last:border-0"
                          >
                            <td className="px-5 py-2 font-semibold">
                              {m.nome}
                            </td>
                            <td className="px-5 py-2">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                {m.count}x
                              </span>
                            </td>
                            <td className="px-5 py-2 w-[40%]">
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#0D7377] to-[#00E5A0]"
                                  style={{
                                    width: `${(m.count / max) * 100}%`,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Full table */}
        <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <span className="font-bold text-sm text-[#0D7377]">
              Todos os municípios
            </span>
            <input
              type="text"
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm w-56 outline-none focus:border-[#0D7377]"
            />
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loading && !data ? (
              <div className="p-8 text-center text-[var(--text3)] text-sm">
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-[var(--text3)] text-sm">
                Nenhum município encontrado.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--text3)] bg-gray-50 border-b border-[var(--border)] sticky top-0">
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">
                      Município
                    </th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">
                      Downloads
                    </th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">
                      Último acesso
                    </th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.pdf}
                      className="border-b border-gray-50 hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-2 font-semibold">{m.nome}</td>
                      <td className="px-5 py-2">
                        {m.count > 0 ? `${m.count}x` : "—"}
                      </td>
                      <td className="px-5 py-2 text-[var(--text3)]">
                        {m.ultimo_acesso ? timeAgo(m.ultimo_acesso) : "—"}
                      </td>
                      <td className="px-5 py-2">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            m.count > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-[var(--text3)]"
                          }`}
                        >
                          {m.count > 0 ? "Baixou" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {data && (
          <div className="text-center text-xs text-[var(--text3)] py-4">
            Atualizado em{" "}
            {new Date(data.atualizado_em).toLocaleString("pt-BR")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      className="bg-white border border-[var(--border)] rounded-xl p-5 text-center relative overflow-hidden"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="text-2xl font-black text-[#0D7377] tracking-tight mb-1">
        {loading && value === "—" ? "..." : value}
      </div>
      <div className="text-xs text-[var(--text3)] font-medium">{label}</div>
    </div>
  );
}
