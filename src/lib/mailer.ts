import nodemailer from "nodemailer";
import { db } from "@/lib/db";

function mailConfiguration() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: { user, pass: password }
  };
}

function developmentMailFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_RESET_LINK === "true"
  );
}

function createTransport() {
  const configuration = mailConfiguration();
  return configuration ? nodemailer.createTransport(configuration) : null;
}

async function getAccentColor(): Promise<string> {
  try {
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });
    return settings.accentColor || "#2563eb";
  } catch {
    return "#2563eb";
  }
}

export async function verifyEmailDelivery() {
  const transport = createTransport();
  if (!transport) {
    if (developmentMailFallback()) return;
    throw new Error("El servicio SMTP no está configurado.");
  }
  await transport.verify();
}

export async function sendPasswordResetCodeEmail(input: {
  to: string;
  name: string;
  code: string;
}) {
  const transport = createTransport();
  if (!transport) {
    if (developmentMailFallback()) {
      console.info(`[DEV RESET CODE] ${input.to}: ${input.code}`);
      return;
    }
    throw new Error("El servicio SMTP no está configurado.");
  }

  const accentColor = await getAccentColor();

  await transport.sendMail({
    from: process.env.SMTP_FROM || "NEXO ERP <no-reply@example.com>",
    to: input.to,
    subject: `${input.code} es tu código de recuperación de NEXO ERP`,
    text: `Hola ${input.name}. Usa este código de 6 dígitos para restablecer tu contraseña. Vence en 30 minutos: ${input.code}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#18213d;max-width:560px">
        <h1 style="font-size:22px">Recupera tu acceso</h1>
        <p>Hola ${escapeHtml(input.name)}, recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Ingresa el siguiente código de seguridad en la pantalla de recuperación:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:${accentColor}">${escapeHtml(input.code)}</p>
        <p style="color:#67708a">El código vence en 30 minutos y sólo puede usarse una vez. Si no lo solicitaste, ignora este correo.</p>
      </div>
    `
  });
}

export async function sendRegistrationCodeEmail(input: {
  to: string;
  name: string;
  code: string;
}) {
  const transport = createTransport();
  if (!transport) {
    if (developmentMailFallback()) {
      console.info(`[DEV REGISTRATION] ${input.to}: ${input.code}`);
      return;
    }
    throw new Error("El servicio SMTP no está configurado.");
  }

  const accentColor = await getAccentColor();

  await transport.sendMail({
    from: process.env.SMTP_FROM || "NEXO ERP <no-reply@example.com>",
    to: input.to,
    subject: `${input.code} es tu código de NEXO ERP`,
    text: `Hola ${input.name}. Tu código de verificación es ${input.code}. Vence en 10 minutos y sólo puede usarse una vez.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#18213d;max-width:560px">
        <h1 style="font-size:22px">Verifica tu correo</h1>
        <p>Hola ${escapeHtml(input.name)}, usa este código para completar tu registro en NEXO ERP:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:${accentColor}">${escapeHtml(input.code)}</p>
        <p style="color:#67708a">Vence en 10 minutos y sólo puede usarse una vez. NEXO nunca te pedirá este código fuera de la pantalla de registro.</p>
      </div>
    `
  });
}

export async function sendEmailConfigurationTest(to: string) {
  const transport = createTransport();
  if (!transport) {
    throw new Error("El servicio SMTP no está configurado.");
  }
  await transport.verify();
  await transport.sendMail({
    from: process.env.SMTP_FROM || "NEXO ERP <no-reply@example.com>",
    to,
    subject: "Prueba de correo de NEXO ERP",
    text: "La configuración SMTP funciona correctamente.",
    html: `
      <div style="font-family:Arial,sans-serif;color:#18213d;max-width:560px">
        <h1 style="font-size:22px">Correo configurado</h1>
        <p>NEXO ERP puede enviar códigos de registro y enlaces de recuperación correctamente.</p>
      </div>
    `
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
