import { filterTemplates, templateTitle } from '../lib/templates';
import { formValuesKey } from './form-values';
import { useEffect, useState } from 'react';
import type { Template, TreatmentOrders, TreatmentOrdersV1, DrugName } from '../types';
import { ordersDocument, ordersText } from '../lib/treatment-orders';
import { OrdersEditor } from '../components/treatment-orders/orders-editor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field';
import { Dialog, DialogContent } from '../components/ui/dialog';

export type SaveTemplateDraft = { kind: 'progress' | 'orders'; text: string; orders?: TreatmentOrders };

export function OrderTemplateEditor({ initial, drugNames = [], onSave, onCancel, onDirtyChange }: {
  initial?: Partial<Template>; drugNames?: readonly DrugName[];
  onSave: (template: Template) => void; onCancel: () => void; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [group, setGroup] = useState(initial?.group ?? '');
  const [orders, setOrders] = useState<TreatmentOrdersV1>(() => structuredClone(ordersDocument(initial?.orders ?? initial?.text ?? '')));
  const dirty = name !== (initial?.name ?? '') || group !== (initial?.group ?? '')
    || formValuesKey(orders) !== formValuesKey(ordersDocument(initial?.orders ?? initial?.text ?? ''));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
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
  const matches = filterTemplates(templates, 'orders', query);
  return <div className="flex flex-col gap-4">
    <Input aria-label="Tìm mẫu chỉ định" placeholder="Tìm theo tên mẫu, nhóm bệnh…" value={query} onChange={e => setQuery(e.target.value)} />
    {!matches.length && <p className="text-sm text-muted-foreground">Chưa có mẫu phù hợp.</p>}
    {matches.map(t => <div className="rounded-lg border p-3 flex flex-col gap-2" key={t.id}>
      <strong>{templateTitle(t)}</strong><span className="text-sm text-muted-foreground">{t.group}{!t.orders ? ' · Mẫu văn bản cũ' : ''}</span>
      <details><summary className="cursor-pointer text-sm">Xem nội dung</summary><p className="whitespace-pre-wrap text-sm mt-2">{t.orders ? ordersText(t.orders) : t.text}</p></details>
      <div className="flex justify-end gap-2">{onEdit && <Button variant="outline" size="sm" onClick={() => onEdit(t)}>Sửa</Button>}{onDelete && <Button variant="ghost" size="sm" onClick={() => onDelete(t)}>Xóa mẫu</Button>}{onSelect && <Button size="sm" onClick={() => onSelect(t)}>Thêm vào cuối</Button>}</div>
    </div>)}
  </div>;
}

export function OrderTemplatePicker({ templates, onSelect }: { templates: Template[]; onSelect: (template: Template) => void }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Chọn mẫu chỉ định</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent title="Chọn mẫu chỉ định" description="Xem nội dung trước khi thêm vào cuối. Số thứ tự của các dòng mới sẽ để trống."><OrderTemplateList templates={templates} onSelect={t => { onSelect(t); setOpen(false); }} /></DialogContent></Dialog></>;
}
