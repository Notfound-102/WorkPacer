import { UpdateCheckResult } from '../shared/types'

export const GITHUB_LATEST_RELEASE_API =
  'https://api.github.com/repos/Notfound-102/WorkPacer/releases/latest'
export const GITHUB_RELEASES_PAGE = 'https://github.com/Notfound-102/WorkPacer/releases'

interface ParsedSemver {
  major: number
  minor: number
  patch: number
  prerelease: string | null
}

export function parseSemver(versionStr: string): ParsedSemver | null {
  const cleaned = versionStr.trim().replace(/^[vV]/, '')
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(cleaned)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  }
}

/**
 * Returns:
 *   1 if `a > b`
 *   0 if `a == b`
 *  -1 if `a < b`
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1

  // Stable release > prerelease of same X.Y.Z
  if (!pa.prerelease && pb.prerelease) return 1
  if (pa.prerelease && !pb.prerelease) return -1
  if (pa.prerelease && pb.prerelease && pa.prerelease !== pb.prerelease) {
    return pa.prerelease > pb.prerelease ? 1 : -1
  }
  return 0
}

export async function checkForGitHubUpdates(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch
): Promise<UpdateCheckResult> {
  const checkedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetchImpl(GITHUB_LATEST_RELEASE_API, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `WorkPacer-Desktop/${currentVersion}`
      },
      signal: controller.signal
    })

    // 404 means the repository has no published releases yet -> treat as up-to-date cleanly
    if (res.status === 404) {
      return {
        checkedAt,
        currentVersion,
        latestVersion: `v${currentVersion.replace(/^[vV]/, '')}`,
        hasUpdate: false,
        releaseUrl: GITHUB_RELEASES_PAGE
      }
    }

    if (!res.ok) {
      return {
        checkedAt,
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: GITHUB_RELEASES_PAGE,
        error: `HTTP ${res.status}`
      }
    }

    const data = (await res.json()) as {
      tag_name?: string
      name?: string
      html_url?: string
      published_at?: string
      body?: string
    }

    const latestTag = (data.tag_name || '').trim()
    if (!latestTag) {
      return {
        checkedAt,
        currentVersion,
        latestVersion: `v${currentVersion.replace(/^[vV]/, '')}`,
        hasUpdate: false,
        releaseUrl: data.html_url || GITHUB_RELEASES_PAGE
      }
    }

    const hasUpdate = compareSemver(latestTag, currentVersion) > 0
    return {
      checkedAt,
      currentVersion,
      latestVersion: latestTag.startsWith('v') || latestTag.startsWith('V') ? latestTag : `v${latestTag}`,
      hasUpdate,
      releaseUrl: data.html_url || GITHUB_RELEASES_PAGE,
      releaseName: data.name || latestTag,
      publishedAt: data.published_at,
      releaseNotes: data.body ? data.body.slice(0, 600) : undefined
    }
  } catch (err: any) {
    return {
      checkedAt,
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      releaseUrl: GITHUB_RELEASES_PAGE,
      error: err?.message || 'NETWORK_ERROR'
    }
  } finally {
    clearTimeout(timeout)
  }
}
