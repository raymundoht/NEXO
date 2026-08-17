function connectionUser(value: string | undefined) {
  try {
    return value ? decodeURIComponent(new URL(value).username).split(".")[0] : "";
  } catch {
    return "";
  }
}

const runtimeDbUser = connectionUser(process.env.DATABASE_URL);
const migrationDbUser = connectionUser(process.env.DIRECT_URL);

const checks: Array<{ label: string; valid: boolean; help: string }> = [
  {
    label: "APP_URL usa HTTPS",
    valid: Boolean(process.env.APP_URL?.startsWith("https://")),
    help: "Configura APP_URL con la URL pública https:// del ERP."
  },
  {
    label: "SESSION_HASH_KEY tiene al menos 32 bytes",
    valid: Buffer.byteLength(process.env.SESSION_HASH_KEY || "", "utf8") >= 32,
    help: "Genera una clave nueva con: openssl rand -hex 32"
  },
  {
    label: "DATABASE_URL exige SSL y usa Transaction Pooler",
    valid:
      Boolean(process.env.DATABASE_URL?.includes("sslmode=require")) &&
      Boolean(process.env.DATABASE_URL?.includes("pgbouncer=true")),
    help: "Usa el Transaction Pooler con sslmode=require y pgbouncer=true."
  },
  {
    label: "DIRECT_URL exige SSL",
    valid: Boolean(process.env.DIRECT_URL?.includes("sslmode=require")),
    help: "La conexión de migraciones debe usar sslmode=require."
  },
  {
    label: "La aplicación usa el rol privado nexo_backend",
    valid:
      runtimeDbUser === "nexo_backend" &&
      Boolean(migrationDbUser) &&
      migrationDbUser !== runtimeDbUser,
    help:
      "Usa nexo_backend en DATABASE_URL y reserva un usuario propietario distinto para DIRECT_URL."
  },
  {
    label: "SMTP está configurado",
    valid: Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD &&
        process.env.SMTP_FROM
    ),
    help: "Configura SMTP_HOST, SMTP_USER, SMTP_PASSWORD y SMTP_FROM."
  },
  {
    label: "Enlaces de recuperación de desarrollo deshabilitados",
    valid: process.env.ALLOW_DEV_RESET_LINK === "false",
    help: "Configura ALLOW_DEV_RESET_LINK=false."
  },
  {
    label: "Datos de demostración deshabilitados",
    valid: process.env.SEED_DEMO_DATA === "false",
    help: "Configura SEED_DEMO_DATA=false."
  },
  {
    label: "Registro público limitado a dominios autorizados",
    valid:
      process.env.SELF_REGISTRATION_ENABLED !== "true" ||
      Boolean(process.env.REGISTRATION_ALLOWED_DOMAINS?.trim()),
    help: "Deshabilita SELF_REGISTRATION_ENABLED o configura REGISTRATION_ALLOWED_DOMAINS."
  },
  {
    label: "Clave secreta de Stripe configurada (Sandbox)",
    valid: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")),
    help: "Configura STRIPE_SECRET_KEY con tu clave de pruebas sk_test_."
  },
  {
    label: "Secreto de Webhook de Stripe configurado",
    valid: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")),
    help: "Configura STRIPE_WEBHOOK_SECRET con el secreto del endpoint whsec_."
  }
];

let failed = false;
for (const check of checks) {
  const mark = check.valid ? "OK" : "FALTA";
  console.log(`[${mark}] ${check.label}`);
  if (!check.valid) {
    failed = true;
    console.log(`        ${check.help}`);
  }
}

if (failed) {
  console.error(
    "\nLa configuración todavía no cumple los requisitos de producción."
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nLa configuración de la aplicación está lista para validarse en el hosting."
  );
}
