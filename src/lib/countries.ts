const CODES = [
  "US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "ES", "IT", "NL", "BE", "SE", "NO", "DK", "FI", "CH", "AT",
  "PT", "PL", "GR", "CZ", "RO", "MX", "BR", "AR", "CO", "CL", "PE", "PR", "JM", "IN", "PK", "BD", "PH", "ID",
  "MY", "SG", "TH", "VN", "JP", "KR", "CN", "HK", "TW", "AE", "SA", "QA", "IL", "TR", "EG", "ZA", "NG", "KE", "GH",
];

let cached: { code: string; name: string }[] | null = null;

/** Country options for selects, United States first. */
export function countryOptions() {
  if (cached) return cached;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const list = CODES.map((code) => ({ code, name: names.of(code) ?? code }));
  const [us, ...rest] = list;
  cached = [us, ...rest.sort((a, b) => a.name.localeCompare(b.name))];
  return cached;
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
