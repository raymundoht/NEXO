"use client";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: unknown } };

export async function apiFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body && !isFormData ? { "content-type": "application/json" } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text || `Error ${response.status}`;
    try {
      const payload = JSON.parse(text) as ApiEnvelope<T>;
      if (!payload.ok) message = payload.error.message;
    } catch {
      // Proxies can return HTML or plain text instead of the API envelope.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

export function formatMoney(
  value: string | number,
  currency = "MXN"
) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency
  }).format(Number(value));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
