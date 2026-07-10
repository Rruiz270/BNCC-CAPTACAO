"use client";

/**
 * Tooltip de glossário FUNDEB: envolve uma sigla/termo com um "?" discreto
 * que explica o conceito em linguagem de gestor + base legal.
 *
 * Uso: <TermoTooltip termo="vaar" />  ou  <TermoTooltip termo="vaar">VAAR</TermoTooltip>
 */
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { getTermo } from "@/lib/fundeb/glossario";

export function TermoTooltip({ termo, children }: { termo: string; children?: ReactNode }) {
  const def = getTermo(termo);
  if (!def) return <>{children ?? termo}</>;

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help border-b border-dotted border-current/40">
            {children ?? def.sigla}
            <span
              aria-hidden
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500/20 text-[9px] font-bold text-blue-400"
            >
              ?
            </span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[60] max-w-xs rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 shadow-xl"
          >
            <p className="text-[11px] font-semibold text-white">
              {def.sigla} — {def.nome}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{def.explicacao}</p>
            {def.baseLegal && <p className="mt-1.5 text-[10px] text-slate-500">📜 {def.baseLegal}</p>}
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
