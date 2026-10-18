/**
 * Safe fetch wrapper to prevent "Unexpected token 'A', 'A server e'... is not valid JSON"
 * and gracefully handle server errors, HTML 500 pages, and network failures.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isJson) {
      try {
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: data?.error || data?.message || `Request failed (HTTP ${res.status})`,
            data,
          };
        }
        return { ok: true, status: res.status, data };
      } catch (jsonErr: any) {
        console.warn('[safeFetchJson] Failed parsing JSON body despite content-type header:', jsonErr);
      }
    }

    // Response is not JSON (e.g., text/plain, text/html error page from proxy or Vercel)
    const text = await res.text();
    if (!res.ok) {
      // Clean up text if it's brief, otherwise return a sanitized message
      let message = text.trim();
      if (message.startsWith('<') || message.length > 200) {
        message = `Server returned HTTP ${res.status}. Please try again shortly.`;
      }
      return {
        ok: false,
        status: res.status,
        error: message || `Server returned error status ${res.status}`,
      };
    }

    // Try parsing as JSON anyway in case content-type was omitted
    try {
      const parsed = JSON.parse(text);
      return { ok: true, status: res.status, data: parsed };
    } catch {
      return {
        ok: false,
        status: res.status,
        error: 'Unexpected server response format.',
      };
    }
  } catch (err: any) {
    console.error('[safeFetchJson] Network/Fetch error:', err);
    return {
      ok: false,
      status: 0,
      error: err?.message?.includes('Failed to fetch')
        ? 'Network error. Please check your internet connection or server status.'
        : err?.message || 'A network error occurred.',
    };
  }
}
