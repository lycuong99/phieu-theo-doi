import { useId, useState } from 'react';
import { useController } from 'react-hook-form';
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import type { DrugName, MedicationOrder, OrderRelation, TreatmentOrder, TreatmentOrders, TreatmentOrdersV1 } from '@/types';
import { leadingOrderSequence, makeMedicationOrder, makeOrderRelation, makeTextOrder, medicationDetails, orderHeading, ordersDocument, ordersText } from '@/lib/treatment-orders';
import { patchFormValue } from '@/forms/form-values';
import { useSynchronizedForm } from '@/forms/use-synchronized-form';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { DrugNameInput } from './drug-name-input';

export type OrdersEditorProps = {
  value: TreatmentOrders;
  onChange: (value: TreatmentOrdersV1) => void;
  drugNames?: readonly DrugName[];
  label?: string;
};

/** Controlled clinical editor. Persistence, scope, and conflict resolution belong to the caller. */
export function OrdersEditor({ value, onChange, drugNames = [], label = 'Chỉ định' }: OrdersEditorProps) {
  const document = ordersDocument(value);
  const editor = useSynchronizedForm({ items: document.items }, (name, value) => {
    onChange({ version: 1, ...patchFormValue<{ items: TreatmentOrder[] }, typeof name>({ items: document.items }, name, value) });
  });
  const { field } = useController({ control: editor.form.control, name: 'items' });
  const [selected, setSelected] = useState<string | null>(null);
  const items = field.value;
  const publish = (next: TreatmentOrder[]) => editor.change('items', next);
  const updateItem = (item: TreatmentOrder) => publish(editor.form.getValues('items').map(old => old.id === item.id ? item : old));
  const add = (kind: TreatmentOrder['kind']) => {
    const item = kind === 'medication' ? makeMedicationOrder() : makeTextOrder();
    publish([...editor.form.getValues('items'), item]);
    setSelected(item.id);
  };
  const remove = (id: string) => { publish(editor.form.getValues('items').filter(item => item.id !== id)); setSelected(current => current === id ? null : current); };
  const move = (id: string, offset: number) => {
    const next = [...editor.form.getValues('items')];
    const index = next.findIndex(item => item.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    publish(next);
  };
  return <div className="treatment-orders" aria-label={label} onBlur={field.onBlur}>
    <div className="orders-lines">
      {items.length > 0 && <div className="orders-list-heading" aria-hidden="true"><span>STT</span><span>Nội dung chỉ định</span><span /></div>}
      {items.map((item, index) => <div className="orders-entry" key={item.id}>
        <OrderSequenceField value={item.sequence ?? ''} position={index + 1} onChange={sequence => updateItem({ ...item, sequence })} />
        <div className="orders-entry-content">{selected === item.id ? <div className="orders-edit-panel">
          <div className="orders-edit-heading"><strong>{item.kind === 'medication' ? 'Thuốc' : 'Chỉ định khác'}</strong><div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label="Di chuyển chỉ định lên" disabled={index === 0} onClick={() => move(item.id, -1)}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Di chuyển chỉ định xuống" disabled={index === items.length - 1} onClick={() => move(item.id, 1)}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Thu gọn chỉ định" onClick={() => setSelected(null)}><X /></Button>
          </div></div>
          {item.kind === 'medication' ? <MedicationFields value={item} onChange={updateItem} drugNames={drugNames} />
            : <TextOrderField value={item.text} onChange={text => updateItem({ ...item, text })} />}
          <div className="orders-edit-actions">
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(item.id)}><Trash2 data-icon="inline-start" />Xóa dòng</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(null)}><Check data-icon="inline-start" />Xong</Button>
          </div>
        </div> : <button type="button" className="orders-line-button" onClick={() => setSelected(item.id)} aria-label={`Sửa chỉ định ${index + 1}: ${orderHeading(item) || 'Chưa nhập nội dung'}`}>
          <span>{orderHeading({ ...item, sequence: undefined }) || (item.kind === 'medication' ? 'Thuốc mới — bấm để nhập' : 'Chỉ định mới — bấm để nhập')}</span>
          {item.kind === 'medication' && medicationDetails(item).length > 0 && <span className="orders-relations">{medicationDetails(item).map((text, detailIndex) => <span key={detailIndex}>{text}</span>)}</span>}
        </button>}</div>
        <Button type="button" variant="ghost" size="icon" className="orders-quick-delete"
          aria-label={`Xóa dòng chỉ định ${index + 1}`} title="Xóa dòng" onClick={() => remove(item.id)}><Trash2 /></Button>
      </div>)}
      <div className="orders-add-actions">
        <Button type="button" variant="ghost" size="sm" onClick={() => add('medication')}><Plus data-icon="inline-start" />Thêm thuốc</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => add('text')}><Plus data-icon="inline-start" />Chỉ định khác</Button>
      </div>
    </div>
    <div className="daily-column-footer"><span>{ordersText({ version: 1, items }).length} ký tự</span><span>Bấm vào dòng để sửa</span></div>
  </div>;
}

