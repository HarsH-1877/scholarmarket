/**
 * Retrieve CSRF token from document cookies (double-submit pattern).
 */
export function getCsrfTokenFromCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

function shouldRetryNetworkError(error, config, attempt, retries) {
  if (error.status) return false;
  if (error.name === 'AbortError') return false;
  if (config.signal?.aborted) return false;
  return attempt < retries;
}

/**
 * A lightweight fetch wrapper for public and authenticated API calls.
 *
 * Network failures are retried only when callers opt in via `retries`, with a
 * short linear delay. HTTP responses, including 5xx, are never retried so
 * callers see the server's mapped error immediately. Retries stay opt-in so
 * non-idempotent requests keep their existing single-attempt behavior.
 */
export async function apiClient(endpoint, {
  body,
  idempotencyKey,
  retries = 0,
  retryDelayMs = 100,
  ...customConfig
} = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  if (idempotencyKey && !customConfig.headers?.['Idempotency-Key'] && !customConfig.headers?.['idempotency-key']) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  if (config.headers['Content-Type'] === undefined) {
    delete config.headers['Content-Type'];
  }

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(endpoint, config);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return await response.text();
      }

      if (response.status === 401) {
        console.warn('API Unauthorized: Possible session expiry');
      }

      let errorData = {};
      const contentType = response.headers.get('content-type');

      try {
        if (
          contentType &&
          (contentType.includes('application/json') ||
            contentType.includes('application/problem+json'))
        ) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { detail: text || `HTTP error! status: ${response.status}` };
        }
      } catch {
        errorData = {
          detail: 'Unknown server error',
          title: 'Internal Server Error',
          status: response.status,
        };
      }

      const message =
        errorData.detail ||
        errorData.error ||
        errorData.title ||
        `HTTP error! status: ${response.status}`;

      const error = new Error(message);
      error.status = errorData.status || response.status;
      error.title = errorData.title;
      error.type = errorData.type;
      error.instance = errorData.instance;
      error.errors = Array.isArray(errorData.errors) ? errorData.errors : [];
      error.data = errorData;

      console.error(`API Error [${error.status}] at ${endpoint}:`, error.message);
      throw error;
    } catch (err) {
      if (err.status) throw err;

      if (!shouldRetryNetworkError(err, config, attempt, retries)) {
        if (err.name === 'AbortError') throw err;
        const wrappedError = new Error(err.message || 'Network request failed');
        console.error(`API Network Error at ${endpoint}:`, wrappedError.message);
        throw wrappedError;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }
}
