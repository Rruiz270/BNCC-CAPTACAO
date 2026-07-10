"use client";

/**
 * Benchmark de municípios similares (mesmo UF e porte de rede) — argumento
 * comparativo: "quem se parece com você e capta melhor".
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Similar {
  id: number;
  nome: string;
  uf: string;
  total_matriculas: number | null;
  receita_total: number | null;
  pot_total: number | null;
  pct_pot_total: number | null;
  vaar: number | null;
  recebe_vaar: boolean | null;
  ideb_ai: number | null;
  t6_pct_integral: number | null;
}

interface Payload {
  referencia: { id: number; nome: string; uf: string; totalMatriculas: number };
  similares: Similar[];
  insights: {
    total: number;
    recebemVaar: number;
    pctIntegralMedio: number | null;
    potencialMedio: number | null;
    idebMedio: number | null;
  } | null;
}

export function BenchmarkSimilares({ slug }: { slug: string | number }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch(`/api/municipalities/${slug}/similares`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [slug]);

  if (!data || !data.similares?.length) return null;
  const { insights } = data;

  return (
    <section className="bg-white border border-[var(--border)] rounded-xl p-6">
      <h2 className="text-sm font-bold text-[var(--text1)] mb-1">
        Municípios similares em {data.referencia.uf}
      </h2>
      <p className="text-xs text-[var(--text3)] mb-4">
        Redes de porte comparável ({formatNumber(Math.round(data.referencia.totalMatriculas * 0.5))}–
        {formatNumber(data.referencia.totalMatriculas * 2)} matrículas).
        {insights && insights.recebemVaar > 0 && (
          <>
            {" "}
            <strong className="text-[var(--text2)]">
              {insights.recebemVaar} de {insights.total} já recebem VAAR
            </strong>{" "}
            — evidência de que o destravamento é alcançável para este porte.
          </>
        )}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Município", "Matrículas", "Receita FUNDEB", "Potencial", "IDEB AI", "% Integral", "VAAR"].map((h) => (
                <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.similares.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
                <td className="py-2 px-3">
                  <Link href={`/diagnostico/${s.id}`} className="font-semibold text-[var(--text1)] hover:text-[#00B4D8]">
                    {s.nome}
                  </Link>
                </td>
                <td className="py-2 px-3 text-[var(--text2)]">{formatNumber(Number(s.total_matriculas) || 0)}</td>
                <td className="py-2 px-3 text-[var(--text2)]">{s.receita_total ? formatCurrency(Number(s.receita_total)) : "—"}</td>
                <td className="py-2 px-3 font-semibold text-[#00B4D8]">{s.pot_total ? formatCurrency(Number(s.pot_total)) : "—"}</td>
                <td className="py-2 px-3 text-[var(--text2)]">{s.ideb_ai ?? "—"}</td>
                <td className="py-2 px-3 text-[var(--text2)]">
                  {s.t6_pct_integral != null ? `${Number(s.t6_pct_integral).toFixed(0)}%` : "—"}
                </td>
                <td className="py-2 px-3">
                  {s.recebe_vaar || Number(s.vaar) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">recebe</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-500">não recebe</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
