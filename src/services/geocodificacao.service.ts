export interface Local {
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
}

const SEM_LOCAL: Local = { cidade: null, uf: null, lat: null, lng: null };

/**
 * CEP (8 dígitos) → cidade/UF/coordenadas via AwesomeAPI. Nunca lança: se a API
 * cair, demorar mais de 3 s ou não achar o CEP, devolve tudo nulo e o cadastro segue.
 */
export async function geocodificar(cep: string): Promise<Local> {
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return SEM_LOCAL;
    const d = (await res.json()) as { city?: string; state?: string; lat?: string; lng?: string };
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (!d.city || !d.state || !Number.isFinite(lat) || !Number.isFinite(lng)) return SEM_LOCAL;
    return { cidade: d.city, uf: d.state, lat, lng };
  } catch {
    return SEM_LOCAL;
  }
}
