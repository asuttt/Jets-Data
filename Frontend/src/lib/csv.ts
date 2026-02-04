import Papa from "papaparse";

export async function loadCsv<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${url}`);
  }
  const text = await response.text();
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }

  return parsed.data;
}
