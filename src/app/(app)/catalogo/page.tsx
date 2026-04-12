"use client";

import { PageHeader } from "@/components/page-header";

interface Product {
  titulo: string;
  descricao: string;
  detalhes: string[];
  preco: string;
  destaque?: boolean;
  badge?: string;
}

const PRODUCTS: Product[] = [
  {
    titulo: "Plataforma FUNDEB",
    descricao: "Gestão completa FUNDEB",
    detalhes: [
      "Dashboard com indicadores em tempo real",
      "Simulador de receitas e cenários",
      "Monitoramento de compliance VAAR",
      "Relatórios analíticos automatizados",
      "Comparativo intermunicipal",
    ],
    preco: "A partir de R$ 2.500/mês",
    destaque: true,
    badge: "Este produto",
  },
  {
    titulo: "Consultoria BNCC",
    descricao: "Implementação curricular assistida",
    detalhes: [
      "Diagnóstico da situação curricular",
      "Elaboração da proposta curricular",
      "Minuta de resolução CME",
      "Acompanhamento do processo de aprovação",
      "Suporte ao registro no SIMEC",
    ],
    preco: "Sob consulta",
  },
  {
    titulo: "Formação i10",
    descricao: "Programa de capacitação docente",
    detalhes: [
      "4 módulos de 8h (32h total)",
      "Modalidade híbrida (presencial + EAD)",
      "Material didático exclusivo",
      "Certificação válida para progressão",
      "Mentoria individualizada",
    ],
    preco: "A partir de R$ 450/participante",
  },
  {
    titulo: "Dashboard Municipal",
    descricao: "Painel personalizado para secretarias",
    detalhes: [
      "Indicadores educacionais customizados",
      "Integração com sistemas da prefeitura",
      "Acesso multiusuário com perfis",
      "Relatórios para prestação de contas",
      "Suporte técnico dedicado",
    ],
    preco: "A partir de R$ 1.800/mês",
  },
];

export default function CatalogoPage() {
  return (
    <div>
      <PageHeader
        title="Catálogo i10"
        description="Soluções educacionais do Instituto i10"
      />

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        {/* Products */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {PRODUCTS.map((product, i) => (
              <div
                key={i}
                className={`animate-fade-in bg-white border rounded-xl overflow-hidden transition-colors ${
                  product.destaque
                    ? "border-[var(--cyan)] ring-1 ring-[var(--cyan)]/20"
                    : "border-[var(--border)] hover:border-[var(--cyan)]"
                }`}
              >
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-[var(--navy)] text-lg">{product.titulo}</h3>
                      <p className="text-xs text-[var(--cyan)] font-medium mt-0.5">
                        {product.descricao}
                      </p>
                    </div>
                    {product.badge && (
                      <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[var(--cyan)]/10 text-[var(--cyan)] text-[10px] font-bold uppercase tracking-wider">
                        {product.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="px-6 pb-4">
                  <ul className="space-y-2">
                    {product.detalhes.map((detalhe, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-[var(--text2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] flex-shrink-0 mt-1.5" />
                        {detalhe}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price + CTA */}
                <div className="px-6 pb-6 pt-2">
                  <div className="text-xs text-[var(--text3)] mb-3">{product.preco}</div>
                  <button
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      product.destaque
                        ? "bg-[var(--cyan)] text-white hover:bg-[var(--cyan-light)]"
                        : "bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)]"
                    }`}
                  >
                    Saiba mais
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact section */}
        <section className="animate-fade-in">
          <div className="bg-gradient-to-r from-[var(--navy)] to-[var(--navy-dark)] rounded-xl p-8 text-white">
            <div className="max-w-lg">
              <h2 className="text-xl font-bold mb-2">Fale conosco</h2>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                Entre em contato com a equipe do Instituto i10 para conhecer nossas soluções e
                receber uma proposta personalizada para o seu município.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                    📧
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      E-mail
                    </div>
                    <a
                      href="mailto:contato@institutoi10.com.br"
                      className="text-sm text-[var(--cyan-light)] hover:text-white transition-colors"
                    >
                      contato@institutoi10.com.br
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                    📞
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Telefone
                    </div>
                    <a
                      href="tel:+551140028922"
                      className="text-sm text-[var(--cyan-light)] hover:text-white transition-colors"
                    >
                      (11) 4002-8922
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">
                    🌐
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Website
                    </div>
                    <a
                      href="https://institutoi10.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--cyan-light)] hover:text-white transition-colors"
                    >
                      institutoi10.com.br
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
