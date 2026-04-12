/**
 * Pure URL normalization for git remote URLs — no file system or process dependencies.
 */

function isLocalHost(host: string): boolean {
  const hostWithoutPort = host.split(':')[0] ?? ''
  return (
    hostWithoutPort === 'localhost' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostWithoutPort) ||
    hostWithoutPort === '0.0.0.0' ||
    hostWithoutPort === '::1'
  )
}

export function normalizeGitRemoteUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  // Handle SSH format: git@host:owner/repo.git
  const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch && sshMatch[1] && sshMatch[2]) {
    return `${sshMatch[1]}/${sshMatch[2]}`.toLowerCase()
  }

  // Handle HTTPS/SSH URL format: https://host/owner/repo.git or ssh://git@host/owner/repo
  const urlMatch = trimmed.match(
    /^(?:https?|ssh):\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/,
  )
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    const host = urlMatch[1]
    const path = urlMatch[2]

    // CCR git proxy URLs use format:
    //   Legacy:  http://...@127.0.0.1:PORT/git/owner/repo       (github.com assumed)
    //   GHE:     http://...@127.0.0.1:PORT/git/ghe.host/owner/repo (host encoded in path)
    // Strip the /git/ prefix. If the first segment contains a dot, it's a
    // hostname (GitHub org names cannot contain dots). Otherwise assume github.com.
    if (isLocalHost(host) && path.startsWith('git/')) {
      const proxyPath = path.slice(4) // Remove "git/" prefix
      const segments = proxyPath.split('/')
      // 3+ segments where first contains a dot → host/owner/repo (GHE format)
      if (segments.length >= 3 && segments[0]!.includes('.')) {
        return proxyPath.toLowerCase()
      }
      // 2 segments → owner/repo (legacy format, assume github.com)
      return `github.com/${proxyPath}`.toLowerCase()
    }

    return `${host}/${path}`.toLowerCase()
  }

  return null
}
