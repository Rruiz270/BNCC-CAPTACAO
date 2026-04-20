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
    ? `R$ ${(data.receitaTotal / 1e6).toFixed(1).replace(".", ",")} milhões`
    : "R$ ___ milhões";

  return `RESOLUÇÃO CME Nº ___/2026

O CONSELHO MUNICIPAL DE EDUCAÇÃO DE ${nome.toUpperCase()}, no uso de suas atribuições legais, e

CONSIDERANDO:

- A Lei nº 14.113, de 25 de dezembro de 2020, que regulamenta o Fundo de Manutenção e Desenvolvimento da Educação Básica e de Valorização dos Profissionais da Educação (FUNDEB);

- A Resolução CNE/CEB nº 1, de 4 de outubro de 2022, que institui as Normas sobre Computação na Educação Básica — Complemento à Base Nacional Comum Curricular (BNCC);

- A Deliberação CEE nº 233/2025, do Conselho Estadual de Educação de São Paulo, que estabelece diretrizes para implementação do componente curricular de Computação;

- A Resolução CIF nº 15/2025, do Comitê Interinstitucional do FUNDEB, que define as condicionalidades para distribuição do Valor Aluno Ano Resultado (VAAR);

- Que o município de ${nome} (código IBGE ${ibge}) possui ${escolas} unidades escolares, ${matriculas} matrículas e ${docentes} docentes na rede municipal;

- Que a rede municipal possui ${pctInternet} de escolas com acesso à internet;

- Que a receita estimada do FUNDEB 2026 para o município é de ${receita};

- A necessidade de adequação curricular para o componente de Computação visando ao cumprimento das condicionalidades VAAR e maximização dos recursos do FUNDEB;

RESOLVE:

Art. 1º — OBJETO
Aprovar a inclusão do componente curricular de Computação no currículo das escolas da rede municipal de ensino de ${nome}, em conformidade com a Base Nacional Comum Curricular (BNCC) e o referencial curricular de Computação complementar (Resolução CNE/CEB nº 1/2022).

Art. 2º — ABRANGÊNCIA
O componente curricular de Computação será ofertado em todas as ${escolas} unidades escolares da rede municipal de ${nome}, contemplando:
I - Educação Infantil: abordagem integrada aos campos de experiência;
II - Ensino Fundamental — Anos Iniciais (1º ao 5º ano): componente integrado;
III - Ensino Fundamental — Anos Finais (6º ao 9º ano): componente específico.

Art. 3º — COMPONENTE CURRICULAR
O componente de Computação organiza-se nos seguintes eixos, conforme Resolução CNE/CEB nº 1/2022:
I - Pensamento Computacional;
II - Mundo Digital;
III - Cultura Digital;
IV - Tecnologia e Sociedade.

Art. 4º — CARGA HORÁRIA
A carga horária mínima do componente curricular de Computação será de:
I - Anos Iniciais: 1 (uma) hora-aula semanal;
II - Anos Finais: 2 (duas) horas-aula semanais;
Parágrafo único. A carga horária poderá ser ampliada conforme disponibilidade da rede e projeto político-pedagógico de cada unidade escolar.

Art. 5º — FORMAÇÃO DOCENTE
A Secretaria Municipal de Educação de ${nome} deverá:
I - Promover programa de formação continuada com carga horária mínima de 32 (trinta e duas) horas anuais para os ${docentes} docentes da rede;
II - Garantir acompanhamento pedagógico permanente;
III - Disponibilizar materiais e recursos didáticos adequados;
IV - Estabelecer parcerias com instituições especializadas para suporte técnico-pedagógico, conforme previsto na Deliberação CEE 233/2025.

Art. 6º — VIGÊNCIA E COMPROVAÇÃO
Esta Resolução entra em vigor na data de sua publicação, com implementação gradual a partir do ano letivo de 2026, devendo a rede municipal estar em plena conformidade até o início do ano letivo de 2027.
Parágrafo único. A presente resolução deverá ser registrada no SIMEC como comprovação do atendimento à condicionalidade VAAR prevista na Resolução CIF nº 15/2025.

${nome}, ___ de _____________ de 2026.

_________________________________
Presidente do Conselho Municipal de Educação

_________________________________
Secretário(a) Municipal de Educação`;
}
