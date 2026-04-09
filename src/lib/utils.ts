import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(1).replace('.', ',')} mi`;
  if (value >= 1e3) return `R$ ${(value / 1e3).toFixed(0)} mil`;
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
