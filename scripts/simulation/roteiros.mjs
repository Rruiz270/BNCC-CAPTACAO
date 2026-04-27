// Roteiros expandidos: wizard completo + tour pela sidebar do consultor.
// Cada cena tem balão de fala "secretária pergunta / consultor responde".

const PAUSE_LONG = 7500;
const PAUSE_MED = 5500;
const PAUSE_SHORT = 4000;

function buildScenes(muni) {
  const fmt = (v) => (v == null ? '—' : `R$ ${(v / 1e6).toFixed(1)}M`);
  const fmtK = (v) => (v == null ? '—' : `R$ ${(v / 1e3).toFixed(0)}k`);
  const fmtN = (v) => (v == null ? '—' : v.toLocaleString('pt-BR'));

  return [
    // ───── Etapa 1-9 do Wizard ─────────────────────────────────────
    {
      id: 'cidade',
      url: '/wizard/{id}/step-1-cidade',
      secret: `Bom dia! Esses dados sobre ${muni.nome} estão atualizados? Quero ter certeza antes de aprovar nada.`,
      resp: `Bom dia! Os dados vêm do Censo Escolar 2024 e FNDE 2026. Olha: ${fmtN(muni.totalMatriculas)} matrículas, receita atual ${fmt(muni.receitaTotal)} e potencial identificado ${fmt(muni.potTotal)}. Vou pedir sua confirmação.`,
      actions: [
        { type: 'wait', ms: 2000 },
        { type: 'check', selector: 'input[type="checkbox"]', optional: true },
        { type: 'wait', ms: 1500 },
      ],
      pauseMs: PAUSE_LONG,
    },
    {
      id: 'discovery',
      url: '/wizard/{id}/step-2-discovery',
      secret: `Preciso anexar algum arquivo agora? Não tenho aqui no celular...`,
      resp: `Pode prosseguir com os dados públicos por ora — eles cobrem 80% do diagnóstico. Anexos você sobe depois pelo módulo Importar Dados.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'diagnostico',
      url: '/wizard/{id}/step-3-diagnostico',
      secret: `Esse potencial de ${fmt(muni.potTotal)} é dinheiro que estou perdendo todo ano?`,
      resp: `É o que poderia entrar se as categorias de matrícula fossem cadastradas corretamente. ${muni.recebeVaar ? 'Você JÁ recebe VAAR — ' + fmtK(muni.vaarBanco) + '/ano.' : 'Você ainda não recebe VAAR — vou te mostrar o caminho.'} Vou abrir o detalhamento.`,
      actions: [
        { type: 'wait', ms: 2000 },
        { type: 'scroll', selector: 'body', y: 500 },
        { type: 'wait', ms: 2000 },
      ],
      pauseMs: PAUSE_LONG,
    },
    {
      id: 'simulacao',
      url: '/wizard/{id}/step-4-simulacao',
      secret: `E se eu conseguir converter mais escolas pra integral até 2027?`,
      resp: `Cada aluno EF parcial → integral vale +R$ 2.981/ano via VAAF (fator 1.50 vs 1.00). Pra ${fmtN(muni.totalMatriculas)} matrículas, mesmo 4% por ano (EC 135) já dá ganho concreto.`,
      actions: [{ type: 'wait', ms: 3000 }],
      pauseMs: PAUSE_LONG,
    },
    {
      id: 'compliance',
      url: '/wizard/{id}/step-5-compliance',
      secret: `Quais dessas 5 condicionalidades VAAR já estamos cumprindo?`,
      resp: `Vou marcar o que já está pronto e te indicar gaps. As 5 são: provimento por mérito, SAEB, redução desigualdades, regime de colaboração e currículo BNCC. Cada uma com prazo até 31/Ago/2026.`,
      actions: [{ type: 'wait', ms: 3000 }],
      pauseMs: PAUSE_LONG,
    },
    {
      id: 'plano-acao',
      url: '/wizard/{id}/step-6-plano-acao',
      secret: `Quantos dias até o Censo de 27/Mai/2026? Preciso de prioridades concretas.`,
      resp: `Faltam exatas 7 semanas. Vou organizar o plano em curto (até Censo), médio (até Ago/2026) e longo prazo (2027+ - expansão integral).`,
      actions: [
        { type: 'wait', ms: 2500 },
        { type: 'scroll', selector: 'body', y: 400 },
      ],
      pauseMs: PAUSE_LONG,
    },
    {
      id: 'documentos',
      url: '/wizard/{id}/step-7-documentos',
      secret: `Preciso apresentar uma minuta de resolução pro CME na próxima reunião.`,
      resp: `Gero agora — minuta personalizada com nome de ${muni.nome}, datas e citações legais (EC 108, EC 135, Lei 14.113/2020). Você ajusta o que quiser depois.`,
      actions: [{ type: 'wait', ms: 3000 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'execucao',
      url: '/wizard/{id}/step-8-execucao',
      secret: `Como acompanho o que falta semana a semana sem ficar perdida?`,
      resp: `Cronograma de 7 semanas com checklist. Você marca o que cumpriu, o sistema atualiza % e re-simula o ganho.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'entrega',
      url: '/wizard/{id}/step-9-entrega',
      secret: `Como fica o registro disso tudo? O que entrego pra prestação de contas?`,
      resp: `Snapshot imutável com hash criptográfico + relatório PDF + minuta CME. Tudo arquivado e exportável.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },

    // ───── Tour pela sidebar (após o wizard) ──────────────────────
    {
      id: 'dashboard',
      url: '/dashboard',
      secret: `O que vejo no Dashboard?`,
      resp: `Visão estadual SP — os 645 municípios agregados. Dá pra ver receita total FUNDEB, distribuição ganho/perda e ranking. Útil pra benchmark comparando ${muni.nome} com vizinhos.`,
      actions: [
        { type: 'wait', ms: 2500 },
        { type: 'scroll', selector: 'body', y: 400 },
      ],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'simulador',
      url: '/simulador',
      secret: `E o Simulador, é diferente do que tem no wizard?`,
      resp: `Aqui você simula sem precisar abrir consultoria — útil pra testar cenários rápidos com qualquer município. Mexe nos sliders por categoria e vê o impacto na receita FUNDEB direto.`,
      actions: [
        { type: 'wait', ms: 2500 },
        { type: 'scroll', selector: 'body', y: 600 },
      ],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'portfolio',
      url: '/portfolio',
      secret: `Onde vejo todas as consultorias que estou conduzindo?`,
      resp: `No Portfolio. Lista cada consultoria ativa, % de compliance, % de plano de ação cumprido. Como gerente, você pula entre cidades direto daqui.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'bncc-computacao',
      url: '/bncc-computacao',
      secret: `BNCC Computação? Isso já tem prazo definido?`,
      resp: `31/Ago/2026 — currículo de Computação tem que estar implementado. Aqui você vê o status do município, gera resolução CME e acompanha registro no SIMEC. É uma das 5 condicionalidades VAAR.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'comparativo',
      url: '/comparativo',
      secret: `Posso comparar ${muni.nome} com municípios vizinhos?`,
      resp: `Sim — escolha 2-3 municípios e o sistema mostra side-by-side: receita por aluno, % integral, IDEB, compliance. Bom pra entender se ${muni.nome} está acima ou abaixo da média regional.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'captacao',
      url: '/captacao',
      secret: `Como você manda o link de intake pra mim, e como vê quem respondeu?`,
      resp: `Daqui. Captação é onde o consultor gera links de intake em massa, vê quais foram respondidos, quais expiraram. Cada link tem 7 dias de validade.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'catalogo',
      url: '/catalogo',
      secret: `O que é o Catálogo i10?`,
      resp: `Catálogo das soluções pedagógicas que o Instituto i10 oferece — formação de professores, material didático, plataformas. Funciona como vitrine quando você quer apresentar parcerias durante a consultoria.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'projecao',
      url: '/projecao',
      secret: `Projeção Financeira mostra o quê?`,
      resp: `Como a receita de ${muni.nome} evolui ao longo de 5 anos com o plano de ação aplicado. Compara cenário "como está hoje" vs "se cumprir todas as ações" — útil pra apresentar pro prefeito.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'calculadora-ec135',
      url: '/calculadora-ec135',
      secret: `EC 135 — eu lembro que tem 4% de novas vagas integrais. Aqui calcula isso?`,
      resp: `Exato. Você informa total de matrículas, % atual de integral, e a calculadora projeta novas vagas necessárias por ano até 2030, ganho FUNDEB e custo de infraestrutura. Define o ROI da expansão integral.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'relatorios',
      url: '/relatorios/gerar',
      secret: `E o relatório final que vou levar pra câmara?`,
      resp: `Você gera aqui — PDF completo da consultoria com diagnóstico, simulações, compliance, plano de ação e snapshot. Personalizável com logo da prefeitura. Tudo o que entregamos vira documento oficial.`,
      actions: [{ type: 'wait', ms: 3000 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'consultorias',
      url: '/consultorias',
      secret: `E as consultorias antigas, ficam onde?`,
      resp: `Em Histórico. Toda consultoria já encerrada com snapshot fica disponível pra consulta — você pode revisar relatórios anteriores ou usar como referência pra novas cidades parecidas.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },
    {
      id: 'importar',
      url: '/importar',
      secret: `Quando eu vou ter dados próprios pra subir, faço aqui?`,
      resp: `Sim. Importar Dados aceita planilhas Censo, SIOPE, FNDE — o ETL processa, valida, e atualiza os números do município. É como o sistema fica fresh.`,
      actions: [{ type: 'wait', ms: 2500 }],
      pauseMs: PAUSE_MED,
    },

    // ───── Cena final: telão ─────────────────────────────────────
    {
      id: 'telao',
      url: '/consultorias/{id}/telao',
      secret: `Posso ver o resumo final em modo apresentação pra mostrar ao prefeito?`,
      resp: `Aqui está. Esse é o número que você leva à câmara: ganho garantido (cadastro correto) + potencial a destravar (compliance + IDEB). É a narrativa de venda pra negociar com a prefeitura.`,
      actions: [{ type: 'wait', ms: 4000 }],
      pauseMs: 9000,
    },
  ];
}

export const ROTEIROS = [
  { cityKey: 'pequeno-balbinos', cityLabel: 'Balbinos (pequena)', municipalityName: 'Balbinos',                expectedSize: 'pequeno', buildScenes },
  { cityKey: 'medio-paulinia',   cityLabel: 'Paulínia (média)',   municipalityName: 'Paulínia',                expectedSize: 'medio',   buildScenes },
  { cityKey: 'grande-campinas',  cityLabel: 'Campinas (grande)',  municipalityName: 'Campinas',                expectedSize: 'grande',  buildScenes },
];
