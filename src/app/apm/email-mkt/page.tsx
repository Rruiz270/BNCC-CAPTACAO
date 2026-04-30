"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const STATS_URL = "https://apm-fundeb-sp.vercel.app/api/stats";

interface MuniStat {
  nome: string;
  pdf: string;
  count: number;
  ultimo_acesso: string | null;
}

interface RecentItem {
  municipio: string;
  pdf: string;
  ts: string;
  ip: string;
  source: string;
}

interface StatsData {
  total_downloads: number;
  municipios_com_download: number;
  municipios_total: number;
  taxa_abertura: string;
  municipios: MuniStat[];
  municipios_por_fonte: Record<string, MuniStat[]>;
  ultimos_50: RecentItem[];
  por_fonte: Record<string, number>;
  atualizado_em: string;
}

type TabKey = "todos" | "email" | "whatsapp";

const TABS: { key: TabKey; label: string; color: string; icon: string }[] = [
  { key: "todos", label: "Todos", color: "#0D7377", icon: "\u{1F4CA}" },
  { key: "email", label: "Email", color: "#D97706", icon: "\u{1F4E7}" },
  { key: "whatsapp", label: "WhatsApp", color: "#25D366", icon: "\u{1F4F1}" },
];

function timeAgo(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function getSourceLabel(source: string) {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "email") return "Email";
  return source;
}

function getSourceColor(source: string) {
  if (source === "whatsapp") return "#25D366";
  if (source === "email") return "#D97706";
  return "#718096";
}

