import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Template, TreatmentOrders, TreatmentOrdersV1, DrugName } from '../types';
import { ordersDocument, ordersText } from '../lib/treatment-orders';
import { OrdersEditor } from '../components/treatment-orders/orders-editor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field';
import { Dialog, DialogContent } from '../components/ui/dialog';

export type SaveTemplateDraft = { kind: 'progress' | 'orders'; text: string; orders?: TreatmentOrders };

export function OrderTemplateEditor({ initial, drugNames = [], onSave, onCancel }: {
  initial?: Partial<Template>; drugNames?: readonly DrugName[];
  onSave: (template: Template) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [group, setGroup] = useState(initial?.group ?? '');
  const [orders, setOrders] = useState<TreatmentOrdersV1>(() => structuredClone(ordersDocument(initial?.orders ?? initial?.text ?? '')));
  const ready = !!name.trim() && !!group.trim() && !!ordersText(orders).trim();
  return <div className="flex flex-col gap-4">
    <FieldGroup>
      <Field><FieldLabel htmlFor="order-template-name">Tên mẫu</FieldLabel><Input id="order-template-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nhập tên bộ chỉ định" required /></Field>
      <Field><FieldLabel htmlFor="order-template-group">Nhóm bệnh</FieldLabel><Input id="order-template-group" value={group} onChange={e => setGroup(e.target.value)} placeholder="Nhập nhóm bệnh" required /></Field>
    </FieldGroup>
    <OrdersEditor value={orders} onChange={setOrders} drugNames={drugNames} label="Nội dung mẫu chỉ định" />
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Hủy</Button><Button disabled={!ready} onClick={() => onSave({ id: initial?.id ?? crypto.randomUUID(), kind: 'orders', name: name.trim(), group: group.trim(), text: ordersText(orders), orders })}>Lưu mẫu chỉ định</Button></div>
  </div>;
}

export function OrderTemplateList({ templates, onSelect, onEdit, onDelete }: {
  templates: readonly Template[]; onSelect?: (template: Template) => void;
  onEdit?: (template: Template) => void; onDelete?: (template: Template) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = templates.filter(t => t.kind === 'orders' && `${t.name ?? t.text} ${t.group}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  return <div className="flex flex-col gap-4">
    <Input aria-label="Tìm mẫu chỉ định" placeholder="Tìm theo tên mẫu, nhóm bệnh…" value={query} onChange={e => setQuery(e.target.value)} />
    {!matches.length && <p className="text-sm text-muted-foreground">Chưa có mẫu phù hợp.</p>}
    {matches.map(t => <div className="rounded-lg border p-3 flex flex-col gap-2" key={t.id}>
      <strong>{t.name ?? (t.text.split('\n')[0].slice(0, 100) || 'Mẫu văn bản cũ')}</strong><span className="text-sm text-muted-foreground">{t.group}{!t.orders ? ' · Mẫu văn bản cũ' : ''}</span>
      <details><summary className="cursor-pointer text-sm">Xem nội dung</summary><p className="whitespace-pre-wrap text-sm mt-2">{t.orders ? ordersText(t.orders) : t.text}</p></details>
      <div className="flex justify-end gap-2">{onEdit && <Button variant="outline" size="sm" onClick={() => onEdit(t)}>Sửa</Button>}{onDelete && <Button variant="ghost" size="sm" onClick={() => onDelete(t)}>Xóa mẫu</Button>}{onSelect && <Button size="sm" onClick={() => onSelect(t)}>Thêm vào cuối</Button>}</div>
    </div>)}
  </div>;
}

export function OrderTemplatePicker({ templates, onSelect }: { templates: Template[]; onSelect: (template: Template) => void }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Chọn mẫu chỉ định</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent title="Chọn mẫu chỉ định" description="Xem nội dung trước khi thêm vào cuối. Số thứ tự của các dòng mới sẽ để trống."><OrderTemplateList templates={templates} onSelect={t => { onSelect(t); setOpen(false); }} /></DialogContent></Dialog></>;
}

export function OrderTemplateLibrary({ templates, onChange, drugNames }: { templates: Template[]; onChange: Dispatch<SetStateAction<Template[]>>; drugNames?: readonly DrugName[] }) {
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  if (editing) return <OrderTemplateEditor initial={editing} drugNames={drugNames} onCancel={() => setEditing(null)} onSave={template => { onChange(current => current.some(t => t.id === template.id) ? current.map(t => t.id === template.id ? template : t) : [...current, template]); setEditing(null); }} />;
  return <div className="flex flex-col gap-4"><Button variant="outline" onClick={() => setEditing({})}>Tạo mẫu chỉ định</Button><OrderTemplateList templates={templates} onEdit={setEditing} onDelete={t => onChange(current => current.filter(item => item.id !== t.id))} /></div>;
}
