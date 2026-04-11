/**
 * Parse cc:// and cc+unix:// direct-connect URLs.
 *
 * Formats:
 *   cc://host:port?auth_token=TOKEN
 *   cc://host?auth_token=TOKEN
 *   cc+unix:///path/to/socket?auth_token=TOKEN
 *
 * Returns { serverUrl, authToken } or null if the URL is malformed.
 */
export function parseConnectUrl(url: string): { serverUrl: string; authToken: string } | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'cc:') {
      // cc://host:port?auth_token=TOKEN
      const authToken = parsed.searchParams.get('auth_token');
      if (!authToken) return null;

      const serverUrl = `http://${parsed.host}`;
      return { serverUrl, authToken };
    }

    if (parsed.protocol === 'cc+unix:') {
      // cc+unix:///path/to/socket?auth_token=TOKEN
      const authToken = parsed.searchParams.get('auth_token');
      if (!authToken) return null;

      // Unix socket: use the path as the server identifier
      const serverUrl = `unix:${parsed.pathname}`;
      return { serverUrl, authToken };
    }

    return null;
  } catch {
    return null;
  }
}
