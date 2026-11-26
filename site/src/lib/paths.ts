/** Resolve a site-relative path under the GitHub Pages project base. */
export function sitePath(path = ''): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
