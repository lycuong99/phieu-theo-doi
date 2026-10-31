import type { ConvexReactClient } from 'convex/react';
import { api } from '../../../convex/_generated/api.js';
import { recordInput, readRecord } from './contracts';
import type { TreatmentServices } from './contracts';
import { validData, validTemplates } from './model';

type Client = Pick<ConvexReactClient, 'query' | 'mutation'> & Partial<Pick<ConvexReactClient, 'watchQuery'>>;

/** Convex types and function references stay inside this adapter. */
export function createConvexTreatmentServices(
  client: Client,
  getWorkspaceKey: () => string,
  local: TreatmentServices,
): TreatmentServices {
  const workspaceKey = getWorkspaceKey();
  let initialization: Promise<string> | undefined;

  async function initialize(): Promise<string> {
    if (await client.query(api.workspaces.exists, { workspaceKey })) return workspaceKey;
    if (workspaceKey !== 'shared') throw new Error('Không tìm thấy Khoa. Hãy chọn lại Khoa.');
    const [summaries, templates] = await Promise.all([local.records.list(), local.templates.list()]);
    const records = await Promise.all(summaries.map(summary => local.records.get(summary.id)));
    await client.mutation(api.workspaces.initialize, { workspaceKey, records, templates });
    return workspaceKey;
  }

  function ready() {
    // Deduplicate StrictMode and concurrent reads; a failed initialization may be retried.
    initialization ??= initialize().catch(error => {
      initialization = undefined;
      throw error;
    });
    return initialization;
  }

  return {
    storage: 'cloud',
    careDefaults: {
      async get(){return client.query(api.careDefaults.get,{workspaceKey:await ready()})},
      async update(value,expectedRevision){return client.mutation(api.careDefaults.update,{workspaceKey:await ready(),value,expectedRevision})},
      watch(onChange,onError){
        let cancelled=false;let unsubscribe:(()=>void)|undefined;
        void ready().then(workspaceKey=>{
          if(cancelled||!client.watchQuery)return;
          const query=client.watchQuery(api.careDefaults.get,{workspaceKey});
          const emit=()=>{try{const value=query.localQueryResult();if(value&&!cancelled)onChange(value)}catch{if(!cancelled)onError()}};
          unsubscribe=query.onUpdate(emit);emit();
        },()=>{if(!cancelled)onError()});
        return()=>{cancelled=true;unsubscribe?.()};
      },
    },
    async snapshot() { const snapshot = await client.query(api.workspaces.snapshot, { workspaceKey: await ready() }); return { ...snapshot, records: snapshot.records.map(readRecord) }; },
    async saveTemplates(templates, expectedRevision) {
      return client.mutation(api.templates.replaceAll, { workspaceKey: await ready(), templates, expectedRevision });
    },
    ...(client.watchQuery ? { watch(onChange, onError) {
      let cancelled = false;
      let unsubscribe: (() => void) | undefined;
      void ready().then(workspaceKey => {
        if (cancelled || !client.watchQuery) return;
        const watch = client.watchQuery(api.workspaces.snapshot, { workspaceKey });
        const emit = () => {
          try { const value = watch.localQueryResult(); if (value && !cancelled) onChange({ ...value, records: value.records.map(readRecord) }); }
          catch { if (!cancelled) onError(); }
        };
        unsubscribe = watch.onUpdate(emit);
        emit();
      }, () => { if (!cancelled) onError(); });
      return () => { cancelled = true; unsubscribe?.(); };
    } } satisfies Pick<TreatmentServices, 'watch'> : {}),
    records: {
      async list() { return client.query(api.records.list, { workspaceKey: await ready() }); },
      async get(id) { return readRecord(await client.query(api.records.get, { workspaceKey: await ready(), id })); },
      async create(input, expectedRevision) {
        if (!validData({ version: 2, ...input, templates: [] })) throw new Error('Phiếu điều trị không hợp lệ');
        return readRecord(await client.mutation(api.records.create, {
          workspaceKey: await ready(), record: { id: crypto.randomUUID(), ...recordInput(input) }, expectedRevision,
        }));
      },
      async update(id, input) {
        await client.mutation(api.records.update, { workspaceKey: await ready(), id, input });
      },
      async remove(id) { return client.mutation(api.records.remove, { workspaceKey: await ready(), id }); },
    },
    templates: {
      async list() { return client.query(api.templates.list, { workspaceKey: await ready() }); },
      async create(input) {
        const template = { ...input, id: input.id ?? crypto.randomUUID() };
        if (!validTemplates([template])) throw new Error('Nội dung mẫu không hợp lệ');
        return client.mutation(api.templates.create, { workspaceKey: await ready(), template });
      },
      async update(id, input) {
        const { kind, text, group, name, orders } = input;
        await client.mutation(api.templates.update, { workspaceKey: await ready(), id, input: { kind, text, group, name, orders } });
      },
      async remove(id) { await client.mutation(api.templates.remove, { workspaceKey: await ready(), id }); },
    },
    async saveEditorData(id, data, expectedRevision) {
      if (!validData(data)) throw new Error('Dữ liệu phiếu không hợp lệ');
      return client.mutation(api.records.saveEditor, {
        workspaceKey: await ready(), id, input: recordInput(data), templates: data.templates, expectedRevision,
      });
    },
  };
}