/** Row metadata stays visible independently of the clinical content editor. */
function OrderSequenceField({ value, position, onChange }: { value: string; position: number; onChange: (value: string) => void }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" className="orders-sequence-button"
    aria-label={`Sửa số thứ tự dòng ${position}${value.trim() ? `: ${value.trim()}` : ': chưa có số'}`}
    title="Bấm để sửa số thứ tự" onClick={() => setEditing(true)}>{value.trim() || '—'}</button>;
  return <Field className="orders-sequence-field">
    <FieldLabel className="sr-only" htmlFor={id}>Số thứ tự dòng {position}</FieldLabel>
    <Input density="compact" id={id} aria-label={`Số thứ tự dòng ${position}`} value={value}
      autoFocus onFocus={event => event.currentTarget.select()} onChange={event => onChange(event.target.value)}
      onBlur={() => setEditing(false)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); setEditing(false); }
      }} placeholder="—" autoComplete="off" />
  </Field>;
}

function TextOrderField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const id = useId();
  return <FieldGroup><Field><FieldLabel density="compact" htmlFor={id}>Nội dung</FieldLabel><Textarea density="compact" id={id} value={value} onChange={event => onChange(event.target.value)} rows={4} placeholder="Nhập chỉ định…" /></Field></FieldGroup>;
}

function TextField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (text: string) => void; placeholder?: string }) {
  const id = useId();
  return <Field><FieldLabel density="compact" htmlFor={id}>{label}</FieldLabel><Input density="compact" id={id} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></Field>;
}
function ChoiceField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (text: string) => void }) {
  const id = useId();
  const choices = [...new Set(['', ...options, ...(value ? [value] : [])])];
  return <Field><FieldLabel density="compact" htmlFor={id}>{label}</FieldLabel><NativeSelect size="sm" id={id} value={value} onChange={event => onChange(event.target.value)}>
    {choices.map(choice => <NativeSelectOption key={choice} value={choice}>{choice || 'Chưa chọn'}</NativeSelectOption>)}
  </NativeSelect></Field>;
}

