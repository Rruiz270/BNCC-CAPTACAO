import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PageHeader } from "@/components/page-header";
import { TreinamentoPlayer } from "@/components/treinamento-player";

export const dynamic = "force-dynamic";

const CITY_LABELS: Record<string, { label: string; size: "pequeno" | "medio" | "grande" | "e2e" }> = {
  "pequeno-balbinos": { label: "Balbinos (pequena)", size: "pequeno" },
  "medio-paulinia": { label: "Paulínia (média)", size: "medio" },
  "grande-campinas": { label: "Campinas (grande)", size: "grande" },
  "e2e-paulinia": { label: "Fluxo completo APM → CRM → BNCC (Paulínia)", size: "e2e" },
};

interface SceneData {
  sceneId: string;
  url: string;
  stepLabel: string;
  secretQuestion: string;
  consultorResponse: string;
  screenshotPre: string;
  screenshotPost: string;
  ts: string;
}

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
  scenes: SceneData[];
  errors: Array<{ scene: string; error: string }>;
  durationSec: number;
}

async function loadTranscript(cityKey: string): Promise<TranscriptData | null> {
  try {
    const path = resolve(process.cwd(), "public", "treinamento", "data", `${cityKey}.json`);
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as TranscriptData;
  } catch {
    return null;
  }
}

export default async function TreinamentoCidade({ params }: { params: Promise<{ cityKey: string }> }) {
  const { cityKey } = await params;
  const meta = CITY_LABELS[cityKey];
  if (!meta) notFound();

  const transcript = await loadTranscript(cityKey);

  if (!transcript) {
    return (
      <div>
        <PageHeader
          label="Admin · Treinamento"
          title={meta.label}
          description="Vídeo de treinamento ainda não disponível para esta cidade."
        />
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <p className="text-amber-800 text-sm">
              O conteúdo deste treinamento ainda está sendo gerado. Tente novamente em alguns minutos.
            </p>
            <Link href="/admin/treinamento" className="text-[#00B4D8] hover:underline text-sm mt-3 inline-block">
              ← Voltar para a lista de treinamentos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        label="Admin · Treinamento"
        title={meta.label}
        description={`${(transcript.muni.totalMatriculas ?? 0).toLocaleString("pt-BR")} matrículas · ${transcript.scenes.length} cenas · duração ${Math.floor(transcript.durationSec / 60)}:${String(Math.floor(transcript.durationSec % 60)).padStart(2, "0")}`}
      >
        <Link
          href="/admin/treinamento"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          ← Voltar
        </Link>
      </PageHeader>

      <TreinamentoPlayer cityKey={cityKey} transcript={transcript} />
    </div>
  );
}
