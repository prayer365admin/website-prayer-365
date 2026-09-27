export function objectToQueryString(obj: { [key: string]: string | number }) {
  return Object.keys(obj)
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(`${obj[key]}`))
    .join('&')
}
