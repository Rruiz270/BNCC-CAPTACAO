interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}

export function StatCard({ label, value, sub, color = "var(--cyan)", icon }: StatCardProps) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">{label}</div>
          <div className="text-2xl font-extrabold mt-1" style={{ color }}>{value}</div>
          {sub && <div className="text-xs text-[var(--text2)] mt-0.5">{sub}</div>}
        </div>
        {icon && <span className="text-2xl opacity-50">{icon}</span>}
      </div>
    </div>
  );
}
