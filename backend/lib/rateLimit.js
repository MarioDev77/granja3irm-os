// ============================================================================
// Rate limiting simples em memória.
//
// Suficiente para uma única instância (ex.: 1 serviço no Railway). Se o app
// crescer para múltiplas instâncias/regiões, troque este armazenamento por
// um contador compartilhado (ex.: Redis / Upstash) — a interface abaixo
// (checkRateLimit) pode ser reimplementada sem alterar quem a chama.
// ============================================================================

const buckets = new Map();

/**
 * @param {string} key identificador único (ex.: `login:IP`)
 * @param {number} limit número máximo de tentativas na janela
 * @param {number} windowMs duração da janela em milissegundos
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function checkRateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
