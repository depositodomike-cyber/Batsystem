// ----------------------------------------------------------------------
// Clima do Resumo Matinal — Open-Meteo (gratuito, sem chave). Só usa a cidade
// do Perfil Pessoal; nunca presume localização.
// ----------------------------------------------------------------------

import type { Clima } from './briefing.tipos';

const TIMEOUT_MS = 8000;

/** Geocodificação em cache (cidade muda raramente). */
const geoCache = new Map<string, { lat: number; lon: number; nome: string } | null>();

/** Códigos WMO → descrição. */
const WMO_PT: Record<number, string> = {
  0: 'céu limpo',
  1: 'predominantemente limpo',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'neblina',
  48: 'neblina com geada',
  51: 'garoa fraca',
  53: 'garoa',
  55: 'garoa forte',
  61: 'chuva fraca',
  63: 'chuva',
  65: 'chuva forte',
  66: 'chuva congelante',
  67: 'chuva congelante forte',
  71: 'neve fraca',
  73: 'neve',
  75: 'neve forte',
  80: 'pancadas de chuva fracas',
  81: 'pancadas de chuva',
  82: 'pancadas de chuva fortes',
  95: 'trovoadas',
  96: 'trovoadas com granizo',
  99: 'trovoadas fortes com granizo',
};
const WMO_EN: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'severe thunderstorms',
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function geocodificar(cidade: string, estado: string, pais: string, idioma: string) {
  const chave = `${cidade}|${estado}|${pais}`.toLowerCase();
  if (geoCache.has(chave)) return geoCache.get(chave) ?? null;
  const params = new URLSearchParams({ name: cidade, count: '10', language: idioma, format: 'json' });
  const data = await getJson<{
    results?: { latitude: number; longitude: number; name: string; admin1?: string; country?: string; country_code?: string }[];
  }>(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  const lista = data.results ?? [];
  const norm = (s?: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
  // Desempata pelo estado/país do Perfil, quando preenchidos.
  const escolhido =
    lista.find(
      (r) =>
        (!estado || norm(r.admin1).includes(norm(estado)) || norm(estado).includes(norm(r.admin1))) &&
        (!pais || norm(r.country) === norm(pais) || norm(r.country_code) === norm(pais)),
    ) ??
    lista.find((r) => !pais || norm(r.country) === norm(pais) || norm(r.country_code) === norm(pais)) ??
    lista[0];
  const res = escolhido ? { lat: escolhido.latitude, lon: escolhido.longitude, nome: escolhido.name } : null;
  geoCache.set(chave, res);
  return res;
}

export async function buscarClima(
  local: { cidade: string; estado?: string; pais?: string },
  idioma: 'pt' | 'en',
  fuso: string,
): Promise<Clima | null> {
  const geo = await geocodificar(local.cidade, local.estado ?? '', local.pais ?? '', idioma);
  if (!geo) return null;
  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lon),
    current: 'temperature_2m,apparent_temperature,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
  });
  const d = await getJson<{
    current?: { temperature_2m: number; apparent_temperature?: number; weather_code: number };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: (number | null)[];
    };
  }>(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!d.current) return null;
  const tabela = idioma === 'en' ? WMO_EN : WMO_PT;
  const desc = (c?: number) => (c === undefined ? '' : (tabela[c] ?? WMO_PT[c] ?? ''));
  const dia = d.daily?.time?.[0];
  const rotuloDia = dia
    ? new Date(`${dia}T12:00:00`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: fuso,
      })
    : '';
  const chuva = d.daily?.precipitation_probability_max?.[0];
  return {
    cidade: geo.nome,
    temperatura: Math.round(d.current.temperature_2m),
    ...(d.current.apparent_temperature !== undefined ? { sensacao: Math.round(d.current.apparent_temperature) } : {}),
    condicao: desc(d.current.weather_code) || desc(d.daily?.weather_code?.[0]),
    ...(d.daily?.temperature_2m_max?.[0] !== undefined ? { maxima: Math.round(d.daily.temperature_2m_max[0]) } : {}),
    ...(d.daily?.temperature_2m_min?.[0] !== undefined ? { minima: Math.round(d.daily.temperature_2m_min[0]) } : {}),
    ...(typeof chuva === 'number' ? { chanceChuva: chuva } : {}),
    periodo: idioma === 'en' ? `today${rotuloDia ? `, ${rotuloDia}` : ''}` : `hoje${rotuloDia ? `, ${rotuloDia}` : ''}`,
  };
}
