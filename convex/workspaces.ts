import { checkedWorkspaceSettings, defaultWorkspaceSettings } from '../src/services/workspaces/settings';
import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { bumpRevision, findWorkspace, checkedWorkspaceKey, SHARED_WORKSPACE } from './access';
import { record, template } from './validators';
import { checkedWorkspaceSlug, withWorkspaceSlugs, checkedWorkspaceName, workspaceNameKey, workspaceLabel, SHARED_WORKSPACE as shared } from '../src/services/workspaces/model';

export const exists = query({
  args: { workspaceKey: v.string() },
  handler: async (ctx, { workspaceKey }) => !!await findWorkspace(ctx, workspaceKey),
});

/** Atomic, idempotent migration. Never overwrites a workspace already on Convex. */
export const initialize = mutation({
  args: { workspaceKey: v.string(), records: v.array(record), templates: v.array(template) },
  handler: async (ctx, { workspaceKey, records, templates }) => {
    workspaceKey = checkedWorkspaceKey(workspaceKey);
    if (await findWorkspace(ctx, workspaceKey)) return null;
    if (workspaceKey !== SHARED_WORKSPACE) throw new ConvexError('Không tìm thấy Khoa. Hãy chọn lại Khoa.');
    if (records.some(item => !(item.forms?.treatment.rows ?? item.rows)?.length)
      || new Set(records.map(item => item.id)).size !== records.length
      || new Set(templates.map(item => item.id)).size !== templates.length) {
      throw new ConvexError('Dữ liệu chuyển lên không hợp lệ');
    }
    await ctx.db.insert('workspaces', { key: workspaceKey, revision: 0 });
    for (const item of records) await ctx.db.insert('treatmentRecords', { workspaceKey, ...item });
    for (const item of templates) await ctx.db.insert('templates', { workspaceKey, ...item });
    return null;
  },
});

/** All devices in the selected department read the same data. */
export const snapshot = query({
  args: { workspaceKey: v.string() },
  handler: async (ctx, { workspaceKey }) => {
    const workspace = await findWorkspace(ctx, workspaceKey);
    if (!workspace) throw new ConvexError('Chưa khởi tạo dữ liệu chung');
    const records = await ctx.db.query('treatmentRecords').withIndex('by_workspace', q => q.eq('workspaceKey', checkedWorkspaceKey(workspaceKey))).collect();
    const templates = await ctx.db.query('templates').withIndex('by_workspace', q => q.eq('workspaceKey', checkedWorkspaceKey(workspaceKey))).collect();
    return {
      revision: workspace.revision ?? 0,
      records: records.map(({ _id, _creationTime, workspaceKey, ...data }) => data),
      templates: templates.map(({ _id, _creationTime, workspaceKey: _workspaceKey, ...item }) => item),
    };
  },
});

/** Admin-only, idempotent consolidation. No records or templates are deleted. */
export const shareExisting = internalMutation({
  args: {},
  handler: async ctx => {
    if (!await findWorkspace(ctx, SHARED_WORKSPACE)) await ctx.db.insert('workspaces', { key: SHARED_WORKSPACE, revision: 0 });
    const legacy = new Set((await ctx.db.query('workspaces').collect()).filter(item => !item.name && item.key !== SHARED_WORKSPACE).map(item => item.key));
    const records = await ctx.db.query('treatmentRecords').collect();
    const ids = new Set(records.filter(item => item.workspaceKey === SHARED_WORKSPACE).map(item => item.id));
    let movedRecords = 0;
    for (const item of records) {
      if (!legacy.has(item.workspaceKey)) continue;
      const id = ids.has(item.id) ? `${item.id}-${item._id}` : item.id;
      ids.add(id);
      await ctx.db.patch(item._id, { workspaceKey: SHARED_WORKSPACE, id });
      movedRecords++;
    }
    const templates = await ctx.db.query('templates').collect();
    const shared = templates.filter(item => item.workspaceKey === SHARED_WORKSPACE);
    const templateIds = new Set(shared.map(item => item.id));
    const contents = new Set(shared.map(item => JSON.stringify([item.kind, item.text, item.group])));
    let movedTemplates = 0;
    for (const item of templates) {
      const signature = JSON.stringify([item.kind, item.text, item.group]);
      if (!legacy.has(item.workspaceKey) || contents.has(signature)) continue;
      const id = templateIds.has(item.id) ? `${item.id}-${item._id}` : item.id;
      await ctx.db.patch(item._id, { workspaceKey: SHARED_WORKSPACE, id });
      templateIds.add(id); contents.add(signature); movedTemplates++;
    }
    await bumpRevision(ctx, SHARED_WORKSPACE);
    return { movedRecords, movedTemplates };
  },
});

