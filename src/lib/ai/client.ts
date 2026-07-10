/**
 * Cliente Claude compartilhado pelas rotas /api/ai/*.
 *
 * Todas as features de IA degradam graciosamente: quando ANTHROPIC_API_KEY
 * não está configurada, as rotas respondem 503 com mensagem clara em vez de
 * quebrar a página. Configure a chave no .env.local e no painel da Vercel.
 */
import Anthropic from '@anthropic-ai/sdk';

export const AI_MODEL = 'claude-opus-4-8';

export function aiDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/** Converte erros do SDK em respostas HTTP amigáveis (nunca vaza 500 cru). */
export function aiErroResponse(e: unknown): Response {
  const err = e as { status?: number; message?: string };
  if (err?.status === 401) {
    return Response.json(
      { error: 'ia_chave_invalida', message: 'A chave ANTHROPIC_API_KEY configurada é inválida. Verifique o valor no .env.local / Vercel.' },
      { status: 503 },
    );
  }
  if (err?.status === 429) {
    return Response.json(
      { error: 'ia_rate_limit', message: 'Limite de uso da IA atingido. Tente novamente em instantes.' },
      { status: 503 },
    );
  }
  return Response.json(
    { error: 'ia_falha', message: `Falha na geração com IA: ${err?.message ?? 'erro desconhecido'}` },
    { status: 502 },
  );
}

/** Resposta padrão quando a IA não está configurada. */
export function aiIndisponivelResponse(): Response {
  return Response.json(
    {
      error: 'ia_nao_configurada',
      message:
        'A camada de IA não está configurada. Defina ANTHROPIC_API_KEY no .env.local (e nas variáveis da Vercel) para habilitar resumos, planos e o assistente.',
    },
    { status: 503 },
  );
}
