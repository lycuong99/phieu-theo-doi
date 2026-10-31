import { validOrders } from '../../lib/treatment-orders';
import { dayjs } from '../../lib/date';
import { emptyCare, validForms, validTreatmentRows } from '../../forms/model';
import type { Data, Patient, Template, TemplateKind, TreatmentRow } from '../../types';

type LegacyData = Omit<Data, 'version' | 'forms' | 'patientReview'> & { version: 1; rows: TreatmentRow[]; dayPatients?: Record<string, Patient> };

export const localTime = () => dayjs().format('YYYY-MM-DDTHH:mm');
export const makeRow = (): TreatmentRow => ({ id: crypto.randomUUID(), time: localTime(), progress: '', orders: '' });
export const blankPatient: Patient = {
  name: '', birth: '', gender: '', code: '', admission: '', department: '', room: '', bed: '', diagnosis: '', differential: '',
};
const initialTemplates: Template[] = [
  ['progress', 'Tỉnh, tiếp xúc tốt.', 'Toàn trạng'], ['progress', 'Không sốt.', 'Toàn trạng'],
  ['progress', 'Ăn uống được.', 'Toàn trạng'], ['progress', 'Ngủ được.', 'Toàn trạng'],
  ['progress', 'Da, niêm mạc hồng.', 'Thăm khám'], ['progress', 'Tim đều.', 'Thăm khám'],
  ['progress', 'Phổi thông khí đều hai bên.', 'Thăm khám'], ['progress', 'Bụng mềm, không chướng.', 'Thăm khám'],
  ['orders', 'Theo dõi dấu hiệu sinh tồn.', 'Theo dõi'], ['orders', 'Theo dõi tình trạng ăn uống.', 'Theo dõi'],
  ['orders', 'Theo dõi lượng nước tiểu.', 'Theo dõi'],
].map(([kind, text, group], index) => ({ id: `seed-${index}`, kind: kind as TemplateKind, text, group }));

export const defaults = (): Data => ({
  version: 2, patient: { ...blankPatient }, forms: { treatment: { rows: [makeRow()] }, infusion: { rows: [] }, care: emptyCare() }, templates: structuredClone(initialTemplates),
});

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validPatient(value: unknown): value is Patient {
  return object(value) && Object.keys(blankPatient).every(key => typeof value[key] === 'string');
}
export function validTemplates(value: unknown): value is Template[] {
  return Array.isArray(value) && value.every(item => object(item)
    && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.group === 'string'
    && (item.kind === 'progress' || item.kind === 'orders')
    && (item.name === undefined || typeof item.name === 'string')
    && (item.orders === undefined || (item.kind === 'orders' && typeof item.name === 'string' && !!item.name.trim() && !!item.group.trim() && typeof item.orders !== 'string' && validOrders(item.orders))))
    && new Set(value.map(item => item.id)).size === value.length;
}
export function validData(value: unknown): value is Data {
  return object(value) && value.version === 2 && validPatient(value.patient) && validForms(value.forms)
    && validMetadata(value) && validTemplates(value.templates)
    && (value.patientReview === undefined || (object(value.patientReview) && validPatient(value.patientReview.base)
      && object(value.patientReview.byDay) && Object.values(value.patientReview.byDay).every(validPatient) && typeof value.patientReview.resolved === 'boolean'));
}
function validMetadata(value: Record<string, unknown>) {
  return (value.status === undefined || value.status === 'active' || value.status === 'completed')
    && (value.startedOn === undefined || typeof value.startedOn === 'string')
    && (value.endedOn === undefined || value.endedOn === null || typeof value.endedOn === 'string');
}
/** Pure migration: original patient values are retained for review and backup. */
export function parseData(value: unknown): Data {
  if (validData(value)) return structuredClone(value);
  if (!object(value) || value.version !== 1 || !validPatient(value.patient) || !validTreatmentRows(value.rows)
    || !validMetadata(value) || !validTemplates(value.templates)
    || (value.dayPatients !== undefined && (!object(value.dayPatients) || !Object.values(value.dayPatients).every(validPatient)))) {
    throw new Error('Dữ liệu phiếu không hợp lệ');
  }
  const legacy = value as LegacyData;
  const byDay = legacy.dayPatients ?? {};
  const candidates = [legacy.patient, ...Object.values(byDay)].filter(p => Object.values(p).some(v => v.trim()));
  const signature = (p: Patient) => JSON.stringify(Object.keys(blankPatient).map(k => p[k as keyof Patient]));
  const different = new Map(candidates.map(p => [signature(p), p]));
  const patient = different.size === 1 ? [...different.values()][0] : legacy.patient;
  return structuredClone({
    version: 2, patient, forms: { treatment: { rows: legacy.rows }, infusion: { rows: [] }, care: emptyCare() }, templates: legacy.templates,
    ...(Object.keys(byDay).length ? { patientReview: { base: legacy.patient, byDay, resolved: different.size <= 1 } } : {}),
    ...(legacy.status !== undefined ? { status: legacy.status } : {}),
    ...(legacy.startedOn !== undefined ? { startedOn: legacy.startedOn } : {}),
    ...(legacy.endedOn !== undefined ? { endedOn: legacy.endedOn } : {}),
  });
}
