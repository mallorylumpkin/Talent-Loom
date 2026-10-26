/**
 * Fixed country names. Kept as a static list (rather than the browser's Intl
 * names) so the server and every browser render exactly the same text.
 */
const COUNTRIES: Record<string, string> = {
  US: "United States", AE: "United Arab Emirates", AR: "Argentina", AT: "Austria", AU: "Australia",
  BD: "Bangladesh", BE: "Belgium", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile", CN: "China",
  CO: "Colombia", CZ: "Czechia", DE: "Germany", DK: "Denmark", EG: "Egypt", ES: "Spain", FI: "Finland",
  FR: "France", GB: "United Kingdom", GH: "Ghana", GR: "Greece", HK: "Hong Kong", ID: "Indonesia",
  IE: "Ireland", IL: "Israel", IN: "India", IT: "Italy", JM: "Jamaica", JP: "Japan", KE: "Kenya",
  KR: "South Korea", MX: "Mexico", MY: "Malaysia", NG: "Nigeria", NL: "Netherlands", NO: "Norway",
  NZ: "New Zealand", PE: "Peru", PH: "Philippines", PK: "Pakistan", PL: "Poland", PR: "Puerto Rico",
  PT: "Portugal", QA: "Qatar", RO: "Romania", SA: "Saudi Arabia", SE: "Sweden", SG: "Singapore",
  TH: "Thailand", TR: "Türkiye", TW: "Taiwan", VN: "Vietnam", ZA: "South Africa",
};

const OPTIONS = [
  { code: "US", name: COUNTRIES.US },
  ...Object.entries(COUNTRIES)
    .filter(([code]) => code !== "US")
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en")),
];

/** Country options for selects, United States first. */
export function countryOptions() {
  return OPTIONS;
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRIES[code] ?? code;
}