function MedicationFields({ value, onChange, drugNames }: { value: MedicationOrder; onChange: (item: MedicationOrder) => void; drugNames: readonly DrugName[] }) {
  const nameId = useId();
  const suggestion = leadingOrderSequence(value.name);
  const [showMarker, setShowMarker] = useState(false);
  const patch = (change: Partial<MedicationOrder>) => onChange({ ...value, ...change });
  const updateRelation = (relation: OrderRelation) => patch({ relations: value.relations.map(old => old.id === relation.id ? relation : old) });
  return <div className="orders-medication-fields">
    <FieldGroup className="orders-identity-fields">
      <Field><FieldLabel density="compact" htmlFor={nameId}>Tên thuốc</FieldLabel><DrugNameInput id={nameId} names={drugNames} value={value.name} onChange={name => patch({ name })} /><p className="text-xs text-muted-foreground">Chỉ nhập tên thuốc, không nhập số thứ tự</p>
      {suggestion && <Button type="button" variant="outline" size="sm" onClick={() => patch(suggestion)}>Chuyển sang ô số thứ tự{value.sequence ? ` (thay ${value.sequence})` : ''}</Button>}</Field>
      <TextField label="Hàm lượng" value={value.strength} onChange={strength => patch({ strength })} placeholder="VD: 10 mg" />
    </FieldGroup>
    <FieldGroup className="orders-dose-fields">
      <TextField label="Liều" value={value.dose} onChange={dose => patch({ dose })} placeholder="VD: 1 hoặc ½" />
      <ChoiceField label="Đơn vị" value={value.unit} options={['viên', 'lọ', 'chai', 'ống', 'gói', 'mL', 'mg', 'g', 'giọt', 'đơn vị']} onChange={unit => patch({ unit })} />
      <TextField label="Số lần (×)" value={value.repeat} onChange={repeat => patch({ repeat })} placeholder="VD: 4" />
      <ChoiceField label="Đường dùng" value={value.route} options={['Uống', 'TTM', 'TMC', 'Tiêm bắp', 'Tiêm dưới da', 'Khí dung', 'Bôi ngoài da', 'Khác']} onChange={route => patch({ route })} />
      <TextField label="Giờ / lịch dùng" value={value.timing} onChange={timing => patch({ timing })} placeholder="VD: mỗi 6h từ 8h14" />
    </FieldGroup>
    {(['TTM', 'Truyền TM'].includes(value.route) || value.rate.value) && <FieldGroup className="orders-rate-fields">
      <TextField label="Tốc độ truyền" value={value.rate.value} onChange={rate => patch({ rate: { ...value.rate, value: rate } })} placeholder="Nhập theo chỉ định" />
      <ChoiceField label="Đơn vị tốc độ" value={value.rate.unit} options={['giọt/phút', 'mL/giờ']} onChange={unit => patch({ rate: { ...value.rate, unit } })} />
    </FieldGroup>}
    <div><Button type="button" size="sm" variant="ghost" aria-expanded={showMarker} onClick={() => setShowMarker(!showMarker)}><ChevronDown data-icon="inline-start" />Ký hiệu trên phiếu{!showMarker && value.marker ? `: ${value.marker}` : ''}</Button>
      {showMarker && <FieldGroup><TextField label="Ký hiệu" value={value.marker} onChange={marker => patch({ marker })} placeholder="VD: (TT)" /></FieldGroup>}
    </div>
    {value.relations.map(relation => <div className="orders-relation-edit" key={relation.id}>
      {relation.kind === 'mix' ? <FieldGroup className="orders-mix-fields">
        <TextField label="Pha với" value={relation.name} onChange={name => updateRelation({ ...relation, name })} placeholder="Tên dung môi / thuốc" />
        <TextField label="Lượng" value={relation.amount} onChange={amount => updateRelation({ ...relation, amount })} />
        <ChoiceField label="Đơn vị" value={relation.unit} options={['mL', 'lọ', 'chai', 'ống', 'mg', 'g', 'đơn vị']} onChange={unit => updateRelation({ ...relation, unit })} />
      </FieldGroup> : <FieldGroup><TextField label="Ghi chú" value={relation.text} onChange={text => updateRelation({ ...relation, text })} placeholder="Nội dung bổ sung…" /></FieldGroup>}
      <Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${relation.kind === 'mix' ? 'dòng pha với' : 'ghi chú'}`} onClick={() => patch({ relations: value.relations.filter(old => old.id !== relation.id) })}><X /></Button>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={() => patch({ relations: [...value.relations, makeOrderRelation('mix')] })}><Plus data-icon="inline-start" />Pha với</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => patch({ relations: [...value.relations, makeOrderRelation('note')] })}><Plus data-icon="inline-start" />Ghi chú</Button>
    </div>
  </div>;
}
