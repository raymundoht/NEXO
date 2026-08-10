import { z } from "zod";
import { sendEmailConfigurationTest } from "../src/lib/mailer";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const to = z.string().email().parse(argument("--to"));
  await sendEmailConfigurationTest(to);
  console.log(`Correo de prueba enviado a ${to}.`);
}

main().catch((error) => {
  console.error(
    "No fue posible enviar el correo de prueba:",
    error instanceof Error ? error.message : "error desconocido"
  );
  process.exitCode = 1;
});
