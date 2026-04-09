"use client";

import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import Papa from "papaparse";

type ImportType = "matriculas" | "escolas" | "compliance";

export default function ImportarPage() {
  const [importType, setImportType] = useState<ImportType>("matriculas");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setImported(false);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete(results) {
        const data = results.data as string[][];
        if (data.length > 0) {
          setHeaders(data[0]);
          setRows(data.slice(1, 11));
          setTotalRows(data.length - 1);
        }
      },
      error() {
        alert("Erro ao processar o arquivo CSV.");
      },
    });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      processFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleSubmit() {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImported(true);
    }, 1500);
  }

  function handleReset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setTotalRows(0);
    setImported(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const importOptions: { value: ImportType; label: string; desc: string }[] = [
    { value: "matriculas", label: "Matrículas", desc: "Dados de matrículas por escola e categoria" },
    { value: "escolas", label: "Escolas", desc: "Cadastro de unidades escolares da rede" },
    { value: "compliance", label: "Compliance", desc: "Status das condicionalidades VAAR" },
  ];

  return (
    <div>
      <PageHeader
        title="Importar Dados"
        description="Importe dados de matrículas e escolas via CSV"
      />

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">
        {/* Import type selector */}
        <section className="animate-fade-in">
          <h2 className="text-sm font-bold text-[var(--navy)] mb-3">Tipo de Importação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {importOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setImportType(opt.value)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  importType === opt.value
                    ? "border-[var(--cyan)] bg-[var(--cyan)]/5"
                    : "border-[var(--border)] bg-white hover:border-[var(--cyan)]/50"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    importType === opt.value ? "text-[var(--cyan)]" : "text-[var(--navy)]"
                  }`}
                >
                  {opt.label}
                </div>
                <div className="text-xs text-[var(--text3)] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* File upload zone */}
        <section className="animate-fade-in">
          <h2 className="text-sm font-bold text-[var(--navy)] mb-3">Arquivo CSV</h2>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[var(--cyan)] bg-[var(--cyan)]/5"
                : fileName
                ? "border-[var(--green)] bg-[var(--green)]/5"
                : "border-[var(--border)] bg-white hover:border-[var(--cyan)] hover:bg-[var(--cyan)]/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {fileName ? (
              <>
                <span className="text-3xl block mb-2">📄</span>
                <p className="text-sm font-semibold text-[var(--navy)]">{fileName}</p>
                <p className="text-xs text-[var(--text3)] mt-1">
                  {totalRows} registros encontrados
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className="mt-3 text-xs text-[var(--red)] hover:underline"
                >
                  Remover arquivo
                </button>
              </>
            ) : (
              <>
                <span className="text-3xl block mb-2">📥</span>
                <p className="text-sm font-medium text-[var(--text2)]">
                  Arraste um arquivo CSV aqui ou clique para selecionar
                </p>
                <p className="text-xs text-[var(--text3)] mt-1">
                  Formatos aceitos: .csv (separador: vírgula ou ponto e vírgula)
                </p>
              </>
            )}
          </div>
        </section>

        {/* Preview table */}
        {headers.length > 0 && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--navy)]">
                Prévia dos Dados
                <span className="font-normal text-[var(--text3)] ml-2">
                  (primeiros {rows.length} de {totalRows} registros)
                </span>
              </h2>
            </div>
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-4 py-3 font-semibold text-[var(--navy)] whitespace-nowrap border-b border-[var(--border)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)]/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-4 py-2.5 text-[var(--text2)] whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Submit */}
        {headers.length > 0 && (
          <section className="animate-fade-in flex items-center gap-4">
            <button
              onClick={handleSubmit}
              disabled={importing || imported}
              className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                imported
                  ? "bg-[var(--green)] text-white"
                  : importing
                  ? "bg-[var(--navy)]/50 text-white cursor-wait"
                  : "bg-[var(--navy)] text-white hover:bg-[var(--navy-dark)]"
              }`}
            >
              {imported
                ? "Dados importados com sucesso!"
                : importing
                ? "Importando..."
                : `Importar ${totalRows} registros`}
            </button>
            {imported && (
              <span className="text-xs text-[var(--green-dark)] font-medium">
                Os dados de {importOptions.find((o) => o.value === importType)?.label.toLowerCase()} foram processados.
              </span>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
