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

  // Educacao Especial e AEE
  const [alunosAee, setAlunosAee] = useState("");
  const [alunosDuplaMatricula, setAlunosDuplaMatricula] = useState("");
  const [alunosClasseEspecial, setAlunosClasseEspecial] = useState("");
  const [salaRecursosMultifuncionais, setSalaRecursosMultifuncionais] = useState("");

  // Escolas de Localizacao Diferenciada
  const [escolasCampo, setEscolasCampo] = useState("");
  const [escolasIndigena, setEscolasIndigena] = useState("");
  const [escolasQuilombola, setEscolasQuilombola] = useState("");
  const [alunosCampo, setAlunosCampo] = useState("");
  const [alunosIndigena, setAlunosIndigena] = useState("");

  // Escola Integral
  const [escolasIntegral, setEscolasIntegral] = useState("");
  const [alunosIntegral, setAlunosIntegral] = useState("");
  const [expandirIntegral, setExpandirIntegral] = useState("");

  // BNCC Computacao
  const [curriculoComputacao, setCurriculoComputacao] = useState("");
  const [curriculoAprovadoCme, setCurriculoAprovadoCme] = useState("");
  const [curriculoSimec, setCurriculoSimec] = useState("");
  const [laboratoriosInformatica, setLaboratoriosInformatica] = useState("");
  const [formacaoDocente, setFormacaoDocente] = useState("");

  // Infraestrutura
  const [pctBandaLarga, setPctBandaLarga] = useState("");
  const [pctBiblioteca, setPctBiblioteca] = useState("");
  const [plataformaDigital, setPlataformaDigital] = useState("");

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
          showError("Link inválido", "Este link de intake não foi encontrado. Verifique com o consultor.");
        } else if (res.status === 410) {
          showError("Link expirado", "Este link de intake já expirou. Solicite um novo link ao consultor.");
        } else if (res.status === 409) {
          showError("Já respondido", "Este formulário já foi preenchido anteriormente.");
        } else if (!res.ok) {
          showError("Erro", json.error || "Erro ao carregar dados.");
        } else {
          setData(json);
          setState("form");
        }
      })
      .catch(() => {
        showError("Erro", "Não foi possível carregar os dados. Tente novamente mais tarde.");
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
        // Educacao Especial e AEE
        alunosAee: alunosAee ? parseInt(alunosAee, 10) : null,
        alunosDuplaMatricula: alunosDuplaMatricula ? parseInt(alunosDuplaMatricula, 10) : null,
        alunosClasseEspecial: alunosClasseEspecial ? parseInt(alunosClasseEspecial, 10) : null,
        salaRecursosMultifuncionais: salaRecursosMultifuncionais || null,
        // Escolas de Localizacao Diferenciada
        escolasCampo: escolasCampo ? parseInt(escolasCampo, 10) : null,
        escolasIndigena: escolasIndigena ? parseInt(escolasIndigena, 10) : null,
        escolasQuilombola: escolasQuilombola ? parseInt(escolasQuilombola, 10) : null,
        alunosCampo: alunosCampo ? parseInt(alunosCampo, 10) : null,
        alunosIndigena: alunosIndigena ? parseInt(alunosIndigena, 10) : null,
        // Escola Integral
        escolasIntegral: escolasIntegral ? parseInt(escolasIntegral, 10) : null,
        alunosIntegral: alunosIntegral ? parseInt(alunosIntegral, 10) : null,
        expandirIntegral: expandirIntegral || null,
        // BNCC Computacao
        curriculoComputacao: curriculoComputacao || null,
        curriculoAprovadoCme: curriculoAprovadoCme || null,
        curriculoSimec: curriculoSimec || null,
        laboratoriosInformatica: laboratoriosInformatica || null,
        formacaoDocente: formacaoDocente || null,
        // Infraestrutura
        pctBandaLarga: pctBandaLarga ? parseInt(pctBandaLarga, 10) : null,
        pctBiblioteca: pctBiblioteca ? parseInt(pctBiblioteca, 10) : null,
        plataformaDigital: plataformaDigital || null,
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
      alert("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  // LOADING
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[var(--cyan)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text2)] text-sm">Carregando dados do município...</p>
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
            Seus dados foram enviados ao Instituto i10. Eles serão utilizados para preparar
            seu diagnóstico personalizado FUNDEB 2026.
          </p>
          <p className="mt-4 text-sm text-[var(--text3)]">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // FORM
  const muni = data!.municipality;
  const enrollments = data!.enrollments;

  const summaryItems = [
    { label: "Receita Total FUNDEB", value: fmtBRL(muni.receitaTotal), sub: "Recursos anuais" },
    { label: "Contribuição FUNDEB", value: fmtBRL(muni.contribuicao), sub: "Recolhido ao fundo" },
    { label: "VAAR", value: muni.vaar && muni.vaar > 0 ? fmtBRL(muni.vaar) : "Não recebe", sub: muni.vaar && muni.vaar > 0 ? "Complementação VAAR" : "Sem elegibilidade" },
    { label: "Potencial de Ganho", value: fmtBRL(muni.potTotal), sub: `${(muni.pctPotTotal || 0).toFixed(1)}% da receita atual` },
    { label: "Matrículas", value: fmtNum(muni.totalMatriculas), sub: "Total registradas" },
    { label: "Escolas", value: fmtNum(muni.totalEscolas), sub: `${muni.escolasMunicipais || 0} municipais` },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-[var(--navy)] text-white py-5 border-b-[3px] border-[var(--cyan)]">
        <div className="max-w-[900px] mx-auto px-6 flex justify-between items-center">
          <div className="text-[var(--cyan)] font-extrabold text-sm tracking-wider uppercase">
            INSTITUTO I10
          </div>
          <div className="text-sm text-white/60">Diagnóstico FUNDEB 2026</div>
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
            Seus dados nos ajudarão a identificar oportunidades de captação.
          </p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 pb-12">
        {/* Municipality Preview — Consultoria Preview */}
        <section className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Preview: Oportunidades Identificadas</h2>
          <p className="text-xs text-[var(--text2)] mb-4">
            Nossa análise preliminar identificou as seguintes oportunidades de captação FUNDEB para seu município.
            Os dados detalhados serão apresentados na consultoria.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {summaryItems.map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] font-semibold uppercase text-[var(--text2)] tracking-wider">{item.label}</div>
                <div className="text-lg font-bold text-[var(--navy)] mt-0.5">{item.value}</div>
                <div className="text-[10px] text-[var(--text2)]">{item.sub}</div>
              </div>
            ))}
          </div>
          {muni.potTotal > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-emerald-700">Receita otimizada estimada</span>
                <span className="text-lg font-bold text-emerald-700">{fmtBRL(muni.receitaTotal + muni.potTotal)}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(((muni.receitaTotal) / (muni.receitaTotal + muni.potTotal)) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[var(--text2)]">
                <span>Atual: {fmtBRL(muni.receitaTotal)}</span>
                <span className="text-emerald-600 font-semibold">+{fmtBRL(muni.potTotal)} potencial</span>
              </div>
            </div>
          )}
        </section>

        {/* Respondent Info */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Dados do Responsável</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Informações de quem está preenchendo este formulário</p>
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
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Cargo / Função</label>
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
                placeholder={muni.escolasMunicipais ? `Dados públicos: ${muni.escolasMunicipais}` : "Ex: 14"}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Escolas em Área Rural</label>
              <input
                type="number"
                value={schoolsRural}
                onChange={(e) => setSchoolsRural(e.target.value)}
                min="0"
                placeholder={muni.escolasRurais ? `Dados públicos: ${muni.escolasRurais}` : "Ex: 3"}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Educacao Especial e AEE */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">
            Educação Especial e AEE{" "}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">CURTO PRAZO — Impacto no Censo 27/Mai</span>
          </h2>
          <p className="text-xs text-[var(--text2)] mb-4">Dados sobre atendimento educacional especializado na rede</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Quantos alunos possuem laudo e recebem AEE (Atendimento Educacional Especializado)?</label>
              <input
                type="number"
                value={alunosAee}
                onChange={(e) => setAlunosAee(e.target.value)}
                min="0"
                placeholder="Ex: 45"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Destes, quantos estão registrados no Educacenso como dupla matrícula?</label>
              <input
                type="number"
                value={alunosDuplaMatricula}
                onChange={(e) => setAlunosDuplaMatricula(e.target.value)}
                min="0"
                placeholder="Ex: 30"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Alunos em classes especiais exclusivas</label>
              <input
                type="number"
                value={alunosClasseEspecial}
                onChange={(e) => setAlunosClasseEspecial(e.target.value)}
                min="0"
                placeholder="Ex: 10"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">A rede possui sala de recursos multifuncionais?</label>
              <select
                value={salaRecursosMultifuncionais}
                onChange={(e) => setSalaRecursosMultifuncionais(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Parcial">Parcial</option>
              </select>
            </div>
          </div>
        </section>

        {/* Escolas de Localizacao Diferenciada */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">
            Escolas de Localização Diferenciada{" "}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">CURTO PRAZO — Impacto no Censo 27/Mai</span>
          </h2>
          <p className="text-xs text-[var(--text2)] mb-4">Escolas e matrículas em áreas de localização diferenciada</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Escolas em área de campo (rural)</label>
              <input
                type="number"
                value={escolasCampo}
                onChange={(e) => setEscolasCampo(e.target.value)}
                min="0"
                placeholder="Ex: 3"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Escolas em area indigena</label>
              <input
                type="number"
                value={escolasIndigena}
                onChange={(e) => setEscolasIndigena(e.target.value)}
                min="0"
                placeholder="Ex: 0"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Escolas em area quilombola</label>
              <input
                type="number"
                value={escolasQuilombola}
                onChange={(e) => setEscolasQuilombola(e.target.value)}
                min="0"
                placeholder="Ex: 0"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Alunos matriculados em escolas de campo</label>
              <input
                type="number"
                value={alunosCampo}
                onChange={(e) => setAlunosCampo(e.target.value)}
                min="0"
                placeholder="Ex: 120"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Alunos matriculados em escolas indigenas</label>
              <input
                type="number"
                value={alunosIndigena}
                onChange={(e) => setAlunosIndigena(e.target.value)}
                min="0"
                placeholder="Ex: 0"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Escola Integral */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">
            Escola Integral{" "}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">CURTO PRAZO — Impacto no Censo 27/Mai</span>
          </h2>
          <p className="text-xs text-[var(--text2)] mb-4">Dados sobre oferta de educação em tempo integral</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Quantas escolas oferecem jornada integral (7h+ diárias)?</label>
              <input
                type="number"
                value={escolasIntegral}
                onChange={(e) => setEscolasIntegral(e.target.value)}
                min="0"
                placeholder="Ex: 5"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Total de alunos em jornada integral</label>
              <input
                type="number"
                value={alunosIntegral}
                onChange={(e) => setAlunosIntegral(e.target.value)}
                min="0"
                placeholder="Ex: 800"
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">A rede planeja expandir escola integral em 2026?</label>
              <select
                value={expandirIntegral}
                onChange={(e) => setExpandirIntegral(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Em estudo">Em estudo</option>
              </select>
            </div>
          </div>
        </section>

        {/* BNCC Computacao */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">
            BNCC Computação{" "}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">MÉDIO PRAZO — Prazo Agosto 2026</span>
          </h2>
          <p className="text-xs text-[var(--text2)] mb-4">Situação do currículo de computação e infraestrutura tecnológica</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">O currículo municipal já inclui competências de computação?</label>
              <select
                value={curriculoComputacao}
                onChange={(e) => setCurriculoComputacao(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Em elaboracao">Em elaboracao</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">O currículo foi aprovado pelo CME?</label>
              <select
                value={curriculoAprovadoCme}
                onChange={(e) => setCurriculoAprovadoCme(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Em tramitacao">Em tramitacao</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">O currículo está registrado no SIMEC?</label>
              <select
                value={curriculoSimec}
                onChange={(e) => setCurriculoSimec(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">A rede possui laboratórios de informática?</label>
              <select
                value={laboratoriosInformatica}
                onChange={(e) => setLaboratoriosInformatica(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim, todas escolas">Sim, todas escolas</option>
                <option value="Sim, algumas">Sim, algumas</option>
                <option value="Nao">Nao</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">A rede possui programa de formação docente em tecnologia?</label>
              <select
                value={formacaoDocente}
                onChange={(e) => setFormacaoDocente(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Em planejamento">Em planejamento</option>
              </select>
            </div>
          </div>
        </section>

        {/* Infraestrutura */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">
            Infraestrutura{" "}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">MÉDIO PRAZO</span>
          </h2>
          <p className="text-xs text-[var(--text2)] mb-4">Infraestrutura tecnológica e física da rede escolar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Percentual de escolas com internet banda larga</label>
              <div className="relative">
                <input
                  type="number"
                  value={pctBandaLarga}
                  onChange={(e) => setPctBandaLarga(e.target.value)}
                  min="0"
                  max="100"
                  placeholder="Ex: 75"
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text3)]">%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">Percentual de escolas com biblioteca</label>
              <div className="relative">
                <input
                  type="number"
                  value={pctBiblioteca}
                  onChange={(e) => setPctBiblioteca(e.target.value)}
                  min="0"
                  max="100"
                  placeholder="Ex: 60"
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text3)]">%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider mb-1">A rede utiliza plataforma digital de aprendizagem?</label>
              <select
                value={plataformaDigital}
                onChange={(e) => setPlataformaDigital(e.target.value)}
                className="px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="Sim">Sim</option>
                <option value="Nao">Nao</option>
                <option value="Em implantacao">Em implantacao</option>
              </select>
            </div>
          </div>
        </section>

        {/* Enrollment Table */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Matrículas por Categoria</h2>
          <p className="text-xs text-[var(--text2)] mb-4">
            A coluna &quot;Dados Públicos&quot; mostra os números do Censo/FNDE. Na coluna &quot;Número Real&quot;,
            informe os dados atuais da rede. A diferença é calculada automaticamente.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--navy)] text-white text-xs uppercase">
                  <th className="text-left px-3 py-2.5 font-semibold tracking-wider rounded-tl-lg">Categoria</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider">Dados Públicos</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider">Número Real</th>
                  <th className="text-right px-3 py-2.5 font-semibold tracking-wider rounded-tr-lg">Diferença</th>
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
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Observações</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Informações adicionais que considerar relevantes para a consultoria</p>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Ex: Estamos em processo de abrir 2 novas creches integrais para 2026..."
            className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--cyan)] transition-colors resize-y min-h-[80px]"
          />
        </section>

        {/* Summary */}
        <section className="bg-white border border-[var(--border)] rounded-xl p-7 mt-6">
          <h2 className="text-base font-bold text-[var(--navy)] mb-1">Resumo do Município</h2>
          <p className="text-xs text-[var(--text2)] mb-4">Dados públicos de referência (somente leitura)</p>
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
        Instituto i10 — Diagnóstico FUNDEB 2026 — Dados protegidos e confidenciais
      </div>
    </div>
  );
}
