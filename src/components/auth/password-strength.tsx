type PasswordStrengthProps = {
  password: string;
};

const rules = [
  { label: "10 caracteres", test: (value: string) => value.length >= 10 },
  { label: "Mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Número", test: (value: string) => /\d/.test(value) },
  { label: "Símbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) }
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const passed = rules.filter((rule) => rule.test(password)).length;
  const level = strengthLevel(password, passed);

  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--muted)]">Seguridad de la contraseña</span>
        <span className="font-semibold" style={{ color: level.color }}>
          {level.label}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1" aria-hidden="true">
        {rules.map((rule, index) => (
          <span
            className="h-1.5 rounded-full"
            key={rule.label}
            style={{
              backgroundColor: index < passed ? level.color : "var(--border)"
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {rules.map((rule) => {
          const valid = rule.test(password);
          return (
            <span
              className={valid ? "text-[var(--success)]" : "text-[var(--muted)]"}
              key={rule.label}
            >
              {valid ? "✓" : "○"} {rule.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function strengthLevel(password: string, passed: number) {
  if (!password) return { label: "Sin capturar", color: "var(--muted)" };
  if (passed <= 2) return { label: "Débil", color: "var(--danger)" };
  if (passed <= 4) return { label: "Media", color: "var(--warning)" };
  if (password.length >= 14) {
    return { label: "Muy fuerte", color: "var(--success)" };
  }
  return { label: "Fuerte", color: "var(--success)" };
}
