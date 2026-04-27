import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TreinamentoPlayer } from "@/components/treinamento-player";

export const dynamic = "force-dynamic";

const CITY_LABELS: Record<
  string,
  { label: string; size: string }
> = {
  "pequeno-balbinos": { label: "Balbinos (pequena)", size: "pequeno" },
  "medio-paulinia": { label: "Paulínia (média)", size: "medio" },
  "grande-campinas": { label: "Campinas (grande)", size: "grande" },
  "e2e-paulinia": {
    label: "Fluxo completo APM → CRM → BNCC (Paulínia)",
    size: "e2e",
  },
};

interface TranscriptData {
  muni: {
    id: number;
    nome: string;
    totalMatriculas: number | null;
    receitaTotal: number | null;
    potTotal: number | null;
    recebeVaar: boolean;
    vaarBanco: number | null;
    idebAi: number | null;
  };
  consId: number;
  scenes: Array<{
    sceneId: string;
    url: string;
    stepLabel: string;
    secretQuestion: string;
    consultorResponse: string;
    screenshotPre: string;
    screenshotPost: string;
    ts: string;
  }>;
  errors: Array<{ scene: string; error: string }>;
  durationSec: number;
}

async function loadTranscript(
  cityKey: string,
): Promise<TranscriptData | null> {
  try {
    const path = resolve(
      process.cwd(),
      "public",
      "treinamento",
      "data",
      `${cityKey}.json`,
    );
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as TranscriptData;
  } catch {
    return null;
  }
}

export default async function TreinamentoPublico({
  params,
}: {
  params: Promise<{ cityKey: string }>;
}) {
  const { cityKey } = await params;
  const meta = CITY_LABELS[cityKey];
  if (!meta) notFound();

  const transcript = await loadTranscript(cityKey);

  if (!transcript) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-[#00B4D8] text-xs font-bold uppercase tracking-widest mb-1">
              Treinamento APM
            </div>
            <h1 className="text-2xl font-bold">{meta.label}</h1>
            <p className="text-white/60 text-sm mt-1">
              Vídeo ainda não disponível.
            </p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <p className="text-amber-800 text-sm">
              O conteúdo deste treinamento ainda está sendo gerado. Tente
              novamente em alguns minutos.
            </p>
            <Link
              href="/apm/dashboard"
              className="text-[#00B4D8] hover:underline text-sm mt-3 inline-block"
            >
              &larr; Voltar ao Hub APM
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtitle = `${(transcript.muni.totalMatriculas ?? 0).toLocaleString("pt-BR")} matrículas · ${transcript.scenes.length} cenas · duração ${Math.floor(transcript.durationSec / 60)}:${String(Math.floor(transcript.durationSec % 60)).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-8">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="text-[#00B4D8] text-xs font-bold uppercase tracking-widest mb-1">
              Treinamento APM
            </div>
            <h1 className="text-2xl font-bold">{meta.label}</h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">{subtitle}</p>
          </div>
          <Link
            href="/apm/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors flex-shrink-0"
          >
            &larr; Voltar
          </Link>
        </div>
      </div>

      <TreinamentoPlayer cityKey={cityKey} transcript={transcript} />
    </div>
  );
}
