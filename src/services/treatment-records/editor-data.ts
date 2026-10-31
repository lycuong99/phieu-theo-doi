import { recordInput } from './contracts';
import type { TreatmentServices } from './contracts';
import type { Data } from '../../types';

/** Reconcile the editor's JSON backup shape through the two CRUD interfaces. */
export async function persistEditorData(services: TreatmentServices, id: string, data: Data, expectedRevision?: number) {
  if (services.saveEditorData) return services.saveEditorData(id, data, expectedRevision);
  await services.records.update(id, recordInput(data));
  await persistTemplates(services, data.templates);
}

export async function persistTemplates(services: TreatmentServices, templates: Data['templates']) {
  const current = await services.templates.list();
  for (const template of current) {
    if (!templates.some(item => item.id === template.id)) await services.templates.remove(template.id);
  }
  for (const template of templates) {
    const existing = current.find(item => item.id === template.id);
    if (!existing) await services.templates.create(template);
    else if (existing.kind !== template.kind || existing.text !== template.text || existing.group !== template.group || existing.name !== template.name || JSON.stringify(existing.orders) !== JSON.stringify(template.orders)) {
      await services.templates.update(template.id, template);
    }
  }
}