/** The legacy shared dataset stays available without moving any records. */
export const list = query({
  args: {},
  handler: async ctx => {
    const items = await ctx.db.query('workspaces').collect();
    return withWorkspaceSlugs([shared, ...items.filter(item => item.key !== SHARED_WORKSPACE)
      .map(item => ({ key: item.key, name: workspaceLabel(item.key, item.name), ...(item.slug ? {slug:item.slug} : {}) }))]);
  },
});

export const create = mutation({
  args: { workspaceKey: v.string(), name: v.string() },
  handler: async (ctx, { workspaceKey, name: value }) => {
    checkedWorkspaceKey(workspaceKey);
    const name = checkedWorkspaceName(value);
    const nameKey = workspaceNameKey(name);
    const items = await ctx.db.query('workspaces').collect();
    if (workspaceKey === SHARED_WORKSPACE || items.some(item => item.key === workspaceKey)) {
      throw new ConvexError('Mã Khoa đã tồn tại.');
    }
    if (nameKey === workspaceNameKey(shared.name) || items.some(item => workspaceNameKey(workspaceLabel(item.key, item.name)) === nameKey)) {
      throw new ConvexError('Tên Khoa đã tồn tại. Hãy chọn Khoa trong danh sách.');
    }
    const next = withWorkspaceSlugs([shared, ...items.map(item => ({key:item.key,name:workspaceLabel(item.key,item.name),slug:item.slug})).filter(item=>item.key!==SHARED_WORKSPACE), {key:workspaceKey,name}]).at(-1)!;
    await ctx.db.insert('workspaces', { ...next, revision: 0 });
    return next;
  },
});

export const settings = query({
  args: { workspaceKey: v.string() },
  handler: async (ctx, { workspaceKey }) => {
    const item = await findWorkspace(ctx, workspaceKey);
    if (!item && workspaceKey !== SHARED_WORKSPACE) throw new ConvexError('Không tìm thấy Khoa.');
    return { revision: item?.settingsRevision ?? 0, value: item?.settings ?? defaultWorkspaceSettings() };
  },
});
export const saveSettings = mutation({
  args: { workspaceKey: v.string(), revision: v.number(), value: v.object({ department: v.string(), rooms: v.array(v.string()), beds: v.array(v.string()) }) },
  handler: async (ctx, { workspaceKey, revision, value }) => {
    const item = await findWorkspace(ctx, workspaceKey);
    if (!item && workspaceKey !== SHARED_WORKSPACE) throw new ConvexError('Không tìm thấy Khoa.');
    if ((item?.settingsRevision ?? 0) !== revision) throw new ConvexError('Cấu hình đã thay đổi. Tải lại trước khi lưu.');
    const clean = checkedWorkspaceSettings(value);
    if (item) await ctx.db.patch(item._id, { settings: clean, settingsRevision: revision + 1 });
    else await ctx.db.insert('workspaces', { key: workspaceKey, revision: 0, settings: clean, settingsRevision: revision + 1 });
    return { revision: revision + 1, value: clean };
  },
});

