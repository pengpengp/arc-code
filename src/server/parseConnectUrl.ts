/**
 * Parse cc:// or cc+unix:// connection URLs.
 * Used by DIRECT_CONNECT feature flag.
 *
 * URL formats:
 *   cc://host:port?token=xxx&tls=true|false
 *   cc+unix:///path/to/socket?token=xxx
 *   cc://host:port/authToken
 */

export type ParsedConnectUrl = {
  serverUrl: string
  authToken: string | undefined
  tls: boolean
  isUnix: boolean
}

export function parseConnectUrl(url: string): ParsedConnectUrl {
  if (url.startsWith('cc+unix://')) {
    // Unix socket: cc+unix:///path/to/socket?token=xxx
    const withoutPrefix = url.slice('cc+unix://'.length)
    const [path, queryString] = withoutPrefix.split('?')
    const params = new URLSearchParams(queryString || '')
    return {
      serverUrl: `unix:${path}`,
      authToken: params.get('token') ?? undefined,
      tls: false,
      isUnix: true,
    }
  }

  if (url.startsWith('cc://')) {
    // TCP: cc://host:port?token=xxx&tls=true
    // or: cc://host:port/authToken
    const withoutPrefix = url.slice('cc://'.length)
    const [hostPart, rest] = withoutPrefix.split('?')
    const [hostAndPort, pathToken] = (hostPart || '').split('/')
    const params = new URLSearchParams(rest || '')
    
    const token = params.get('token') ?? pathToken ?? undefined
    const tlsParam = params.get('tls')
    
    return {
      serverUrl: `http${tlsParam === 'true' ? 's' : ''}://${hostAndPort}`,
      authToken: token,
      tls: tlsParam === 'true',
      isUnix: false,
    }
  }

  // Fallback: treat as plain URL
  return {
    serverUrl: url,
    authToken: undefined,
    tls: false,
    isUnix: false,
  }
}
