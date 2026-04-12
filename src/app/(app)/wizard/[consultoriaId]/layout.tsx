import { WizardLayoutClient } from "./layout-client";

export default async function WizardLayout({
  params,
  children,
}: {
  params: Promise<{ consultoriaId: string }>;
  children: React.ReactNode;
}) {
  const { consultoriaId } = await params;
  const id = parseInt(consultoriaId, 10);

  return <WizardLayoutClient consultoriaId={id}>{children}</WizardLayoutClient>;
}
