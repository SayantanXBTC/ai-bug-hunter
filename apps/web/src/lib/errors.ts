/**
 * Extract a human-readable message from a failed fetch Response.
 * Backend consistently returns `{ error: { code, message, requestId } }`,
 * but a few legacy paths still return `{ error: "string" }` or bare `{ message }`.
 * This helper handles all three so UIs never render `[object Object]`.
 */
export async function messageFromResponse(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: string | { message?: string; code?: string };
      message?: string;
    };
    if (typeof body?.error === 'string') return body.error;
    if (body?.error && typeof body.error === 'object' && body.error.message) {
      return body.error.message;
    }
    if (body?.message) return body.message;
    return fallback;
  } catch {
    return fallback;
  }
}
