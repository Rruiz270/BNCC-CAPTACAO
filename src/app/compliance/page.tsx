"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MunicipalitySelector } from "@/components/municipality-selector";
import { COMPLIANCE_SECTIONS } from "@/lib/constants";

export default function CompliancePage() {
  const [municipalityId, setMunicipalityId] = useState<number | undefined>();

  return (
    <div>
      <PageHeader
        title="Compliance VAAR"
        description="Acompanhamento das condicionalidades FUNDEB"
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

        {/* Overall Progress Summary */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso Geral
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--text)]">
                0%
              </div>
              <div className="text-xs text-[var(--text2)] mt-0.5">
                0 de {COMPLIANCE_SECTIONS.reduce((acc, s) => acc + s.items.length, 0)} itens concluidos
              </div>
            </div>
            <div className="text-3xl opacity-40">
              <svg className="w-10 h-10 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

        {/* Compliance Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPLIANCE_SECTIONS.map((section) => {
            const totalItems = section.items.length;
            const progress = 0;

            return (
              <Link
                key={section.id}
                href={`/compliance/${section.id}`}
                className="group bg-white border border-[var(--border)] rounded-xl p-5 hover:border-[var(--cyan)] hover:shadow-lg transition-all animate-fade-in"
              >
                {/* Section Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--navy)] text-white text-sm font-bold">
                      {section.id}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text)] group-hover:text-[var(--navy)]">
                        {section.name}
                      </h3>
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 text-[var(--text3)] group-hover:text-[var(--cyan)] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--text2)] mb-3">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Prazo: {section.deadline}
                </div>

                {/* Item Count */}
                <div className="text-xs text-[var(--text3)] mb-3">
                  {totalItems} {totalItems === 1 ? "item" : "itens"} para verificar
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span className="text-[var(--text3)]">Progresso</span>
                    <span className="text-[var(--text2)]">{progress}%</span>
                  </div>
                  <div className="w-full bg-[var(--bg)] rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-[var(--cyan)] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
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
