import type { MedicationOrder, OrderRelation, TreatmentOrder, TreatmentOrders, TreatmentOrdersV1 } from '../types';

export const makeMedicationOrder = (): MedicationOrder => ({
  id: crypto.randomUUID(), kind: 'medication', name: '', strength: '', dose: '', unit: '',
  repeat: '', route: '', timing: '', marker: '', rate: { value: '', unit: '' }, relations: [],
});
export const makeTextOrder = (text = ''): TreatmentOrder => ({ id: crypto.randomUUID(), kind: 'text', text });
export function makeOrderRelation(kind: OrderRelation['kind']): OrderRelation {
  return kind === 'mix'
    ? { id: crypto.randomUUID(), kind, name: '', amount: '', unit: '' }
    : { id: crypto.randomUUID(), kind, text: '' };
}
export function relationText(relation: OrderRelation): string {
  return relation.kind === 'note' ? `Ghi chú: ${relation.text}`
    : `Pha với: ${[relation.name, relation.amount && `${relation.amount} ${relation.unit}`.trim()].filter(Boolean).join(' · ')}`;
}
export function orderHeading(order: TreatmentOrder): string {
  const heading = order.kind === 'text' ? order.text : [order.marker, order.name, order.strength,
    order.dose && `${order.dose} ${order.unit}`.trim(), order.repeat && `×${order.repeat}`,
    order.route, order.timing].filter(Boolean).join(' ');
  return order.sequence?.trim() ? `${order.sequence.trim()}. ${heading}` : heading;
}
export function medicationDetails(order: MedicationOrder): string[] {
  return [...order.relations.map(relationText), ...(order.rate.value.trim()
    ? [`Tốc độ: ${order.rate.value} ${order.rate.unit}`.trim()] : [])];
}
export function ordersText(orders: TreatmentOrders): string {
  if (typeof orders === 'string') return orders;
  return orders.items.map(order => [orderHeading(order), ...(order.kind === 'medication'
    ? medicationDetails(order).map(line => `  ${line}`) : [])].join('\n')).join('\n');
}
/** Stable IDs during reads; never parse free text into clinical fields. */
export function ordersDocument(orders: TreatmentOrders, prefix = 'legacy'): TreatmentOrdersV1 {
  return typeof orders === 'string'
    ? { version: 1, items: orders.length ? [{ id: prefix, kind: 'text', text: orders }] : [] }
    : orders;
}
export function mergeOrders(values: TreatmentOrders[]): TreatmentOrders {
  if (values.every(value => typeof value === 'string')) return values.filter(value => value.trim()).join('\n');
  const ids = new Set<string>();
  const items = values.flatMap((value, index) => ordersDocument(value, `legacy-${index}`).items).map(item => {
    let id = item.id;
    for (let suffix = 1; ids.has(id); suffix++) id = `${item.id}-${suffix}`;
    ids.add(id);
    return id === item.id ? item : { ...item, id };
  });
  return { version: 1, items };
}
export function appendOrdersText(orders: TreatmentOrders, text: string): TreatmentOrdersV1 {
  return { version: 1, items: [...ordersDocument(orders).items, makeTextOrder(text)] };
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;
function validRelation(value: unknown): value is OrderRelation {
  return object(value) && typeof value.id === 'string' && (value.kind === 'note'
    ? typeof value.text === 'string' : value.kind === 'mix' && strings(value, ['name', 'amount', 'unit']));
}
export function validOrder(value: unknown): value is TreatmentOrder {
  if (!object(value) || typeof value.id !== 'string' || (value.sequence !== undefined && typeof value.sequence !== 'string')) return false;
  if (value.kind === 'text') return typeof value.text === 'string';
  return value.kind === 'medication' && strings(value, ['name', 'strength', 'dose', 'unit', 'repeat', 'route', 'timing', 'marker'])
    && object(value.rate) && strings(value.rate, ['value', 'unit'])
    && Array.isArray(value.relations) && value.relations.every(validRelation) && unique(value.relations);
}
/** Reject unknown versions at import/read; do not silently drop unsupported content. Drafts may be incomplete. */
export function validOrders(value: unknown): value is TreatmentOrders {
  return typeof value === 'string' || object(value) && value.version === 1
    && Array.isArray(value.items) && value.items.every(validOrder) && unique(value.items);
}

/** Explicit suggestion only: never mutate names while reading or typing. */
export function leadingOrderSequence(name: string): { sequence: string; name: string } | null {
  const match = name.match(/^\s*(\d+)[.)]\s*([^\d\s][\s\S]*)$/);
  return match ? { sequence: match[1], name: match[2] } : null;
}
export function appendOrderTemplate(current: TreatmentOrders, template: TreatmentOrders): TreatmentOrdersV1 {
  const items = ordersDocument(template).items.map(item => {
    const { sequence: _sequence, ...rest } = item;
    return { ...rest, id: crypto.randomUUID(), ...(item.kind === 'medication'
      ? { rate: { ...item.rate }, relations: item.relations.map(relation => ({ ...relation, id: crypto.randomUUID() })) } : {}) };
  });
  return { version: 1, items: [...ordersDocument(current).items, ...items] };
}
