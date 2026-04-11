import { redirect } from "next/navigation";

export default async function WizardIndex({
  params,
}: {
  params: Promise<{ consultoriaId: string }>;
}) {
  const { consultoriaId } = await params;
  redirect(`/wizard/${consultoriaId}/step-1-cidade`);
}
