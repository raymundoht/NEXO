import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_ERROR"
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisa los campos enviados.",
          fields: error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DUPLICATE",
            message: "Ya existe un registro con esos datos únicos."
          }
        },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Registro no encontrado." }
        },
        { status: 404 }
      );
    }
    if (error.code === "P2034") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONCURRENT_CHANGE",
            message:
              "Los datos cambiaron durante la operación. Revisa las existencias e intenta de nuevo."
          }
        },
        { status: 409 }
      );
    }
  }

  console.error(error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado."
      }
    },
    { status: 500 }
  );
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "El cuerpo de la solicitud no es JSON válido.");
  }
}

export function getPagination(url: string, maxPageSize = 100) {
  const params = new URL(url).searchParams;
  const rawPage = params.get("page");
  const rawPageSize = params.get("pageSize");
  const page = rawPage === null ? 1 : Number(rawPage);
  const requestedPageSize = rawPageSize === null ? 25 : Number(rawPageSize);

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new ApiError(400, "La página debe ser un entero mayor a cero.");
  }
  if (!Number.isSafeInteger(requestedPageSize) || requestedPageSize < 1) {
    throw new ApiError(400, "El tamaño de página debe ser un entero mayor a cero.");
  }

  const pageSize = Math.min(maxPageSize, requestedPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}
