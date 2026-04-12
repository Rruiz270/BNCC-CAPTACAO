import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </Providers>
  );
}
