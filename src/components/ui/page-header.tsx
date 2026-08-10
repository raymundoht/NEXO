  type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b border-[var(--color-border)] pb-6 mb-8">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5 shrink-0 mt-2 lg:mt-0">{actions}</div> : null}
    </div>
  );
}
