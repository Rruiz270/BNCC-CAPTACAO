'use client';

/**
 * Componentes visuais que consomem GainResult da engine.
 * Compartilhados entre intake (público), wizard (autenticado) e telão.
 *
 * Sem fetch, sem state interno — pura apresentação. Quem chama passa
 * `result` recalculado em useMemo a cada onChange dos inputs.
 */

import { useEffect, useRef, useState } from 'react';
import type { GainResult } from '@/lib/fundeb/gain';
import { describeVaarGap, gainHighlights } from '@/lib/fundeb/gain';
import { formatCurrency } from '@/lib/utils';

// ─── Hook: número anima quando muda (counting effect) ─────────────────

function useAnimatedNumber(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === display) return;
    fromRef.current = display;
    startRef.current = performance.now();
    const from = fromRef.current;
    const delta = target - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      // ease-out cúbica (smooth landing)
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}

// ─── Big card (intake topo + tela pós-submit + telão) ─────────────────

export function GainBigCard({
  result,
  variant = 'live',
  municipioName,
}: {
  result: GainResult;
  variant?: 'live' | 'final' | 'telao';
  municipioName?: string;
}) {
  const garantido = useAnimatedNumber(result.ganhoGarantido);
  const destravar = useAnimatedNumber(result.potencialDestravar);
  const total = useAnimatedNumber(result.totalOtimizado);
  const highlights = gainHighlights(result);

  const sizes = {
    live: { ganho: 'text-3xl md:text-4xl', total: 'text-lg', label: 'text-xs', sub: 'text-[10px]' },
    final: { ganho: 'text-4xl md:text-5xl', total: 'text-xl', label: 'text-sm', sub: 'text-xs' },
    telao: { ganho: 'text-6xl md:text-8xl', total: 'text-3xl', label: 'text-base', sub: 'text-sm' },
  }[variant];

  return (
    <div className="bg-gradient-to-br from-[#00B4D8]/5 to-[#00E5A0]/5 border border-[#00B4D8]/30 rounded-2xl p-6 md:p-8">
      {municipioName && (
        <div className={`${sizes.label} font-semibold uppercase tracking-wider text-[var(--text2)] mb-2`}>
          {municipioName}
        </div>
      )}
      <div className={`${sizes.label} font-semibold uppercase tracking-wider text-[#00B4D8] mb-3`}>
        {variant === 'live'
          ? 'Potencial identificado em tempo real'
          : variant === 'final'
            ? 'Potencial identificado nesta consultoria'
            : 'Potencial FUNDEB identificado'}
      </div>

      {/* Dois números lado-a-lado: garantido (verde, sólido) + a destravar (âmbar, condicional) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <div className={`${sizes.sub} font-bold uppercase tracking-wider text-emerald-700 mb-1`}>
            Ganho garantido
          </div>
          <div className={`${sizes.ganho} font-extrabold text-emerald-700 tabular-nums leading-tight`}>
            {formatCurrency(Math.max(0, garantido))}
          </div>
          <div className={`${sizes.sub} text-emerald-600 mt-1`}>
            Cadastro correto no Censo · sem depender de outros gates
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className={`${sizes.sub} font-bold uppercase tracking-wider text-amber-700 mb-1`}>
            Potencial a destravar
          </div>
          <div className={`${sizes.ganho} font-extrabold text-amber-700 tabular-nums leading-tight`}>
            {formatCurrency(Math.max(0, destravar))}
          </div>
          <div className={`${sizes.sub} text-amber-600 mt-1`}>
            VAAR — exige cumprir 5 condicionalidades + meta IDEB
          </div>
        </div>
      </div>

      <div className={`${sizes.label} text-[var(--text2)] mt-4`}>
        Receita otimizada total: <span className={`${sizes.total} font-bold text-[var(--navy)] tabular-nums ml-1`}>{formatCurrency(Math.max(0, total))}</span>
      </div>

      {highlights.length > 0 && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2">
          {highlights.slice(0, 4).map((h) => (
            <div
              key={h.label}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                h.color === 'green'
                  ? 'bg-emerald-50 border border-emerald-100'
                  : h.color === 'amber'
                    ? 'bg-amber-50 border border-amber-100'
                    : 'bg-cyan-50 border border-cyan-100'
              }`}
            >
              <span className={`text-xs font-medium ${
                h.color === 'green' ? 'text-emerald-700'
                : h.color === 'amber' ? 'text-amber-700'
                : 'text-cyan-700'
              }`}>
                {h.label}
              </span>
              <span className={`text-sm font-bold tabular-nums ${
                h.color === 'green' ? 'text-emerald-800'
                : h.color === 'amber' ? 'text-amber-800'
                : 'text-cyan-800'
              }`}>
                {formatCurrency(h.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {!result.vaar.elegivel && result.vaar.gaps.length > 0 && (
        <div className="mt-4 bg-white border border-amber-200 rounded-lg p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
            Para destravar o VAAR ({(result.vaar.overallProgress * 100).toFixed(0)}% do caminho)
          </div>
          <div className="space-y-1">
            {result.vaar.gaps.map((g, i) => (
              <div key={i} className="text-xs text-[var(--text2)] flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{describeVaarGap(g)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${result.vaar.overallProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sticky bar (wizard internal — bem mais discreto) ─────────────────

export function GainStickyBar({
  result,
  stepLabel,
}: {
  result: GainResult;
  stepLabel?: string;
}) {
  const garantido = useAnimatedNumber(result.ganhoGarantido);
  const destravar = useAnimatedNumber(result.potencialDestravar);

  return (
    <div className="sticky top-0 z-20 bg-[var(--navy)] text-white px-6 py-2 flex items-center justify-between text-sm shadow-md">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">
            Garantido
          </span>
          <span className="text-base font-extrabold tabular-nums text-emerald-300">
            {formatCurrency(Math.max(0, garantido))}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">
            A destravar
          </span>
          <span className="text-base font-extrabold tabular-nums text-amber-300">
            {formatCurrency(Math.max(0, destravar))}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/60">
        {stepLabel && <span>{stepLabel}</span>}
        <span className="hidden md:inline">
          VAAR {result.vaar.elegivel ? 'destravado' : `${(result.vaar.overallProgress * 100).toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Breakdown completo (relatório, telão, pós-submit detalhado) ─────

export function GainBreakdownTable({ result }: { result: GainResult }) {
  const rows = [
    { label: 'VAAF (matrículas atuais + reclassificação)', atual: result.vaaf.atual, otimizado: result.vaaf.otimizado, ganho: result.vaaf.ganho },
    { label: 'PETI (jornada integral)', atual: result.peti.atual, otimizado: result.peti.otimizado, ganho: result.peti.ganho },
    {
      label: 'Multiplicadores (campo / indígena / quilombola)',
      atual: 0,
      otimizado: result.multiplicadores.totalGanho,
      ganho: result.multiplicadores.totalGanho,
    },
    {
      label: result.vaar.elegivel
        ? 'VAAR (estimado — município elegível)'
        : 'VAAR (potencial — falta destravar)',
      atual: result.vaar.atual,
      otimizado: result.vaar.elegivel ? result.vaar.atual : result.vaar.potencial,
      ganho: result.vaar.elegivel ? 0 : result.vaar.potencial,
    },
    { label: 'VAAT (mantido)', atual: result.vaat.atual, otimizado: result.vaat.atual, ganho: 0 },
  ];

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--navy)] text-white text-xs uppercase">
            <th className="text-left px-4 py-2.5 font-semibold tracking-wider">Componente</th>
            <th className="text-right px-4 py-2.5 font-semibold tracking-wider">Atual</th>
            <th className="text-right px-4 py-2.5 font-semibold tracking-wider">Otimizado</th>
            <th className="text-right px-4 py-2.5 font-semibold tracking-wider">Ganho</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--border)]">
              <td className="px-4 py-3 text-[var(--text2)]">{r.label}</td>
              <td className="px-4 py-3 text-right tabular-nums text-[var(--text3)]">
                {formatCurrency(r.atual)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCurrency(r.otimizado)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                r.ganho > 0 ? 'text-emerald-600' : r.ganho < 0 ? 'text-red-500' : 'text-[var(--text3)]'
              }`}>
                {r.ganho > 0 ? '+' : ''}{formatCurrency(r.ganho)}
              </td>
            </tr>
          ))}
          <tr className="bg-[var(--bg)] font-bold">
            <td className="px-4 py-3 text-[var(--navy)]">Total</td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatCurrency(result.totalAtual)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-[var(--navy)]">
              {formatCurrency(result.totalOtimizado)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-emerald-600 text-base">
              +{formatCurrency(result.ganhoTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
