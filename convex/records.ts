import { validTemplates } from '../src/services/treatment-records/model';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireRecord, requireWorkspace, checkedWorkspaceKey, bumpRevision, checkRevision } from './access';
import { record, recordFields, recordPatch, template } from './validators';
import { summarizeRecord } from '../src/services/treatment-records/episodes';
import { recordInput, readRecord } from '../src/services/treatment-records/contracts';

const args = { workspaceKey: v.string(), id: v.string() };

export const list = query({
  args: { workspaceKey: v.string() },
  handler: async (ctx, { workspaceKey }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    await requireWorkspace(ctx, workspaceKey);
    const records = await ctx.db.query('treatmentRecords')
      .withIndex('by_workspace', q => q.eq('workspaceKey', workspaceKey)).collect();
    return records.map(item => summarizeRecord(readRecord(item)));
  },
});
export const get = query({
  args,
  handler: async (ctx, { workspaceKey, id }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    const item = await requireRecord(ctx, workspaceKey, id);
    const { _id, _creationTime, workspaceKey: _workspace, ...raw } = item;
    return raw;
  },
});
export const create = mutation({
  args: { workspaceKey: v.string(), record, expectedRevision: v.optional(v.number()) },
  handler: async (ctx, { workspaceKey, record: item, expectedRevision }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    await requireWorkspace(ctx, workspaceKey);
    readRecord(item);
    if (!(item.forms?.treatment.rows ?? item.rows)?.length) throw new ConvexError('Phiếu phải có ít nhất một dòng');
    const existing = await ctx.db.query('treatmentRecords')
      .withIndex('by_workspace_id', q => q.eq('workspaceKey', workspaceKey).eq('id', item.id)).unique();
    if (existing) throw new ConvexError('Mã phiếu đã tồn tại');
    await checkRevision(ctx, workspaceKey, expectedRevision);
    await ctx.db.insert('treatmentRecords', { workspaceKey, ...item });
    return { ...item, workspaceRevision: await bumpRevision(ctx, workspaceKey) };
  },
});
export const update = mutation({
  args: { ...args, input: recordPatch },
  handler: async (ctx, { workspaceKey, id, input }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    const item = await requireRecord(ctx, workspaceKey, id);
    readRecord({ ...item, ...input });
    if ((input.rows && !input.rows.length) || (input.forms && !input.forms.treatment.rows.length)) throw new ConvexError('Phiếu phải có ít nhất một dòng');
    if (item.forms && (input.rows || input.dayPatients)) throw new ConvexError('Ứng dụng đã được cập nhật. Hãy tải lại trang trước khi sửa.');
    await ctx.db.patch(item._id, input);
    return await bumpRevision(ctx, workspaceKey);
  },
});
export const remove = mutation({
  args,
  handler: async (ctx, { workspaceKey, id }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    const item = await requireRecord(ctx, workspaceKey, id);
    await ctx.db.delete(item._id);
    return await bumpRevision(ctx, workspaceKey);
  },
});

/** A treatment sheet and its imported template library must commit together. */
export const saveEditor = mutation({
  args: { ...args, input: v.object(recordFields), templates: v.array(template), expectedRevision: v.optional(v.number()) },
  handler: async (ctx, { workspaceKey, id, input, templates, expectedRevision }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    const item = await requireRecord(ctx, workspaceKey, id);
    if (!(input.forms?.treatment.rows ?? input.rows)?.length || new Set(templates.map(value => value.id)).size !== templates.length) {
      throw new ConvexError('Phiếu hoặc thư viện mẫu không hợp lệ');
    }
    await checkRevision(ctx, workspaceKey, expectedRevision);
    if (item.forms && !input.forms) throw new ConvexError('Ứng dụng đã được cập nhật. Hãy tải lại trang trước khi lưu.');
    // Canonical conversion retains old patient snapshots inside patientReview.
    const canonical = recordInput(readRecord({ id, ...input, ...(!item.forms && input.forms && !input.patientReview ? { patientReview: readRecord(item).patientReview } : {}) }));
    await ctx.db.replace(item._id, {
      workspaceKey, id, status: item.status, startedOn: item.startedOn, endedOn: item.endedOn, ...canonical,
    });
    const current = await ctx.db.query('templates')
      .withIndex('by_workspace', q => q.eq('workspaceKey', workspaceKey)).collect();
    if (!validTemplates(templates)) throw new ConvexError('Nội dung mẫu không hợp lệ');
    const target = new Map(templates.map(value => [value.id, value]));
    for (const previous of current) {
      const next = target.get(previous.id);
      if (!next) await ctx.db.delete(previous._id);
      else {
        if (next.kind !== previous.kind || next.text !== previous.text || next.group !== previous.group || next.name !== previous.name || JSON.stringify(next.orders) !== JSON.stringify(previous.orders)) {
          await ctx.db.patch(previous._id, next);
        }
        target.delete(previous.id);
      }
    }
    for (const next of target.values()) await ctx.db.insert('templates', { workspaceKey, ...next });
    return await bumpRevision(ctx, workspaceKey);
  },
});
