interface MunicipalityData {
  nome: string;
  codigoIbge: string | null;
  totalEscolas: number | null;
  totalMatriculas: number | null;
  totalDocentes: number | null;
  pctInternet: number | null;
  pctBiblioteca: number | null;
  receitaTotal: number | null;
}

export function generateMinutaCME(data: MunicipalityData): string {
  const nome = data.nome || "_______________";
  const ibge = data.codigoIbge || "XXXXXXX";
  const escolas = data.totalEscolas ? String(data.totalEscolas) : "___";
  const matriculas = data.totalMatriculas ? data.totalMatriculas.toLocaleString("pt-BR") : "___";
  const docentes = data.totalDocentes ? data.totalDocentes.toLocaleString("pt-BR") : "___";
  const pctInternet = data.pctInternet ? `${data.pctInternet.toFixed(1)}%` : "___%";
  const receita = data.receitaTotal
    ? `R$ ${(data.receitaTotal / 1e6).toFixed(1).replace(".", ",")} milhoes`
    : "R$ ___ milhoes";

  return `RESOLUCAO CME N.o ___/2026

O CONSELHO MUNICIPAL DE EDUCACAO DE ${nome.toUpperCase()}, no uso de suas atribuicoes legais, e

CONSIDERANDO:

- A Lei n.o 14.113, de 25 de dezembro de 2020, que regulamenta o Fundo de Manutencao e Desenvolvimento da Educacao Basica e de Valorizacao dos Profissionais da Educacao (FUNDEB);

- A Resolucao CNE/CEB n.o 1, de 4 de outubro de 2022, que institui as Normas sobre Computacao na Educacao Basica — Complemento a Base Nacional Comum Curricular (BNCC);

- A Deliberacao CEE n.o 233/2025, do Conselho Estadual de Educacao de Sao Paulo, que estabelece diretrizes para implementacao do componente curricular de Computacao;

- A Resolucao CIF n.o 15/2025, do Comite Interinstitucional do FUNDEB, que define as condicionalidades para distribuicao do Valor Aluno Ano Resultado (VAAR);

- Que o municipio de ${nome} (codigo IBGE ${ibge}) possui ${escolas} unidades escolares, ${matriculas} matriculas e ${docentes} docentes na rede municipal;

- Que a rede municipal possui ${pctInternet} de escolas com acesso a internet;

- Que a receita estimada do FUNDEB 2026 para o municipio e de ${receita};

- A necessidade de adequacao curricular para o componente de Computacao visando ao cumprimento das condicionalidades VAAR e maximizacao dos recursos do FUNDEB;

RESOLVE:

Art. 1.o — OBJETO
Aprovar a inclusao do componente curricular de Computacao no curriculo das escolas da rede municipal de ensino de ${nome}, em conformidade com a Base Nacional Comum Curricular (BNCC) e o referencial curricular de Computacao complementar (Resolucao CNE/CEB n.o 1/2022).

Art. 2.o — ABRANGENCIA
O componente curricular de Computacao sera ofertado em todas as ${escolas} unidades escolares da rede municipal de ${nome}, contemplando:
I - Educacao Infantil: abordagem integrada aos campos de experiencia;
II - Ensino Fundamental — Anos Iniciais (1.o ao 5.o ano): componente integrado;
III - Ensino Fundamental — Anos Finais (6.o ao 9.o ano): componente especifico.

Art. 3.o — COMPONENTE CURRICULAR
O componente de Computacao organiza-se nos seguintes eixos, conforme Resolucao CNE/CEB n.o 1/2022:
I - Pensamento Computacional;
II - Mundo Digital;
III - Cultura Digital;
IV - Tecnologia e Sociedade.

Art. 4.o — CARGA HORARIA
A carga horaria minima do componente curricular de Computacao sera de:
I - Anos Iniciais: 1 (uma) hora-aula semanal;
II - Anos Finais: 2 (duas) horas-aula semanais;
Paragrafo unico. A carga horaria podera ser ampliada conforme disponibilidade da rede e projeto politico-pedagogico de cada unidade escolar.

Art. 5.o — FORMACAO DOCENTE
A Secretaria Municipal de Educacao de ${nome} devera:
I - Promover programa de formacao continuada com carga horaria minima de 32 (trinta e duas) horas anuais para os ${docentes} docentes da rede;
II - Garantir acompanhamento pedagogico permanente;
III - Disponibilizar materiais e recursos didaticos adequados;
IV - Estabelecer parcerias com instituicoes especializadas para suporte tecnico-pedagogico, conforme previsto na Deliberacao CEE 233/2025.

Art. 6.o — VIGENCIA E COMPROVACAO
Esta Resolucao entra em vigor na data de sua publicacao, com implementacao gradual a partir do ano letivo de 2026, devendo a rede municipal estar em plena conformidade ate o inicio do ano letivo de 2027.
Paragrafo unico. A presente resolucao devera ser registrada no SIMEC como comprovacao do atendimento a condicionalidade VAAR prevista na Resolucao CIF n.o 15/2025.

${nome}, ___ de _____________ de 2026.

_________________________________
Presidente do Conselho Municipal de Educacao

_________________________________
Secretario(a) Municipal de Educacao`;
}
