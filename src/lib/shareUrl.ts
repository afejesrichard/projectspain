// The public catalogue's shareable URL. With hash routing the app can live at
// any subpath (e.g. https://<user>.github.io/<repo>/), so build the link from
// the current document location rather than assuming the site root.
export function publicShareUrl(): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/nyilvanos`
}
