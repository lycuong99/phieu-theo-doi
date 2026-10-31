import assert from 'node:assert/strict';
import test from 'node:test';
import { ordersDocument, ordersText, mergeOrders, appendOrdersText, makeMedicationOrder, validOrders } from '../src/lib/treatment-orders.ts';
import { copyDay, dayContent, updateDay } from '../src/lib/daily-records.ts';
import { defaults, parseData } from '../src/services/treatment-records/model.ts';
import { recordInput, readRecord } from '../src/services/treatment-records/contracts.ts';
import { createLocalTreatmentServices } from '../src/services/treatment-records/local-storage.ts';
import { createTreatmentWorkspace } from '../src/services/treatment-records/workspace.ts';
import { printForm } from '../src/lib/print-form.ts';

function prescription() {
  return { version: 1, items: [{ ...makeMedicationOrder(), name: 'Thuốc thử', strength: '3 g', dose: '½', unit: 'lọ', repeat: '4', route: 'TTM', timing: 'mỗi 6h',
    rate: { value: 'XXX', unit: 'giọt/phút' }, relations: [
      { id: 'mix', kind: 'mix', name: 'Dung môi thử', amount: '100', unit: 'mL' },
      { id: 'note', kind: 'note', text: 'Ghi chú nguyên văn' },
    ] }] };
}
const row = (id, orders, session = 'morning') => ({ id, time: '2026-10-22T08:14', progress: 'Diễn biến', orders, session });

test('legacy orders remain verbatim and are never parsed into doses', () => {
  const legacy = '  1. Thuốc ½ lọ *4\n\nPha: giữ nguyên nội dung  ';
  assert.equal(ordersText(legacy), legacy);
  assert.deepEqual(ordersDocument(legacy), ordersDocument(legacy));
  assert.equal(ordersDocument(legacy).items[0].kind, 'text');
  const appended = appendOrdersText(legacy, 'Theo dõi');
  assert.equal(appended.version, 1);
  assert.equal(appended.items[0].text, legacy);
  assert.equal(appended.items[1].text, 'Theo dõi');
  assert.equal(ordersText(appended), `${legacy}\nTheo dõi`);
});

test('unknown versions, malformed relations and duplicate IDs reject without overwriting stored data', async () => {
  const data = defaults();
  for (const invalid of [
    { ...prescription(), version: 2 },
    { version: 1, items: [{ ...prescription().items[0], rate: null }] },
    { version: 1, items: [{ ...prescription().items[0], relations: [{ id: 'x', kind: 'unknown' }] }] },
    { version: 1, items: [{ id: 'x', kind: 'text', text: 'A' }, { id: 'x', kind: 'text', text: 'B' }] },
    { version: 1, items: [{ ...prescription().items[0], relations: [{ id: 'x', kind: 'note', text: 'A' }, { id: 'x', kind: 'note', text: 'B' }] }] },
  ]) {
    assert.equal(validOrders(invalid), false);
    const broken = structuredClone(data);
    broken.forms.treatment.rows[0].orders = invalid;
    assert.throws(() => parseData(broken), /không hợp lệ/);
  }
  const entries = new Map();
  const services = createLocalTreatmentServices(() => ({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }));
  const before = await services.records.get('current');
  const broken = structuredClone(before.forms);
  broken.treatment.rows[0].orders = { version: 99, items: [] };
  await assert.rejects(services.records.update('current', { forms: broken }));
  assert.deepEqual(await services.records.get('current'), before);
});

test('drafts may be incomplete and do not acquire clinical defaults', () => {
  const medication = makeMedicationOrder();
  assert.equal(medication.dose, '');
  assert.equal(medication.unit, '');
  assert.equal(medication.route, '');
  assert.equal(medication.repeat, '');
  assert.deepEqual(medication.rate, { value: '', unit: '' });
  assert.equal(validOrders({ version: 1, items: [medication] }), true);
  assert.ok(!ordersText({ version: 1, items: [medication] }).includes('×'));
});

test('merging legacy and structured rows keeps relationships and IDs unique; progress edits retain orders', () => {
  const structured = prescription();
  const rows = [row('a', 'Ghi chú cũ'), row('b', structured), row('c', structured), row('pm', 'Chỉ buổi chiều', 'afternoon')];
  const content = dayContent(rows, '2026-10-22', 'morning');
  assert.equal(content.orders.items.length, 3);
  assert.equal(validOrders(content.orders), true);
  assert.ok(ordersText(content.orders).startsWith('Ghi chú cũ\n'));
  assert.deepEqual(content.orders.items[1].relations, structured.items[0].relations);
  const next = updateDay(rows, '2026-10-22', 'progress', 'Diễn biến mới');
  assert.deepEqual(next[0].orders, content.orders);
  assert.deepEqual(next[1], rows[3]);
  assert.equal(mergeOrders(['A', 'B']), 'A\nB');
});

test('copying a day creates independent morning and afternoon prescriptions', () => {
  const source = [row('am', prescription()), row('pm', 'Buổi chiều', 'afternoon')];
  const copied = copyDay(source, '2026-10-22', '2026-10-23', 'copy');
  assert.deepEqual(copied[2].orders, source[0].orders);
  copied[2].orders.items[0].relations[0].amount = '999';
  assert.equal(source[0].orders.items[0].relations[0].amount, '100');
  assert.equal(copied[3].orders, 'Buổi chiều');
  assert.equal(copied[2].time, '2026-10-23T00:00');
});

