import type { Template, TemplateKind } from '../types';

export function templateTitle(template: Template): string {
  return template.name?.trim() || template.text.split('\n')[0].trim().slice(0, 100) || 'Mẫu chưa có nội dung';
}
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
/** Shared search semantics for the management page and quick picker. */
export function filterTemplates(templates: readonly Template[], kind: TemplateKind, query = '', group = ''): Template[] {
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  return templates.filter(template => template.kind === kind && (!group || template.group === group)
    && terms.every(term => searchable(`${templateTitle(template)} ${template.group} ${template.text}`).includes(term)));
}
