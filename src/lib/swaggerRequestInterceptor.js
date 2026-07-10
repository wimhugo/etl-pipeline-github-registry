import { base44 } from '@/api/base44Client';

/**
 * Creates a requestInterceptor that injects a `userFetch` into every
 * "Try it out" request.  Swagger UI's internal http client (http_http)
 * calls `(req.userFetch || fetch)(url, req)` and then runs the result
 * through `serializeResponse`, which expects a standard Response object
 * (with `.ok`, `.status`, `.statusText`, `.headers`, and `.text()`).
 *
 * By returning a real Response from userFetch, the response flows through
 * the normal serializeResponse → setResponse → fromJSOrdered pipeline,
 * producing the Immutable Map that LiveResponse.render expects.
 */
export function createRequestInterceptor(serverUrl) {
  const serverPathname = new URL(serverUrl, window.location.origin).pathname;

  return (req) => {
    req.userFetch = async (url, options) => {
      const parsedUrl = new URL(url, window.location.origin);

      // Extract the API path, stripping the display server's pathname prefix
      let apiPath = parsedUrl.pathname;
      if (serverPathname && apiPath.startsWith(serverPathname)) {
        apiPath = apiPath.substring(serverPathname.length);
      }
      if (!apiPath.startsWith('/')) apiPath = '/' + apiPath;
      apiPath = apiPath.replace(/\/$/, '') || '/';

      // Collect query parameters (includes `format` for content negotiation)
      const params = {};
      parsedUrl.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // Parse body if present (POST/PUT/PATCH)
      if (options?.body) {
        try {
          const bodyObj = typeof options.body === 'string'
            ? JSON.parse(options.body)
            : options.body;
          if (bodyObj && typeof bodyObj === 'object') {
            Object.assign(params, bodyObj);
          }
        } catch { /* not JSON, ignore */ }
      }

      try {
        const result = await base44.functions.invoke('apiProxy', {
          api_path: apiPath,
          _method: (options?.method || 'GET').toUpperCase(),
          ...params,
        });

        const data = result?.data ?? result;

        // When the target function produced a non-JSON response (e.g.
        // text/turtle), apiProxy wraps it as { _content_type, _raw_body }.
        // Reconstruct the proper Response with the correct Content-Type so
        // Swagger UI renders it as text rather than JSON.
        if (data && data._content_type && data._raw_body) {
          return new Response(data._raw_body, {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': data._content_type },
          });
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        const status = err?.response?.status || 500;
        const errorData = err?.response?.data || { error: err.message };
        return new Response(JSON.stringify(errorData), {
          status,
          statusText: err?.response?.statusText || 'Error',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };

    return req;
  };
}