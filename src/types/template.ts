import type { TreatmentOrdersV1 } from './treatment-orders';
export type TemplateKind = 'progress' | 'orders';
export type Template = { id: string; kind: TemplateKind; text: string; group: string; name?: string; orders?: TreatmentOrdersV1 };
// An optional caller ID preserves IDs when importing an existing JSON backup.
export type TemplateInput = Omit<Template, 'id'> & { id?: string };