/** Maintenance: remove unnamed legacy scopes only when they have no records or configuration. */
export const cleanupUnnamed = internalMutation({
  args: { apply: v.boolean() },
  handler: async (ctx, { apply }) => {
    const items = (await ctx.db.query('workspaces').collect())
      .filter(item => item.key !== SHARED_WORKSPACE && !item.name?.trim());
    const result = [];
    for (const item of items) {
      const records = await ctx.db.query('treatmentRecords').withIndex('by_workspace', q => q.eq('workspaceKey', item.key)).collect();
      const templates = await ctx.db.query('templates').withIndex('by_workspace', q => q.eq('workspaceKey', item.key)).collect();
      const care = await ctx.db.query('careDefaults').withIndex('by_workspace', q => q.eq('workspaceKey', item.key)).collect();
      const empty = records.length === 0 && care.length === 0 && !item.settings;
      if (apply && empty) {
        for (const template of templates) await ctx.db.delete(template._id);
        await ctx.db.delete(item._id);
      }
      result.push({ key: item.key, records: records.length, templates: templates.length, care: care.length, hasSettings: !!item.settings, deleted: apply && empty });
    }
    return result;
  },
});

export const rename = mutation({
  args: { workspaceKey: v.string(), name: v.string(), expectedName: v.string() },
  handler: async (ctx, { workspaceKey, name: value, expectedName }) => {
    if (workspaceKey === SHARED_WORKSPACE) throw new ConvexError('Không thể đổi tên Dữ liệu chung.');
    const item = await findWorkspace(ctx, workspaceKey);
    if (!item) throw new ConvexError('Không tìm thấy Khoa.');
    if (workspaceLabel(item.key, item.name) !== expectedName) throw new ConvexError('Tên Khoa đã thay đổi. Hãy tải lại trang.');
    const name = checkedWorkspaceName(value);
    const items = await ctx.db.query('workspaces').collect();
    if (workspaceNameKey(name) === workspaceNameKey(shared.name) || items.some(other => other.key !== workspaceKey && workspaceNameKey(workspaceLabel(other.key, other.name)) === workspaceNameKey(name))) throw new ConvexError('Tên Khoa đã tồn tại.');
    await ctx.db.patch(item._id, { name });
    return { key: workspaceKey, name, slug: item.slug };
  },
});

export const backfillSlugs = internalMutation({
  args: {},
  handler: async ctx => {
    const items = await ctx.db.query('workspaces').collect();
    const resolved = withWorkspaceSlugs([shared, ...items.filter(item => item.key !== SHARED_WORKSPACE).map(item => ({key:item.key,name:workspaceLabel(item.key,item.name),slug:item.slug}))]);
    let updated = 0;
    for (const item of items) {
      const slug = resolved.find(other => other.key === item.key)!.slug;
      if (item.slug !== slug) { await ctx.db.patch(item._id, {slug}); updated++; }
    }
    return {updated};
  },
});
export const changeSlug = mutation({
  args: {workspaceKey:v.string(),slug:v.string(),expectedSlug:v.string()},
  handler: async (ctx, {workspaceKey,slug:value,expectedSlug}) => {
    if (workspaceKey === SHARED_WORKSPACE) throw new ConvexError('Slug Dữ liệu chung được giữ cố định.');
    const item = await findWorkspace(ctx,workspaceKey);
    if (!item) throw new ConvexError('Không tìm thấy Khoa.');
    if (item.slug !== expectedSlug) throw new ConvexError('Slug đã thay đổi. Hãy tải lại cấu hình.');
    const slug = checkedWorkspaceSlug(value);
    const items = await ctx.db.query('workspaces').collect();
    const resolved = withWorkspaceSlugs([shared,...items.filter(other=>other.key!==SHARED_WORKSPACE).map(other=>({key:other.key,name:workspaceLabel(other.key,other.name),slug:other.slug}))]);
    if (resolved.some(other=>other.key!==workspaceKey && other.slug===slug)) throw new ConvexError('Slug đã được Khoa khác sử dụng.');
    await ctx.db.patch(item._id,{slug});
    return {key:workspaceKey,name:workspaceLabel(item.key,item.name),slug};
  },
});
