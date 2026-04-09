interface PageHeaderProps {
  label?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ label, title, description, children }: PageHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-[#0A2463] to-[#0d3280] text-white px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            {label && (
              <div className="text-[#00B4D8] text-xs font-bold uppercase tracking-widest mb-1">{label}</div>
            )}
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && <p className="text-white/60 text-sm mt-1 max-w-xl">{description}</p>}
          </div>
          {children && <div className="flex items-center gap-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
