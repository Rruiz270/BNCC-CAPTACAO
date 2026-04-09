"use client";

import { ConsultoriaProvider } from "@/lib/consultoria-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ConsultoriaProvider>{children}</ConsultoriaProvider>;
}
