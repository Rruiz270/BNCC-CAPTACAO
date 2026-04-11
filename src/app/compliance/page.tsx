"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { useConsultoria } from "@/lib/consultoria-context";
import { COMPLIANCE_SECTIONS } from "@/lib/constants";

interface SectionProgress {
  section: string;
  total: number;
  done: number;
  progress: number;
}

export default function CompliancePage() {
  const { activeSession, municipality } = useConsultoria();
  const [sectionProgress, setSectionProgress] = useState<Record<string, SectionProgress>>({});
  const [loading, setLoading] = useState(false);

  const municipalityId = activeSession?.municipalityId;

  useEffect(() => {
    if (!municipalityId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset progress when session cleared
      setSectionProgress({});
      return;
    }
    setLoading(true);
    fetch(`/api/compliance?municipalityId=${municipalityId}`)
      .then((r) => r.json())
      .then((data) => {
        const progress: Record<string, SectionProgress> = {};
        for (const section of COMPLIANCE_SECTIONS) {
          const items = (data.items || []).filter(
            (i: { section: string }) => i.section === section.id
          );
          const total = items.length;
          const done = items.filter((i: { status: string }) => i.status === "done").length;
          progress[section.id] = {
            section: section.id,
            total,
            done,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
          };
        }
        setSectionProgress(progress);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [municipalityId]);

  // Overall stats
  const totalItems = COMPLIANCE_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);
  const totalDone = Object.values(sectionProgress).reduce((acc, s) => acc + s.done, 0);
  const overallProgress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Compliance VAAR"
        description="Acompanhamento das condicionalidades FUNDEB"
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* Session info or prompt */}
        {!activeSession ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 text-sm font-semibold">Nenhuma consultoria ativa</p>
            <p className="text-amber-600 text-xs mt-1">Inicie uma consultoria na sidebar para acompanhar o compliance do municipio.</p>
          </div>
        ) : (
          <div className="bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#00E5A0]" />
            <span className="font-semibold text-[var(--navy)]">{municipality?.nome}</span>
          </div>
        )}

        {/* Overall Progress Summary */}
        <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">
                Progresso Geral
              </div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--text)]">
                {loading ? "..." : `${overallProgress}%`}
              </div>
              <div className="text-xs text-[var(--text2)] mt-0.5">
                {totalDone} de {totalItems} itens concluidos
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
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Compliance Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPLIANCE_SECTIONS.map((section) => {
            const sp = sectionProgress[section.id];
            const progress = sp?.progress ?? 0;
            const totalCount = section.items.length;

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
                  {sp ? `${sp.done} de ` : ""}{totalCount} {totalCount === 1 ? "item" : "itens"}{sp ? " concluidos" : " para verificar"}
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
