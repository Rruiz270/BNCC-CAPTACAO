import Link from "next/link";
import Image from "next/image";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hub do time APM | Instituto i10",
  description:
    "Cadastro de leads, downloads do kit, métricas do email marketing pós-evento e treinamento operacional da plataforma BNCC Captação.",
};

const APM_LOGO_URL =
  "https://apm-seven.vercel.app/fundeb-sp/apm-logo-pill-web.png";

const EMAIL_MKT_DASHBOARD_URL =
  "https://www.institutoi10.com.br/sistemas/apm/dashboard";

interface CardDef {
  tag: string;
  tagColor: string;
  title: string;
  sub: string;
  href: string | null;
  external?: boolean;
  available: boolean;
}

const CARDS: CardDef[] = [
  {
    tag: "CADASTRO",
    tagColor: "#0D7377",
    title: "Registrar leads",
    sub: "Formulário operacional",
    href: "/apm",
    available: true,
  },
  {
    tag: "DOWNLOADS",
    tagColor: "#00B4D8",
    title: "Kit de implementação",
    sub: "Em breve",
    href: null,
    available: false,
  },
  {
    tag: "CAMPANHAS",
    tagColor: "#D97706",
    title: "Email + WhatsApp",
    sub: "Tracking de downloads",
    href: "/apm/email-mkt",
    available: true,
  },
  {
    tag: "TREINAMENTO",
    tagColor: "#059669",
    title: "3 simulações",
    sub: "Disponível agora",
    href: "#treinamento",
    available: true,
  },
];

interface CityMeta {
  cityKey: string;
  cityLabel: string;
  expectedSize: "pequeno" | "medio" | "grande";
  durationSec?: number;
  scenesCount?: number;
  matriculas?: number | null;
}

const CITIES: Omit<CityMeta, "durationSec" | "scenesCount" | "matriculas">[] =
  [
    {
      cityKey: "pequeno-balbinos",
      cityLabel: "Balbinos",
      expectedSize: "pequeno",
    },
    {
      cityKey: "medio-paulinia",
      cityLabel: "Paulínia",
      expectedSize: "medio",
    },
    {
      cityKey: "grande-campinas",
      cityLabel: "Campinas",
      expectedSize: "grande",
    },
  ];