export default function EmailMktPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("todos");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(STATS_URL);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMunicipios = (): MuniStat[] => {
    if (!data) return [];
    if (tab === "todos") return data.municipios;
    return data.municipios_por_fonte?.[tab] ?? [];
  };

  const getRecent = (): RecentItem[] => {
    if (!data) return [];
    if (tab === "todos") return data.ultimos_50;
    return data.ultimos_50.filter((r) => r.source === tab);
  };

  const getTotal = (): number => {
    if (!data) return 0;
    if (tab === "todos") return data.total_downloads;
    return data.por_fonte?.[tab] ?? 0;
  };

  const getComDownload = (): number => {
    const munis = getMunicipios();
    return munis.filter((m) => m.count > 0).length;
  };

  const municipios = getMunicipios();
  const filtered = municipios.filter((m) =>
    search ? m.nome.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const recent = getRecent();
  const totalDl = getTotal();
  const comDl = getComDownload();
  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-8">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: activeTab.color }}>
              Campanhas &middot; Tracking
            </div>
            <h1 className="text-2xl font-bold">
              Downloads dos relat&oacute;rios FUNDEB 2026
            </h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">
              Acompanhamento de quem baixou o PDF ap&oacute;s os disparos para os 645 munic&iacute;pios de SP.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
            <Link
              href="/apm/dashboard"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              &larr; Hub APM
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? "text-white shadow-md"
                  : "bg-white border border-[var(--border)] text-[var(--text2)] hover:border-gray-300"
              }`}
              style={tab === t.key ? { backgroundColor: t.color } : undefined}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {data && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? "bg-white/20" : "bg-gray-100"
                  }`}
                >
                  {t.key === "todos"
                    ? data.total_downloads
                    : data.por_fonte?.[t.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Downloads totais"
            value={totalDl}
            color={activeTab.color}
            loading={loading}
          />
          <StatCard
            label="Municípios que baixaram"
            value={data ? `${comDl} / ${data.municipios_total}` : "—"}
            color="#059669"
            loading={loading}
          />
          <StatCard
            label="Taxa de abertura"
            value={
              data
                ? `${((comDl / data.municipios_total) * 100).toFixed(1)}%`
                : "—"
            }
            color="#D97706"
            loading={loading}
          />
          <StatCard
            label="Municípios sem download"
            value={data ? data.municipios_total - comDl : "—"}
            color="#DC2626"
            loading={loading}
          />
        </div>

        {/* Source breakdown summary (only on "todos" tab) */}
        {tab === "todos" && data && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#D97706] transition-colors"
              onClick={() => setTab("email")}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: "#D97706" + "20" }}>
                {"\u{1F4E7}"}
              </div>
              <div>
                <div className="text-xl font-black text-[#D97706]">{data.por_fonte?.email ?? 0}</div>
                <div className="text-xs text-[var(--text3)]">Downloads via Email</div>
              </div>
            </div>
            <div
              className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#25D366] transition-colors"
              onClick={() => setTab("whatsapp")}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: "#25D366" + "20" }}>
                {"\u{1F4F1}"}
              </div>
              <div>
                <div className="text-xl font-black text-[#25D366]">{data.por_fonte?.whatsapp ?? 0}</div>
                <div className="text-xs text-[var(--text3)]">Downloads via WhatsApp</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Recent activity */}
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] font-bold text-sm" style={{ color: activeTab.color }}>
              Atividade recente
              {tab !== "todos" && (
                <span className="text-[var(--text3)] font-normal"> &middot; {activeTab.label}</span>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {recent.length === 0 ? (
                <div className="p-8 text-center text-[var(--text3)] text-sm">
                  {loading ? "Carregando..." : "Nenhum download registrado."}
                </div>
              ) : (
                recent.slice(0, 20).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0"
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: getSourceColor(item.source) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[var(--text)]">
                        {item.municipio}
                      </div>
                      <div className="text-xs text-[var(--text3)]">
                        {timeAgo(item.ts)}
                      </div>
                    </div>
                    {tab === "todos" && (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                        style={{
                          backgroundColor: getSourceColor(item.source) + "18",
                          color: getSourceColor(item.source),
                        }}
                      >
                        {getSourceLabel(item.source)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top municipalities */}
          <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] font-bold text-sm" style={{ color: activeTab.color }}>
              Top munic&iacute;pios por downloads
              {tab !== "todos" && (
                <span className="text-[var(--text3)] font-normal"> &middot; {activeTab.label}</span>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {municipios.filter((m) => m.count > 0).length === 0 ? (
                <div className="p-8 text-center text-[var(--text3)] text-sm">
                  {loading ? "Carregando..." : "O ranking aparece após os primeiros downloads."}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase text-[var(--text3)] bg-gray-50 border-b border-[var(--border)]">
                      <th className="text-left px-5 py-2 font-semibold tracking-wider">Município</th>
                      <th className="text-left px-5 py-2 font-semibold tracking-wider">Downloads</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {municipios
                      .filter((m) => m.count > 0)
                      .slice(0, 15)
                      .map((m) => {
                        const max = municipios[0]?.count || 1;
                        return (
                          <tr key={m.pdf + tab} className="border-b border-gray-50 last:border-0">
                            <td className="px-5 py-2 font-semibold">{m.nome}</td>
                            <td className="px-5 py-2">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{
                                  backgroundColor: activeTab.color + "18",
                                  color: activeTab.color,
                                }}
                              >
                                {m.count}x
                              </span>
                            </td>
                            <td className="px-5 py-2 w-[40%]">
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(m.count / max) * 100}%`,
                                    background: `linear-gradient(to right, ${activeTab.color}, ${activeTab.color}88)`,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Pendentes section */}
        <PendentesSection
          data={data}
          tab={tab}
          activeTab={activeTab}
          loading={loading}
          getMunicipios={getMunicipios}
        />

        {/* Full table */}
        <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: activeTab.color }}>
              Todos os munic&iacute;pios
              {tab !== "todos" && (
                <span className="text-[var(--text3)] font-normal"> &middot; {activeTab.label}</span>
              )}
            </span>
            <input
              type="text"
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm w-56 outline-none focus:border-[#0D7377]"
            />
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loading && !data ? (
              <div className="p-8 text-center text-[var(--text3)] text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-[var(--text3)] text-sm">Nenhum município encontrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-[var(--text3)] bg-gray-50 border-b border-[var(--border)] sticky top-0">
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">Município</th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">Downloads</th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">Último acesso</th>
                    <th className="text-left px-5 py-2 font-semibold tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.pdf + tab} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-2 font-semibold">{m.nome}</td>
                      <td className="px-5 py-2">{m.count > 0 ? `${m.count}x` : "—"}</td>
                      <td className="px-5 py-2 text-[var(--text3)]">
                        {m.ultimo_acesso ? timeAgo(m.ultimo_acesso) : "—"}
                      </td>
                      <td className="px-5 py-2">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            m.count > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-[var(--text3)]"
                          }`}
                        >
                          {m.count > 0 ? "Baixou" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {data && (
          <div className="text-center text-xs text-[var(--text3)] py-4">
            Atualizado em {new Date(data.atualizado_em).toLocaleString("pt-BR")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      className="bg-white border border-[var(--border)] rounded-xl p-5 text-center relative overflow-hidden"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="text-2xl font-black tracking-tight mb-1" style={{ color }}>
        {loading && value === "—" ? "..." : value}
      </div>
      <div className="text-xs text-[var(--text3)] font-medium">{label}</div>
    </div>
  );
}

const ALL_MUNICIPIOS: string[] = ["Adamantina", "Adolfo", "Aguaí", "Águas da Prata", "Águas de Lindóia", "Águas de Santa Bárbara", "Águas de São Pedro", "Agudos", "Alambari", "Alfredo Marcondes", "Altair", "Altinópolis", "Alto Alegre", "Alumínio", "Álvares Florence", "Álvares Machado", "Álvaro de Carvalho", "Alvinlândia", "Americana", "Américo Brasiliense", "Américo de Campos", "Amparo", "Ibirarema", "Analândia", "Andradina", "Angatuba", "Anhembi", "Anhumas", "Aparecida", "Aparecida DOeste", "Apiaí", "Araçariguama", "Araçatuba", "Araçoiaba da Serra", "Aramina", "Arandu", "Arapeí", "Araraquara", "Araras", "Arco-Íris", "Arealva", "Areias", "Areiópolis", "Ariranha", "Artur Nogueira", "Arujá", "Aspásia", "Assis", "Atibaia", "Auriflama", "Avaí", "Avanhandava", "Avaré", "Bady Bassitt", "Balbinos", "Bálsamo", "Bananal", "Barão de Antonina", "Barbosa", "Bariri", "Barra Bonita", "Barra do Chapéu", "Barra do Turvo", "Barretos", "Barrinha", "Barueri", "Bastos", "Batatais", "Bauru", "Bebedouro", "Bento de Abreu", "Bernardino de Campos", "Bertioga", "Bilac", "Birigui", "Biritiba Mirim", "Boa Esperança do Sul", "Bocaina", "Bofete", "Boituva", "bom jesus dos perdoes", "Bom Sucesso de Itararé", "Borá", "Boracéia", "Borborema", "Borebi", "Botucatu", "Bragança Paulista", "Braúna", "Brejo Alegre", "Brodowski", "Brotas", "Buri", "Buritama", "Buritizal", "Cabrália Paulista", "Cabreúva", "Caçapava", "Cachoeira Paulista", "Caconde", "Cafelândia", "Caiabu", "Caieiras", "Caiuá", "Cajamar", "Cajati", "Cajobi", "Cajuru", "Campina do Monte Alegre", "Campinas", "Campo Limpo Paulista", "Campos do Jordão", "Campos Novos Paulista", "Cananéia", "Canas", "Cândido Mota", "Cândido Rodrigues", "Canitar", "Capão Bonito", "Capela do Alto", "Capivari", "Caraguatatuba", "Carapicuíba", "Cardoso", "Casa Branca", "Cássia dos Coqueiros", "Castilho", "Catanduva", "Catiguá", "Cedral", "Cerqueira César", "Cerquilho", "Cesário Lange", "Charqueada", "Chavantes", "Clementina", "Colina", "Colômbia", "Conchal", "Conchas", "Cordeirópolis", "Coroados", "Coronel Macedo", "Corumbataí", "Cosmópolis", "Cosmorama", "Cotia", "Cravinhos", "Cristais Paulista", "Cruzália", "Cruzeiro", "Cubatão", "Cunha", "Descalvado", "Diadema", "Dirce Reis", "Divinolândia", "Dobrada", "Dois Córregos", "Dolcinópolis", "Dourado", "Dracena", "Duartina", "Dumont", "Echaporã", "Eldorado", "Elias Fausto", "Elisiário", "Embaúba", "Embu", "Embu-Guaçu", "Emilianópolis", "Engenheiro Coelho", "Espírito Santo do Pinhal", "Espírito Santo do Turvo", "Estiva Gerbi", "Estrela do Norte", "Estrela DOeste", "Euclides da Cunha Paulista", "Fartura", "Fernando Prestes", "Fernandópolis", "Fernão", "Ferraz de Vasconcelos", "Flora Rica", "Floreal", "Flórida Paulista", "Florínea", "Franca", "Francisco Morato", "Franco da Rocha", "Gabriel Monteiro", "Gália", "Garça", "Gastão Vidigal", "Gavião Peixoto", "General Salgado", "Getulina", "Glicério", "Guaiçara", "Guaimbê", "Guaíra", "Guapiaçu", "Guapiara", "Guará", "Guaraçaí", "Guaraci", "Guarani DOeste", "Guarantã", "Guararapes", "Guararema", "Guaratinguetá", "Guareí", "Guariba", "Guarujá", "Guarulhos", "Guatapará", "Guzolândia", "Herculândia", "Holambra", "Hortolândia", "Iacanga", "Iacri", "Iaras", "Ibaté", "Ibirá", "Ibitinga", "Ibiúna", "Icém", "Iepê", "Igaraçu do Tietê", "Igarapava", "Igaratá", "Iguape", "Ilha Comprida", "Ilha Solteira", "Ilhabela", "Indaiatuba", "Indiana", "Indiaporã", "Inúbia Paulista", "Ipaussu", "Iperó", "Ipeúna", "Ipiguá", "Iporanga", "Ipuã", "Iracemápolis", "Irapuã", "Irapuru", "Itaberá", "Itaí", "Itajobi", "Itaju", "Itanhaém", "Itaóca", "Itapecerica da Serra", "Itapetininga", "Itapeva", "Itapevi", "Itapira", "Itapirapuã Paulista", "Itápolis", "Itaporanga", "Itapuí", "Itapura", "Itaquaquecetuba", "Itararé", "Itariri", "Itatiba", "Itatinga", "Itirapina", "Itirapuã", "Itobi", "Itu", "Itupeva", "Ituverava", "Jaborandi", "Jaboticabal", "Jacareí", "Jaci", "Jacupiranga", "Jaguariúna", "Jales", "Jambeiro", "Jandira", "Jardinópolis", "Jarinu", "Jaú", "Jeriquara", "Joanópolis", "João Ramalho", "José Bonifácio", "Júlio Mesquita", "Jumirim", "Jundiaí", "Junqueirópolis", "Juquiá", "Juquitiba", "Lagoinha", "Laranjal Paulista", "Lavínia", "Lavrinhas", "Leme", "Lençóis Paulista", "Limeira", "Lindóia", "Lins", "Lorena", "Lourdes", "Louveira", "Lucélia", "Lucianópolis", "Luís Antônio", "Luiziânia", "Lupércio", "Lutécia", "Macatuba", "Macaubal", "Macedônia", "Magda", "Mairinque", "Mairiporã", "Manduri", "Maraba Paulista", "Maracaí", "Marapoama", "Mariápolis", "Marília", "Marinópolis", "Martinópolis", "Matão", "Mauá", "Mendonça", "Meridiano", "Mesópolis", "Miguelópolis", "Mineiros do Tietê", "Mira Estrela", "Miracatu", "Mirandópolis", "Mirante do Paranapanema", "Mirassol", "Mirassolândia", "Mococa", "Mogi das Cruzes", "Mogi Guaçu", "Mogi Mirim", "Mombuca", "Moncoes", "Mongaguá", "Monte Alegre do Sul", "Monte Alto", "Monte Aprazível", "Monte Azul Paulista", "Monte Castelo", "Monte Mor", "Monteiro Lobato", "Morro Agudo", "Morungaba", "Motuca", "Murutinga do Sul", "Nantes", "Narandiba", "Natividade da Serra", "Nazaré Paulista", "Neves Paulista", "Nhandeara", "Nipoã", "Nova Aliança", "Nova Campina", "Nova Canaã Paulista", "Nova Castilho", "Nova Europa", "Nova Granada", "Nova Guataporanga", "Nova Independência", "Nova Luzitânia", "Nova Odessa", "Novais", "Novo Horizonte", "Nuporanga", "Ocauçu", "Óleo", "Olímpia", "Onda Verde", "Oriente", "Orindiúva", "Orlândia", "Osasco", "Oscar Bressane", "Osvaldo Cruz", "Ourinhos", "Ouro Verde", "Ouroeste", "Pacaembu", "Palestina", "Palmares Paulista", "Palmeira DOeste", "Palmital", "Panorama", "Paraguaçu Paulista", "Paraibuna", "Paraíso", "Paranapanema", "Paranapuã", "Parapuã", "Pardinho", "Pariquera-Açu", "Parisi", "Patrocínio Paulista", "Paulicéia", "Paulínia", "Paulistânia", "Paulo de Faria", "Pederneiras", "Pedra Bela", "Pedranópolis", "Pedregulho", "Pedreira", "Pedrinhas Paulista", "Pedro de Toledo", "Penápolis", "Pereira Barreto", "Pereiras", "Peruíbe", "Piacatu", "Piedade", "Pilar do Sul", "Pindamonhangaba", "Pindorama", "Pinhalzinho", "Piquerobi", "Piquete", "Piracaia", "Piracicaba", "Piraju", "Pirajuí", "Pirangi", "Pirapora do Bom Jesus", "Pirapozinho", "Pirassununga", "Piratininga", "Pitangueiras", "Planalto", "Platina", "Poá", "Poloni", "Pompéia", "Pongaí", "Pontal", "Pontalinda", "Pontes Gestal", "Populina", "Porangaba", "Porto Feliz", "Porto Ferreira", "Potim", "Potirendaba", "Pracinha", "Pradópolis", "Praia Grande", "Pratânia", "Presidente Alves", "Presidente Bernardes", "Presidente Epitácio", "Presidente Prudente", "Presidente Venceslau", "Promissão", "Quadra", "Quatá", "Queiroz", "Queluz", "Quintana", "Rafard", "Rancharia", "Redenção da Serra", "Regente Feijó", "Reginópolis", "Registro", "Restinga", "Ribeira", "Ribeirão Bonito", "Ribeirão Branco", "Ribeirão Corrente", "Ribeirão do Sul", "Ribeirão dos Índios", "Ribeirão Grande", "Ribeirão Pires", "Ribeirão Preto", "Rifaina", "Rincão", "Rinópolis", "Rio Claro", "Rio das Pedras", "Rio Grande da Serra", "Riolândia", "Riversul", "Rosana", "Roseira", "Rubiácea", "Rubinéia", "Sabino", "Sagres", "Sales", "Sales Oliveira", "Salesópolis", "Salmourão", "Saltinho", "Salto", "Salto de Pirapora", "Salto Grande", "Sandovalina", "Santa Adélia", "Santa Albertina", "Santa Bárbara DOeste", "Santa Branca", "Santa Clara DOeste", "Santa Cruz da Conceição", "Santa Cruz da Esperança", "Santa Cruz das Palmeiras", "Santa Cruz do Rio Pardo", "Santa Ernestina", "Santa Fé do Sul", "Santa Gertrudes", "Santa Isabel", "Santa Lúcia", "Santa Maria da Serra", "Santa Mercedes", "Santa Rita do Passa Quatro", "Santa Rita DOeste", "Santa Rosa de Viterbo", "Santa Salete", "Santana da Ponte Pensa", "Santana de Parnaíba", "Santo Anastácio", "Santo André", "Santo Antônio da Alegria", "Santo Antônio de Posse", "Santo Antônio do Aracangua", "Santo Antônio do Jardim", "Santo Antônio do Pinhal", "Santo Expedito", "Santópolis do Aguapeí", "Santos", "São Bento do Sapucaí", "São Bernardo do Campo", "São Caetano do Sul", "São Carlos", "São Francisco", "São João da Boa Vista", "São João das Duas Pontes", "São João de Iracema", "São João do Pau DAlho", "São Joaquim da Barra", "São José da Bela Vista", "São José do Barreiro", "São José do Rio Pardo", "São José do Rio Preto", "São José dos Campos", "São Lourenço da Serra", "São Luíz do Paraitinga", "São Manuel", "São Miguel Arcanjo", "São Paulo", "São Pedro", "São Pedro do Turvo", "São Roque", "São Sebastião", "São Sebastião da Grama", "São Simão", "São Vicente", "Sarapuí", "Sarutaiá", "Sebastianópolis do Sul", "Serra Azul", "Serra Negra", "Serrana", "Sertãozinho", "Sete Barras", "Severínia", "Silveiras", "Socorro", "Sorocaba", "Sud Mennucci", "Sumaré", "Suzanápolis", "Suzano", "Tabapuã", "Tabatinga", "Taboão da Serra", "Taciba", "Taguaí", "Taiaçu", "Taiúva", "Tambaú", "Tanabi", "Tapiraí", "Tapiratiba", "Taquaral", "Taquaritinga", "Taquarituba", "Taquarivaí", "Tarabai", "Tarumã", "Tatuí", "Taubaté", "Tejupá", "Teodoro Sampaio", "Terra Roxa", "Tietê", "Timburi", "Torre de Pedra", "Torrinha", "Trabiju", "Tremembé", "Três Fronteiras", "Tuiuti", "Tupã", "Tupi Paulista", "Turiúba", "Turmalina", "Ubarana", "Ubatuba", "Ubirajara", "Uchoa", "União Paulista", "Urânia", "Uru", "Urupês", "Valentim Gentil", "Valinhos", "Valparaíso", "Vargem", "Vargem Grande do Sul", "Vargem Grande Paulista", "Várzea Paulista", "Vera Cruz", "Vinhedo", "Viradouro", "Vista Alegre do Alto", "Vitória Brasil", "Votorantim", "Votuporanga", "Zacarias"];

function getPendentes(municipios: MuniStat[]): string[] {
  const baixados = new Set(municipios.filter((m) => m.count > 0).map((m) => m.nome));
  return ALL_MUNICIPIOS.filter((nome) => !baixados.has(nome));
}

function exportCSV(rows: string[], filename: string) {
  const bom = "﻿";
  const header = "MUNICÍPIO,STATUS\n";
  const body = rows.map((nome) => `"${nome}",Pendente`).join("\n");
  const blob = new Blob([bom + header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PendentesSection({
  data,
  tab,
  activeTab,
  loading,
  getMunicipios,
}: {
  data: StatsData | null;
  tab: TabKey;
  activeTab: { key: TabKey; label: string; color: string; icon: string };
  loading: boolean;
  getMunicipios: () => MuniStat[];
}) {
  const [searchP, setSearchP] = useState("");
  const pendentes = data ? getPendentes(getMunicipios()) : [];
  const filteredP = pendentes.filter((nome) =>
    searchP ? nome.toLowerCase().includes(searchP.toLowerCase()) : true,
  );
  const tabLabel = tab === "todos" ? "" : ` (${activeTab.label})`;

  return (
    <div
      className="bg-white border rounded-xl overflow-hidden"
      style={{ borderColor: "#DC2626", borderWidth: 2 }}
    >
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-red-50/50">
        <div>
          <span className="font-bold text-sm text-[#DC2626]">
            Municípios pendentes{tabLabel}
          </span>
          <span className="ml-2 text-xs text-[var(--text3)]">
            {pendentes.length} de 645 não baixaram
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filtrar..."
            value={searchP}
            onChange={(e) => setSearchP(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm w-40 outline-none focus:border-[#DC2626]"
          />
          <button
            onClick={() =>
              exportCSV(
                pendentes,
                `pendentes-fundeb${tab !== "todos" ? `-${tab}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`,
              )
            }
            disabled={!data || pendentes.length === 0}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>&#128229;</span> Exportar Excel
          </button>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {loading && !data ? (
          <div className="p-8 text-center text-[var(--text3)] text-sm">Carregando...</div>
        ) : filteredP.length === 0 ? (
          <div className="p-8 text-center text-[var(--text3)] text-sm">
            {pendentes.length === 0
              ? "Todos os municípios já baixaram!"
              : "Nenhum município encontrado."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {filteredP.map((nome) => (
              <div
                key={nome}
                className="px-4 py-2 border-b border-r border-gray-50 text-sm text-[var(--text2)] hover:bg-red-50/30"
              >
                {nome}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
