"use client";

import { useState, useEffect } from "react";

interface Municipality {
  id: number;
  nome: string;
  totalMatriculas: number | null;
  receitaTotal: number | null;
}

interface Props {
  value?: number;
  onChange: (id: number, muni: Municipality) => void;
  className?: string;
}

export function MunicipalitySelector({ value, onChange, className }: Props) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/municipalities?limit=645")
      .then((r) => r.json())
      .then((data) => setMunicipalities(data.data || []));
  }, []);

  const filtered = municipalities.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  const selected = municipalities.find((m) => m.id === value);

  return (
    <div className={`relative ${className || ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm font-medium hover:border-[var(--cyan)] transition-colors"
      >
        <span className={selected ? "text-[var(--text)]" : "text-[var(--text3)]"}>
          {selected ? selected.nome : "Selecione um município..."}
        </span>
        <svg className="w-4 h-4 text-[var(--text3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-lg shadow-xl max-h-80 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              placeholder="Buscar município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--cyan)]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-64">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id, m);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#00B4D8]/5 transition-colors flex items-center justify-between ${
                  m.id === value ? "bg-[#00B4D8]/10 font-semibold" : ""
                }`}
              >
                <span>{m.nome}</span>
                <span className="text-xs text-[var(--text3)]">
                  {m.totalMatriculas?.toLocaleString("pt-BR")} mat
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-[var(--text3)]">Nenhum município encontrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
