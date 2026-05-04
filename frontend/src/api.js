const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL =
  configuredApiUrl && configuredApiUrl.length
    ? configuredApiUrl.replace(/\/$/, "")
    : typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:8000/api`
      : "http://127.0.0.1:8000/api";

export function resolveImageUrl(source) {
  if (!source) {
    return null;
  }

  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
    return source;
  }

  return `${API_URL.replace(/\/api$/, "")}${source.startsWith("/") ? source : `/${source}`}`;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("so_os_de_fe_token");
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Erro ao comunicar com a API.");
  }

  return data;
}

export { API_URL };
