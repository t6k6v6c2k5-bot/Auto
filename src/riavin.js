// Параметры авто по VIN из объявлений (платный метод API объявлений; в бесплатном пакете — пробные запросы).
// Вызывается ТОЛЬКО в оплаченном отчёте и в админ-отчёте владельца; результат кэшируется надолго, расход за месяц считается в базе.
import { cfg } from './config.js';
import * as store from './db.js';

const URL_ = 'https://developers.ria.com/auto/params/by/vin-code/';
const UA = 'VINScope/1.0 (+https://vinscope.com.ua; vehicle check service)';
const HIT_TTL = 30 * 864e5, MISS_TTL = 7 * 864e5;
const usageKey = () => 'usage-vin:' + new Date().toISOString().slice(0, 7);
export const vinUsed = () => { const r = store.getRia(usageKey()); return r ? Number(JSON.parse(r.json)) || 0 : 0; };

// чипы ответа -> плоский объект; значения приходят на украинском языке источника
export function parseChips(j) {
  const chips = j?.chipsData?.chips; if (!Array.isArray(chips) || !chips.length) return null;
  const by = Object.fromEntries(chips.map((c) => [c.entity, c]));
  const range = (c) => (c?.value && typeof c.value === 'object' ? { from: c.value.gte, to: c.value.lte } : null);
  const out = {
    brand: by.brandId?.name || '', model: by.modelId?.name || '', generation: by.generationId?.name || '', modification: by.modificationId?.name || '',
    body: by.bodyId?.name || '', fuel: by.fuelId?.name || '', gearbox: by.gearBoxId?.name || '', drive: by.driveId?.name || '', color: by.colorId?.name || '', region: by.stateId?.name || '',
    year: range(by.year)?.from || null, engine: range(by.engineVolume)?.from || null, mileageK: range(by.mileage)?.to ?? null,
  };
  return out.brand || out.model ? out : null;
}

// { found, data } или null (нет доступа, исчерпан лимит, ошибка). Не вызывать из бесплатной проверки.
export async function adsByVin(vin) {
  if (!cfg.riaKey || !cfg.riaUserId || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  const key = 'vin:' + vin; const row = store.getRia(key);
  if (row) { const v = JSON.parse(row.json); if (Date.now() - row.ts < (v?.found ? HIT_TTL : MISS_TTL)) return v; }
  if (vinUsed() >= cfg.riaVinMonthlyLimit) return null; // пробный пакет: 10 запросов, оставляем запас
  try {
    store.setRia(usageKey(), JSON.stringify(vinUsed() + 1));
    const u = new URL(URL_); u.searchParams.set('user_id', cfg.riaUserId); u.searchParams.set('api_key', cfg.riaKey);
    const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' }, body: JSON.stringify({ langId: 4, period: 365, params: { omniId: vin } }), signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error('ria vin ' + r.status);
    const t = await r.text(); if (t.trimStart().startsWith('<')) throw new Error('ria vin refused');
    const j = JSON.parse(t); if (j?.error) throw new Error('ria vin error response');
    const data = parseChips(j); const v = data ? { found: true, data } : { found: false };
    store.setRia(key, JSON.stringify(v)); return v;
  } catch (e) { console.error('ads by vin', e.message); return null; }
}
