import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

interface TreinamentoMeta {
  cityKey: string;
  cityLabel: string;
  municipalityName: string;
  expectedSize: "pequeno" | "medio" | "grande";
  durationSec: number;
  scenesCount: number;
  errorsCount: number;
  matriculas: number | null;
  receitaTotal: number | null;
  potTotal: number | null;
  recebeVaar: boolean;
}

const CITIES: Array<Pick<TreinamentoMeta, "cityKey" | "cityLabel" | "municipalityName" | "expectedSize">> = [
  { cityKey: "pequeno-balbinos", cityLabel: "Balbinos", municipalityName: "Balbinos", expectedSize: "pequeno" },
  { cityKey: "medio-paulinia", cityLabel: "Paulínia", municipalityName: "Paulínia", expectedSize: "medio" },
  { cityKey: "grande-campinas", cityLabel: "Campinas", municipalityName: "Campinas", expectedSize: "grande" },
];

async function loadMeta(cityKey: string): Promise<Partial<TreinamentoMeta> | null> {
  try {
    const path = resolve(process.cwd(), "public", "treinamento", "data", `${cityKey}.json`);
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw);
    return {
      durationSec: data.durationSec ?? 0,
      scenesCount: data.scenes?.length ?? 0,
      errorsCount: data.errors?.length ?? 0,
      matriculas: data.muni?.totalMatriculas ?? null,
      receitaTotal: data.muni?.receitaTotal ?? null,
      potTotal: data.muni?.potTotal ?? null,
      recebeVaar: !!data.muni?.recebeVaar,
    };
  } catch {
    return null;
  }
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

const SIZE_BADGE = {
  pequeno: { bg: "bg-emerald-100", text: "text-emerald-700", label: "PEQUENA" },
  medio: { bg: "bg-amber-100", text: "text-amber-700", label: "MÉDIA" },
  grande: { bg: "bg-cyan-100", text: "text-cyan-700", label: "GRANDE" },
};

export default async function TreinamentoIndex() {
  const cards = await Promise.all(
    CITIES.map(async (c) => ({ ...c, ...(await loadMeta(c.cityKey)) })),
  );

  return (
    <div>
      <PageHeader
        label="Admin · Treinamento"
        title="Treinamento — Plataforma BNCC Captação"
        description="Vídeos de simulação de consultoria FUNDEB. Cada cidade percorre as 10 etapas do wizard + tour pela plataforma, com diálogo entre Secretária de Educação e Consultor i10."
      />

      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => {
            const badge = SIZE_BADGE[card.expectedSize];
            return (
              <Link
                key={card.cityKey}
                href={`/admin/treinamento/${card.cityKey}`}
                className="block bg-white border border-[var(--border)] rounded-xl overflow-hidden hover:border-[#00B4D8] transition-colors group"
              >
                <div className="aspect-video bg-gradient-to-br from-[#0A2463] to-[#0d3280] flex items-center justify-center text-white relative">
                  <div className="text-center">
                    <div className={`inline-block ${badge.bg} ${badge.text} text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2`}>
                      {badge.label}
                    </div>
                    <div className="text-2xl font-extrabold" style={{ fontFamily: "'Source Serif 4', serif" }}>
                      {card.municipalityName}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {(card.matriculas ?? 0).toLocaleString("pt-BR")} matrículas
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#00B4D8] flex items-center justify-center text-white text-xl group-hover:bg-[#00E5A0] transition-colors">
                    ▶
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text3)] uppercase font-bold tracking-wider">
                      Duração
                    </span>
                    <span className="font-semibold text-[var(--text1)] tabular-nums">
                      {card.durationSec ? `${Math.floor(card.durationSec / 60)}:${String(Math.floor(card.durationSec % 60)).padStart(2, "0")}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text3)] uppercase font-bold tracking-wider">
                      Cenas
                    </span>
                    <span className="font-semibold text-[var(--text1)] tabular-nums">
                      {card.scenesCount ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text3)] uppercase font-bold tracking-wider">
                      Receita atual
                    </span>
                    <span className="font-semibold text-[var(--text1)] tabular-nums">
                      {fmt(card.receitaTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text3)] uppercase font-bold tracking-wider">
                      Potencial
                    </span>
                    <span className="font-semibold text-emerald-600 tabular-nums">
                      {fmt(card.potTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text3)] uppercase font-bold tracking-wider">
                      VAAR
                    </span>
                    <span className={`text-xs font-semibold ${card.recebeVaar ? "text-emerald-600" : "text-amber-600"}`}>
                      {card.recebeVaar ? "Recebe" : "Não recebe"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 bg-[var(--bg)] rounded-xl p-6 border border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--navy)] mb-2">
            Como usar o treinamento
          </h2>
          <ul className="text-sm text-[var(--text2)] space-y-1.5 ml-4 list-disc">
            <li>
              Cada vídeo cobre uma cidade de tamanho diferente — escolha conforme o caso real que você está conduzindo.
            </li>
            <li>
              <strong>Balbinos</strong> ilustra município pequeno (~140 alunos), <strong>Paulínia</strong> médio (~14k), <strong>Campinas</strong> grande (~63k).
            </li>
            <li>
              O diálogo simula uma <strong>Secretária de Educação</strong> fazendo perguntas reais e o <strong>Consultor i10</strong> respondendo enquanto navega o sistema.
            </li>
            <li>
              Após o wizard de 9 etapas, o vídeo faz um tour pelas <strong>ferramentas da sidebar</strong> explicando para que serve cada uma (Dashboard, Simulador, Calculadora EC 135, etc).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
