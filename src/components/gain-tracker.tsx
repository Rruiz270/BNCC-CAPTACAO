'use client';

/**
 * GainTracker — sticky bar no topo de cada step do wizard.
 * Busca município + intake response e roda a engine.
 *
 * Faz fetch leve no client (3 calls) e cacheia em estado por consultoria.
 * Recalcula via useMemo quando dados mudam — mas como wizard está parado
 * num step, na prática o número fica estático até o consultor mexer em
 * compliance/scenarios e disparar refresh externo (event bus futuro).
 */

import { useEffect, useState, useMemo } from 'react';
import { calculateGain, type GainResult, type IntakeInput, type MunicipalityInput } from '@/lib/fundeb/gain';
import { GainStickyBar } from '@/components/gain-display';

interface MuniDetail {
  id: number;
  nome: string;
  enrollmentSummary: { totalMatriculas: number | null; eiMat: number | null; efMat: number | null };
  financials: { receitaTotal: number | null; vaat: number | null; vaar: number | null };
  potencial: { potTotal: number | null };
  schools: { rurais: number | null };
  educationMetrics: { idebAi: number | null; idebAf: number | null };
  compliance: {
    summary: Record<string, { total: number; done: number; progress: number; pending: number }>;
  };
}

interface IntakeResponseData {
  data: Record<string, unknown> | null;
}

export function GainTracker({
  consultoriaId,
  stepLabel,
}: {
  consultoriaId: number;
  stepLabel?: string;
}) {
  const [muni, setMuni] = useState<MuniDetail | null>(null);
  const [intakeData, setIntakeData] = useState<IntakeResponseData['data'] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Busca direta — `/api/consultorias` (lista) usa view=mine por default.
        const consRes = await fetch(`/api/consultorias/${consultoriaId}`);
        const consJson = await consRes.json();
        if (consJson.error || !consJson.municipalityId) return;

        const [muniRes, intakeRes] = await Promise.all([
          fetch(`/api/municipalities/${consJson.municipalityId}`),
          fetch(`/api/intake?consultoriaId=${consultoriaId}`),
        ]);
        const muniJson = await muniRes.json();
        const intakeJson = await intakeRes.json();

        if (cancelled) return;
        setMuni(muniJson);
        setIntakeData(intakeJson.response?.data ?? null);
      } catch {
        // best-effort — sticky bar é decorativo, falha não bloqueia wizard
      }
    }
    load();
    return () => { cancelled = true; };
  }, [consultoriaId]);

  const gainResult: GainResult | null = useMemo(() => {
    if (!muni) return null;
    const complianceA = muni.compliance?.summary?.A;
    const muniInput: MunicipalityInput = {
      id: muni.id,
      nome: muni.nome,
      totalMatriculas: muni.enrollmentSummary?.totalMatriculas ?? null,
      receitaTotal: muni.financials?.receitaTotal ?? null,
      vaat: muni.financials?.vaat ?? null,
      vaar: muni.financials?.vaar ?? null,
      potTotal: muni.potencial?.potTotal ?? null,
      idebAi: muni.educationMetrics?.idebAi ?? null,
      idebAf: muni.educationMetrics?.idebAf ?? null,
      escolasRurais: muni.schools?.rurais ?? null,
      eiMat: muni.enrollmentSummary?.eiMat ?? null,
      efMat: muni.enrollmentSummary?.efMat ?? null,
      complianceASectionDone: complianceA?.done ?? null,
      complianceASectionTotal: complianceA?.total ?? null,
    };

    const intake: IntakeInput = intakeData
      ? {
          schoolsTotal: pickNum(intakeData, 'schoolsTotal'),
          schoolsRural: pickNum(intakeData, 'schoolsRural'),
          alunosAee: pickNum(intakeData, 'alunosAee'),
          alunosDuplaMatricula: pickNum(intakeData, 'alunosDuplaMatricula'),
          alunosClasseEspecial: pickNum(intakeData, 'alunosClasseEspecial'),
          alunosCampo: pickNum(intakeData, 'alunosCampo'),
          alunosIndigena: pickNum(intakeData, 'alunosIndigena'),
          alunosQuilombola: pickNum(intakeData, 'alunosQuilombola'),
          escolasCampo: pickNum(intakeData, 'escolasCampo'),
          escolasIndigena: pickNum(intakeData, 'escolasIndigena'),
          escolasQuilombola: pickNum(intakeData, 'escolasQuilombola'),
          alunosIntegral: pickNum(intakeData, 'alunosIntegral'),
          escolasIntegral: pickNum(intakeData, 'escolasIntegral'),
        }
      : {};

    return calculateGain(muniInput, intake);
  }, [muni, intakeData]);

  if (!gainResult) return null;
  return <GainStickyBar result={gainResult} stepLabel={stepLabel} />;
}

function pickNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