test('workspace flush, backup import and adapter reads preserve the versioned document', async () => {
  const entries = new Map();
  const storage = () => ({ getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) });
  const services = createLocalTreatmentServices(storage);
  const workspace = createTreatmentWorkspace(services);
  await workspace.load();
  const document = prescription();
  workspace.setData(data => ({ ...data, forms: { ...data.forms, treatment: { rows: [row('saved', document)] } } }));
  assert.equal(await workspace.prepareToLeave(), true);
  const id = workspace.getSnapshot().recordId;
  const reopened = await createLocalTreatmentServices(storage).records.get(id);
  assert.deepEqual(reopened.forms.treatment.rows[0].orders, document);
  const backup = parseData(JSON.parse(JSON.stringify({ version: 2, ...recordInput(reopened), templates: [] })));
  assert.deepEqual(backup.forms.treatment.rows[0].orders, document);
  assert.deepEqual(readRecord({ id, ...recordInput(backup) }).forms, backup.forms);
  workspace.dispose();
});

test('print includes dose, repetitions, mixing, rate and notes and escapes user content', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ font: '', measureText: text => ({ width: text.length * 6 }) }) }) };
  try {
    const orders = prescription();
    orders.items[0].relations[1].text = '<img src=x>';
    orders.items[0].sequence = '3';
    const html = printForm(defaults().patient, [row('print', orders), row('pm', 'Chỉ định cũ', 'afternoon')]);
    for (const expected of ['3. Thuốc thử', '½ lọ ×4', 'Pha với:', '100 mL', 'XXX giọt/phút', 'Chỉ định cũ', '&lt;img src=x&gt;']) assert.ok(html.includes(expected), expected);
    assert.ok(!html.includes('<img src=x>'));
  } finally { globalThis.document = previous; }
});

test('manual sequences print consistently without changing names or moving sequence values', async () => {
  const { leadingOrderSequence } = await import('../src/lib/treatment-orders.ts');
  const medication = { ...prescription().items[0], sequence: '3' };
  const text = { id: 'other', kind: 'text', sequence: '7', text: 'Theo dõi' };
  assert.match(ordersText({ version: 1, items: [medication, text] }), /^3\. Thuốc thử/);
  assert.match(ordersText({ version: 1, items: [text, medication] }), /^7\. Theo dõi\n3\./);
  assert.equal(ordersText({ version: 1, items: [{ ...text, sequence: '' }] }), 'Theo dõi');
  assert.equal(validOrders({ version: 1, items: [{ ...text, sequence: 3 }] }), false);
  assert.deepEqual(leadingOrderSequence('3.Bacque'), { sequence: '3', name: 'Bacque' });
  assert.deepEqual(leadingOrderSequence(' 5) Vancomycin'), { sequence: '5', name: 'Vancomycin' });
  assert.equal(leadingOrderSequence('3TC'), null);
  assert.equal(leadingOrderSequence('500mg'), null);
  assert.equal(leadingOrderSequence('0.9%'), null);
  assert.equal(medication.name, 'Thuốc thử');
});

test('applying structured templates appends fresh independent rows and relations with no sequence', async () => {
  const { appendOrderTemplate } = await import('../src/lib/treatment-orders.ts');
  const source = prescription();
  source.items[0].sequence = '5';
  source.items.push({ id: 'text', kind: 'text', sequence: '6', text: 'Theo dõi' });
  const before = structuredClone(source);
  const first = appendOrderTemplate(source, source);
  const second = appendOrderTemplate(first, source);
  assert.equal(second.items.length, 6);
  assert.deepEqual(second.items.slice(0, 2), source.items);
  assert.equal(new Set(second.items.map(i => i.id)).size, 6);
  assert.equal(new Set(second.items.filter(i => i.kind === 'medication').flatMap(i => i.relations.map(r => r.id))).size, 6);
  assert.ok(second.items.slice(2).every(i => i.sequence === undefined));
  second.items[2].relations[0].name = 'Edited';
  second.items[2].rate.value = 'Edited';
  assert.deepEqual(source, before);
  assert.equal(appendOrderTemplate('', '  3. legacy\ntext  ').items[0].text, '  3. legacy\ntext  ');
});

test('structured order templates survive CRUD, edits and backup validation without losing legacy templates', async () => {
  const { persistTemplates } = await import('../src/services/treatment-records/editor-data.ts');
  const values = new Map();
  const services = createLocalTreatmentServices(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }));
  const template = { id: 'structured', kind: 'orders', name: 'Bộ thử', group: 'Nhóm thử', text: ordersText(prescription()), orders: prescription() };
  await services.templates.create(template);
  assert.deepEqual((await services.templates.list()).find(t => t.id === template.id), template);
  const changed = structuredClone(template);
  changed.orders.items[0].sequence = '9';
  await persistTemplates(services, [changed]);
  assert.deepEqual(await services.templates.list(), [changed]);
  const data = defaults();
  data.templates.push(changed);
  assert.deepEqual(parseData(JSON.parse(JSON.stringify(data))).templates, data.templates);
  for (const patch of [{ name: '' }, { group: '' }, { orders: { version: 99, items: [] } }, { orders: 'text' }]) {
    assert.throws(() => parseData({ ...data, templates: [{ ...template, ...patch }] }));
  }
});
