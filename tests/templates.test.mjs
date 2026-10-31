import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTemplates, templateTitle } from '../src/lib/templates.ts';
const templates = [
  { id: 'one', kind: 'orders', name: 'Mẫu chỉ định thử', group: 'Hô hấp', text: 'Nội dung thứ nhất', orders: { version: 1, items: [] } },
  { id: 'legacy', kind: 'orders', group: 'Theo dõi', text: '  Theo dõi thử\nGiữ nguyên văn bản' },
  { id: 'progress', kind: 'progress', group: 'Toàn trạng', text: 'Tỉnh, tiếp xúc tốt.' },
];
test('page and picker search names, groups and full legacy content with Vietnamese accent folding', () => {
  assert.deepEqual(filterTemplates(templates, 'orders', 'chi dinh ho hap').map(t => t.id), ['one']);
  assert.deepEqual(filterTemplates(templates, 'orders', 'giu nguyen').map(t => t.id), ['legacy']);
  assert.deepEqual(filterTemplates(templates, 'progress', 'tinh').map(t => t.id), ['progress']);
  assert.equal(filterTemplates(templates, 'orders', 'tinh').length, 0);
});
test('group filtering composes with search and does not change source contents', () => {
  const before = structuredClone(templates);
  assert.deepEqual(filterTemplates(templates, 'orders', 'thu', 'Theo dõi').map(t => t.id), ['legacy']);
  assert.equal(filterTemplates(templates, 'orders', 'thu', 'Toàn trạng').length, 0);
  assert.deepEqual(templates, before);
  assert.equal(templateTitle(templates[0]), 'Mẫu chỉ định thử');
  assert.equal(templateTitle(templates[1]), 'Theo dõi thử');
});
