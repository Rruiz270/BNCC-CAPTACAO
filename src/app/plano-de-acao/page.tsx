"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MunicipalitySelector } from "@/components/municipality-selector";
import { ACTION_PLAN_WEEKS } from "@/lib/constants";

export default function PlanoDeAcaoPage() {
  const [municipalityId, setMunicipalityId] = useState<number | undefined>();

  const totalWeeks = ACTION_PLAN_WEEKS.length;

  return (
    <div>
      <PageHeader
        title="Plano de Acao"
        description="Cronograma de 7 semanas para otimizacao FUNDEB"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Municipality Selector */}
        <div className="max-w-md">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-2">
            Municipio
          </label>
          <MunicipalitySelector
            value={municipalityId}
            onChange={(id) => setMunicipalityId(id)}
          />
        </div>

        {/* Overall Progress */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso Geral do Plano
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--text)]">
                0%
              </div>
              <div className="text-xs text-[var(--text2)] mt-0.5">
                0 de {totalWeeks} semanas concluidas
              </div>
            </div>
            <div>
              <svg className="w-10 h-10 text-[var(--cyan)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 w-full bg-[var(--bg)] rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[var(--cyan)] transition-all duration-500"
              style={{ width: "0%" }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {ACTION_PLAN_WEEKS.map((week, index) => {
            const isLast = index === ACTION_PLAN_WEEKS.length - 1;

            return (
              <Link
                key={week.semana}
                href={`/plano-de-acao/${week.semana}`}
                className="group block animate-fade-in"
              >
                <div className="relative flex items-stretch gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center w-8 flex-shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border-2 mt-5 flex-shrink-0"
                      style={{
                        borderColor: week.color,
                        backgroundColor: "white",
                      }}
                    />
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 mt-1"
                        style={{ backgroundColor: `${week.color}33` }}
                      />
                    )}
                  </div>

                  {/* Week Card */}
                  <div
                    className="flex-1 bg-white border rounded-xl p-5 mb-2 hover:shadow-lg transition-all group-hover:border-opacity-60"
                    style={{ borderColor: `${week.color}40` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Week number badge */}
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold"
                            style={{ backgroundColor: week.color }}
                          >
                            {week.semana}
                          </span>
                          <h3 className="text-sm font-bold text-[var(--text)]">
                            {week.label}
                          </h3>
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text2)] ml-10">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {week.dates}
                        </div>

                        {/* Progress */}
                        <div className="mt-3 ml-10">
                          <div className="flex justify-between text-[10px] font-semibold mb-1">
                            <span className="text-[var(--text3)]">Progresso</span>
                            <span className="text-[var(--text2)]">0%</span>
                          </div>
                          <div className="w-full bg-[var(--bg)] rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{ width: "0%", backgroundColor: week.color }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <svg
                        className="w-4 h-4 text-[var(--text3)] group-hover:text-[var(--cyan)] transition-colors mt-1 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
