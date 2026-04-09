"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/diagnostico", label: "Diagnóstico", icon: "🔍" },
  { href: "/simulador", label: "Simulador", icon: "🎛️" },
  { href: "/comparativo", label: "Comparativo", icon: "⚖️" },
  { href: "/compliance", label: "Compliance", icon: "✅" },
  { href: "/plano-de-acao", label: "Plano de Ação", icon: "📋" },
  { type: "divider", label: "Implementação" },
  { href: "/implementacao/curriculo", label: "Currículo BNCC", icon: "📚" },
  { href: "/implementacao/minuta", label: "Minuta CME", icon: "📄" },
  { href: "/implementacao/simec", label: "Guia SIMEC", icon: "🏛️" },
  { href: "/implementacao/formacao", label: "Formação Docente", icon: "👩‍🏫" },
  { type: "divider", label: "Dados" },
  { href: "/importar", label: "Importar Dados", icon: "📥" },
  { href: "/relatorios", label: "Relatórios", icon: "📑" },
  { type: "divider", label: "" },
  { href: "/catalogo", label: "Catálogo i10", icon: "🏷️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0A2463] text-white flex flex-col z-50 overflow-y-auto">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-[#00B4D8] font-extrabold text-sm tracking-wider uppercase">Instituto i10</div>
        <div className="text-white/50 text-xs mt-0.5">Plataforma FUNDEB 2026</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return (
              <div key={i} className="pt-4 pb-1 px-3">
                {item.label && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {item.label}
                  </span>
                )}
              </div>
            );
          }

          const isActive = item.href && pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 text-[10px] text-white/30">
        <div>FUNDEB SP 2026</div>
        <div>645 municípios • 15 categorias</div>
      </div>
    </aside>
  );
}
