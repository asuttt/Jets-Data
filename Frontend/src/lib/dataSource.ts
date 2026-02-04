export type DataMode = "static" | "api";

export const dataSource = {
  mode: "static" as DataMode,
  staticBase: "/data",
  apiBase: "/api",
};

export function buildDataUrl(path: string) {
  if (dataSource.mode === "api") {
    return `${dataSource.apiBase}/${path}`;
  }
  return `${dataSource.staticBase}/${path}`;
}
