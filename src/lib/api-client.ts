// Hackathon devnet: API key is public-facing, not a real secret
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ""

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(API_KEY ? { "x-api-key": API_KEY } : {}),
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `API error ${res.status}`)
  }

  return res.json()
}

export function apiGet<T>(url: string) {
  return apiFetch<T>(url)
}

export function apiPost<T>(url: string, body: unknown) {
  return apiFetch<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
