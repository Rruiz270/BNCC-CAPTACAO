"use client";

import { useEffect, useState, useCallback, use } from "react";

interface Municipality {
  id: number;
  nome: string;
  codigoIbge: string;
  receitaTotal: number;
  contribuicao: number;
  recursosReceber: number;
  vaat: number;
  vaar: number;
  totalMatriculas: number;
  totalEscolas: number;
  escolasMunicipais: number;
  escolasRurais: number;
  totalDocentes: number;
  potTotal: number;
  pctPotTotal: number;
}

interface Enrollment {
  categoria: string;
  categoriaLabel: string;
  fatorVaaf: number;
  quantidade: number;
  quantidadeUrbana: number;
  quantidadeCampo: number;
  ativa: boolean;
  receitaEstimada: number;
}

interface TokenData {
  token: string;
  municipality: Municipality;
  enrollments: Enrollment[];
}

type PageState = "loading" | "form" | "thankyou" | "error";

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

function fmtBRL(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1)} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<PageState>("loading");
  const [errorTitle, setErrorTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<TokenData | null>(null);

  // Form fields
  const [respName, setRespName] = useState("");
  const [respRole, setRespRole] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [schoolsTotal, setSchoolsTotal] = useState("");
  const [schoolsRural, setSchoolsRural] = useState("");
  const [observations, setObservations] = useState("");
  const [realValues, setRealValues] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const showError = useCallback((title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setState("error");
  }, []);

  // Fetch token data
  useEffect(() => {
    fetch(`/api/intake/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 404) {
          showError("Link invalido", "Este link de intake nao foi encontrado. Verifique com o consultor.");
        } else if (res.status === 410) {
          showError("Link expirado", "Este link de intake ja expirou. Solicite um novo link ao consultor.");
        } else if (res.status === 409) {
          showError("Ja respondido", "Este formulario ja foi preenchido anteriormente.");
        } else if (!res.ok) {
          showError("Erro", json.error || "Erro ao carregar dados.");
        } else {
          setData(json);
          setState("form");
        }
      })
      .catch(() => {
        showError("Erro", "Nao foi possivel carregar os dados. Tente novamente mais tarde.");
      });
  }, [token, showError]);

  function updateRealValue(idx: number, value: string) {
    setRealValues((prev) => ({ ...prev, [idx]: value }));
  }

  function getDelta(idx: number, publicVal: number) {
    const val = realValues[idx];
    if (!val || val === "") return null;
    const realVal = parseInt(val, 10);
    if (isNaN(realVal)) return null;
    return {
      diff: realVal - publicVal,
      pct: publicVal > 0 ? Math.abs((realVal - publicVal) / publicVal * 100) : (realVal !== publicVal ? 100 : 0),
    };
  }

  async function submitForm() {
    if (!respName.trim()) { alert("Por favor, informe seu nome."); return; }
    if (!respRole) { alert("Por favor, selecione seu cargo."); return; }
    if (!data) return;

    setSubmitting(true);

    // Build enrollment data
    const enrollmentData: Record<string, { publicValue: number; realValue: number; difference: number }> = {};
    data.enrollments.forEach((e, idx) => {
      const val = realValues[idx];
      if (val && val !== "") {
        const realVal = parseInt(val, 10) || 0;
        const publicVal = e.quantidade || 0;
        enrollmentData[e.categoriaLabel || e.categoria] = {
          publicValue: publicVal,
          realValue: realVal,
          difference: realVal - publicVal,
        };
      }
    });

    const payload = {
      respondentName: respName.trim(),
      respondentRole: respRole,
      respondentEmail: respEmail.trim(),
      data: {
        schoolsTotal: schoolsTotal ? parseInt(schoolsTotal, 10) : null,
        schoolsRural: schoolsRural ? parseInt(schoolsRural, 10) : null,
        enrollmentData,
        observations: observations.trim() || null,
      },
    };

    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao enviar.");
        setSubmitting(false);
        return;
      }
      setState("thankyou");
    } catch {
      alert("Erro de conexao. Tente novamente.");
      setSubmitting(false);
    }
  }

  // LOADING
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[var(--cyan)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text2)] text-sm">Carregando dados do municipio...</p>
        </div>
      </div>
    );
  }

  // ERROR
  if (state === "error") {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-5xl mb-4">&#9888;</div>
          <h2 className="text-xl font-bold text-[var(--navy)] mb-2">{errorTitle}</h2>
          <p className="text-[var(--text2)]">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // THANK YOU
  if (state === "thankyou") {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 rounded-full bg-[#00E5A0]/12 flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">&#10004;</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--navy)] mb-2" style={{ fontFamily: "'Source Serif 4', serif" }}>
            Obrigado!
          </h2>
          <p className="text-[var(--text2)] max-w-md mx-auto">
            Seus dados foram enviados ao Instituto i10. Eles serao utilizados para preparar
            seu diagnostico personalizado FUNDEB 2026.
          </p>
          <p className="mt-4 text-sm text-[var(--text3)]">Voce pode fechar esta pagina.</p>
        </div>
      </div>
    );
  }

  // FORM
  const muni = data!.municipality;
  const enrollments = data!.enrollments;

  const summaryItems = [
    { label: "Receita Total FUNDEB", value: fmtBRL(muni.receitaTotal), sub: "Recursos anuais" },
    { label: "Contribuicao FUNDEB", value: fmtBRL(muni.contribuicao), sub: "Recolhido ao fundo" },
    { label: "VAAR", value: muni.vaar && muni.vaar > 0 ? fmtBRL(muni.vaar) : "Nao recebe", sub: muni.vaar && muni.vaar > 0 ? "Complementacao VAAR" : "Sem elegibilidade" },
    { label: "Potencial de Ganho", value: fmtBRL(muni.potTotal), sub: `${(muni.pctPotTotal || 0).toFixed(1)}% da receita atual` },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-[var(--navy)] text-white py-5 border-b-[3px] border-[var(--cyan)]">
        <div className="max-w-[900px] mx-auto px-6 flex justify-between items-center">
          <div className="text-[var(--cyan)] font-extrabold text-sm tracking-wider uppercase">
            INSTITUTO I10
          </div>
          <div className="text-sm text-white/60">Diagnostico FUNDEB 2026</div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-[var(--navy)] to-[#0d3280] text-white py-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          background: "repeating-conic-gradient(rgba(0,180,216,0.8) 0% 25%, transparent 0% 50%) 0 0 / 40px 40px",
        }} />
        <div className="max-w-[900px] mx-auto px-6 relative">
          <div className="inline-block bg-[var(--cyan)]/15 border border-[var(--cyan)]/40 px-4 py-1 rounded-full text-sm text-[var(--cyan)] font-semibold mb-3">
            SP
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Source Serif 4', serif" }}>
            {muni.nome}
          </h1>
          <p className="text-white/70 max-w-xl text-sm font-light">
            Estamos preparando sua consultoria FUNDEB. Por favor, confirme ou corrija os dados abaixo.
            Seus dados nos ajudarao a identificar oportunidades de captacao.
          </p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 pb-12">
        {/* Respondent Info */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Dados do Responsavel</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Informacoes de quem esta preenchendo este formulario</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Nome Completo</label>
              <input
                type="text"
                value={respName}
                onChange={(e) => setRespName(e.target.value)}
                placeholder="Ex: Maria Silva"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Cargo / Funcao</label>
              <select
                value={respRole}
                onChange={(e) => setRespRole(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Secretario(a) de Educacao">Secretario(a) de Educacao</option>
                <option value="Diretor(a) Financeiro">Diretor(a) Financeiro</option>
                <option value="Coordenador(a) Pedagogico">Coordenador(a) Pedagogico</option>
                <option value="Contador(a)">Contador(a)</option>
                <option value="Assessor(a) Tecnico">Assessor(a) Tecnico</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                value={respEmail}
                onChange={(e) => setRespEmail(e.target.value)}
                placeholder="email@municipio.gov.br"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Schools */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Escolas Municipais</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Quantas escolas a rede municipal possui?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Total de Escolas Municipais</label>
              <input
                type="number"
                value={schoolsTotal}
                onChange={(e) => setSchoolsTotal(e.target.value)}
                min="0"
                placeholder={muni.escolasMunicipais ? `Dados publicos: ${muni.escolasMunicipais}` : "Ex: 14"}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Escolas em Area Rural</label>
              <input
                type="number"
                value={schoolsRural}
                onChange={(e) => setSchoolsRural(e.target.value)}
                min="0"
                placeholder={muni.escolasRurais ? `Dados publicos: ${muni.escolasRurais}` : "Ex: 3"}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Enrollment Table */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Matriculas por Categoria</h2>
          <p className="text-xs text-[var(--text2)] mb-4">
            A coluna &quot;Dados Publicos&quot; mostra os numeros do Censo/FNDE. Na coluna &quot;Numero Real&quot;,
            informe os dados atuais da rede. A diferenca e calculada automaticamente.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--navy)] text-white text-xs uppercase">
                  <th className="text-left px-3 py-2.5 font-semibold tracking-wider rounded-tl-lg">Categoria</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider">Dados Publicos</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider">Numero Real</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider rounded-tr-lg">Diferenca</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e, idx) => {
                  const publicVal = e.quantidade || 0;
                  const delta = getDelta(idx, publicVal);
                  const warnRow = delta && delta.pct > 10;
                  return (
                    <tr key={idx} className={`border-b border-[#f0f4f8] hover:bg-[var(--cyan)]/[0.03] ${warnRow ? "bg-[var(--red)]/[0.06]" : ""}`}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {e.categoriaLabel || e.categoria}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text2)]">
                        {fmtNum(publicVal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          placeholder="—"
                          value={realValues[idx] || ""}
                          onChange={(e) => updateRealValue(idx, e.target.value)}
                          className="w-[90px] px-2 py-1.5 border border-[var(--border)] rounded-md text-right text-sm tabular-nums outline-none focus:border-[var(--cyan)]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold min-w-[80px]">
                        {delta ? (
                          <>
                            <span className={
                              delta.diff > 0 ? "text-[var(--green-dark)]" :
                              delta.diff < 0 ? "text-[var(--red)]" :
                              "text-[var(--text3)]"
                            }>
                              {delta.diff > 0 ? "+" : ""}{fmtNum(delta.diff)}
                            </span>
                            {delta.pct > 0 && (
                              <span className="text-[10px] text-[var(--text3)] ml-1">
                                ({delta.pct.toFixed(0)}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--text3)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Observations */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Observacoes</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Informacoes adicionais que considerar relevantes para a consultoria</p>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Ex: Estamos em processo de abrir 2 novas creches integrais para 2026..."
            className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors resize-y min-h-[80px]"
          />
        </section>

        {/* Summary */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Resumo do Municipio</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Dados publicos de referencia (somente leitura)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="bg-[var(--bg)] rounded-lg p-4">
                <div className="text-[10px] text-[var(--text2)] uppercase tracking-wider">{item.label}</div>
                <div className="text-lg font-bold text-[var(--navy)] mt-1">{item.value}</div>
                <div className="text-xs text-[var(--text3)]">{item.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="text-center mt-8">
          <button
            onClick={submitForm}
            disabled={submitting}
            className="px-12 py-4 bg-[var(--cyan)] text-white rounded-xl text-base font-bold tracking-wider hover:bg-[#009fc0] disabled:bg-[var(--text3)] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Enviando..." : "Enviar Respostas"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-[var(--text3)] border-t border-[var(--border)] mt-10">
        Instituto i10 — Diagnostico FUNDEB 2026 — Dados protegidos e confidenciais
      </div>
    </div>
  );
}
