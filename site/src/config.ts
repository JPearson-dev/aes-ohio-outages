// Forks: update these to point at your own fork's data branch.
export const GITHUB_OWNER = 'JPearson-dev'
export const GITHUB_REPO = 'aes-ohio-outages'
const DATA_BRANCH = 'data'

export const DATA_BASE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${DATA_BRANCH}`
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`

// Root-relative base path the site is actually served from: nothing in dev,
// `/aes-ohio-outages` on GitHub Pages project sites. A fork on a custom
// domain (served from its own root) should override this to ''.
export const SITE_ROOT = import.meta.env.DEV ? '' : `/${GITHUB_REPO}`