const SIZE_LABEL: Record<string, { label: string; bg: string; text: string }> =
  {
    pequeno: {
      label: "MUNICÍPIO PEQUENO",
      bg: "bg-emerald-100",
      text: "text-emerald-700",
    },
    medio: {
      label: "MUNICÍPIO MÉDIO",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    grande: {
      label: "MUNICÍPIO GRANDE",
      bg: "bg-cyan-100",
      text: "text-cyan-700",
    },
  };

async function loadCityMeta(
  cityKey: string,
): Promise<Pick<CityMeta, "durationSec" | "scenesCount" | "matriculas">> {
  try {
    const raw = await readFile(
      resolve(process.cwd(), "public", "treinamento", "data", `${cityKey}.json`),
      "utf-8",
    );
    const data = JSON.parse(raw);
    return {
      durationSec: data.durationSec ?? 0,
      scenesCount: data.scenes?.length ?? 0,
      matriculas: data.muni?.totalMatriculas ?? null,
    };
  } catch {
    return { durationSec: 0, scenesCount: 0, matriculas: null };
  }
}

export default async function ApmDashboard() {
  const cities = await Promise.all(
    CITIES.map(async (c) => ({ ...c, ...(await loadCityMeta(c.cityKey)) })),
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] px-6 py-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white rounded-xl border border-[var(--border)] p-2 shadow-sm">
              <Image
                src={APM_LOGO_URL}
                alt="APM"
                width={120}
                height={44}
                className="h-10 w-auto"
                unoptimized
              />
            </div>
            <span className="text-[var(--text3)] text-xl font-bold">
              &times;
            </span>
            <div className="bg-white rounded-xl border border-[var(--border)] px-4 py-2 shadow-sm">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-[#0A2463]">i</span>
                <span className="text-[#00B4D8]">10</span>
              </span>
            </div>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-[3px] text-[#0D7377] mb-2">
            Dashboard APM &times; I10
          </div>
          <h1
            className="text-3xl md:text-4xl font-extrabold text-[var(--text)] mb-3"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Hub do time APM
          </h1>
          <p className="text-sm text-[var(--text2)] max-w-2xl leading-relaxed">
            Cadastro de leads, downloads do kit, métricas do email marketing
            pós-evento e treinamento operacional da plataforma BNCC Captação.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {CARDS.map((card) => {
            const inner = (
              <div
                className={`bg-white rounded-xl border border-[var(--border)] p-5 h-full transition-all ${
                  card.available
                    ? "hover:border-[#00B4D8] hover:shadow-md cursor-pointer"
                    : "opacity-60"
                }`}
                style={{ borderTopColor: card.tagColor, borderTopWidth: 3 }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-[2px] mb-2"
                  style={{ color: card.tagColor }}
                >
                  {card.tag}
                </div>
                <div className="text-base font-bold text-[var(--text)] mb-1">
                  {card.title}
                </div>
                <div className="text-xs text-[var(--text3)]">
                  {card.available && card.href?.startsWith("#") ? (
                    <span className="text-emerald-600 font-semibold">
                      {card.sub} &darr;
                    </span>
                  ) : (
                    card.sub
                  )}
                </div>
              </div>
            );

            if (!card.href || !card.available) {
              return <div key={card.tag}>{inner}</div>;
            }

            if (card.external) {
              return (
                <a
                  key={card.tag}
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inner}
                </a>
              );
            }

            if (card.href.startsWith("#")) {
              return (
                <a key={card.tag} href={card.href}>
                  {inner}
                </a>
              );
            }

            return (
              <Link key={card.tag} href={card.href}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* Training section */}
        <section id="treinamento">
          <div className="text-[10px] font-bold uppercase tracking-[3px] text-[#0D7377] mb-2">
            Treinamento da plataforma
          </div>
          <h2
            className="text-2xl font-extrabold text-[var(--text)] mb-2"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Simulações de consultoria FUNDEB
          </h2>
          <p className="text-sm text-[var(--text2)] max-w-2xl mb-8 leading-relaxed">
            Vídeos guiados cobrindo o fluxo completo de captação até a entrega
            da consultoria. Comece pelo fluxo end-to-end e depois aprofunde em
            cada cidade conforme o caso real.
          </p>

          {/* Cross-app flow card */}
          <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] rounded-2xl p-6 mb-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                &#9654;
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[2px] text-[#00B4D8] mb-1">
                  Fluxo Completo &middot; Cross-App
                </div>
                <div className="text-lg font-bold">
                  APM &rarr; CRM &rarr; BNCC Captação
                </div>
                <div className="text-xs text-white/60 mt-1">
                  Como o lead nasce no APM (em campo), passa pelo pipeline do
                  CRM e vira auditoria FUNDEB no BNCC. Tudo em ~4 minutos.
                </div>
              </div>
            </div>
          </div>

          {/* Per municipality size */}
          <div className="text-[10px] font-bold uppercase tracking-[3px] text-[var(--text3)] mb-4">
            Por tamanho de município
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {cities.map((city) => {
              const size = SIZE_LABEL[city.expectedSize];
              return (
                <Link
                  key={city.cityKey}
                  href={`/apm/treinamento/${city.cityKey}`}
                  className="block rounded-2xl overflow-hidden border border-[var(--border)] bg-white hover:shadow-lg transition-shadow group"
                >
                  <div className="bg-gradient-to-br from-[#0A2463] to-[#0d3280] p-8 text-center text-white relative">
                    <div
                      className={`inline-block ${size.bg} ${size.text} text-[9px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full mb-3`}
                    >
                      {size.label}
                    </div>
                    <div
                      className="text-2xl font-extrabold"
                      style={{
                        fontFamily: "'Source Serif 4', Georgia, serif",
                      }}
                    >
                      {city.cityLabel}
                    </div>
                    {city.matriculas != null && (
                      <div className="text-xs text-white/50 mt-1">
                        {city.matriculas.toLocaleString("pt-BR")} matrículas
                      </div>
                    )}
                    <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#00B4D8] flex items-center justify-center text-white text-lg group-hover:bg-[#00E5A0] transition-colors">
                      &#9654;
                    </div>
                  </div>
                  <div className="p-4 text-xs text-[var(--text3)]">
                    {city.durationSec
                      ? `${Math.floor(city.durationSec / 60)}:${String(Math.floor(city.durationSec % 60)).padStart(2, "0")} min`
                      : "—"}{" "}
                    &middot; {city.scenesCount ?? 0} cenas
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Install PWA hint */}
        <div className="mt-12 mb-8 text-center text-xs text-[var(--text3)]">
          Dashboard APM &times; Instituto i10
        </div>
      </div>
    </div>
  );
}
