import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FileText, Plus, Search, Trash2, Pencil } from 'lucide-react';
import type { Template, TemplateKind } from '../types';
import { filterTemplates, templateTitle } from '../lib/templates';
import { ordersText } from '../lib/treatment-orders';
import { formValuesKey } from './form-values';
import { OrderTemplateEditor } from './order-templates';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field';
import { NativeSelect, NativeSelectOption } from '../components/ui/native-select';
import { Dialog, DialogContent } from '../components/ui/dialog';
import './template-library-page.css';

type Props = {
  active: boolean; templates: Template[]; saved: boolean; busy: boolean;
  error: string; conflict: boolean; onRetry: () => void;
  onResolveConflict: (keepDraft: boolean) => void;
  onChange: (update: (current: Template[]) => Template[]) => void;
  onBack: () => void;
  registerLeaveGuard: (guard: () => Promise<boolean>) => () => void;
};

/** Management module: selection, filtering and edit drafts stay local to this interface. */
export function TemplateLibraryPage({ active, templates, saved, busy, error, conflict, onRetry, onResolveConflict, onChange, onBack, registerLeaveGuard }: Props) {
  const [kind, setKind] = useState<TemplateKind>('orders');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<Template | null>(null);
  const matches = filterTemplates(templates, kind, query, group);
  const selected = matches.find(t => t.id === selectedId) ?? matches[0];
  const groups = [...new Set(templates.filter(t => t.kind === kind).map(t => t.group))].sort((a,b) => a.localeCompare(b, 'vi'));
  const changedElsewhere = !!editing?.id && formValuesKey(templates.find(t => t.id === editing.id)) !== formValuesKey(editing);
  useEffect(() => {
    if (!active && !dirty) setEditing(null);
  }, [active, dirty]);
  useEffect(() => registerLeaveGuard(async () => {
    if (!dirty) return true;
    setMessage('Mẫu đang có thay đổi. Hãy lưu mẫu hoặc hủy sửa trước khi chuyển trang.');
    return false;
  }), [dirty, registerLeaveGuard]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const closeEditor = () => { setEditing(null); setDirty(false); setMessage(''); };
  const save = (template: Template) => {
    if (changedElsewhere || busy || conflict) { setMessage('Mẫu đã thay đổi ở nơi khác. Hãy hủy sửa và mở lại bản mới.'); return; }
    onChange(current => current.some(t => t.id === template.id) ? current.map(t => t.id === template.id ? template : t) : [...current, template]);
    setSelectedId(template.id); setQuery(''); setGroup(''); closeEditor();
  };
  return <div className="main-shell template-library-page" hidden={!active}>
    <header className="topbar"><div className="breadcrumb">Thư viện <span>/</span><strong>Thư viện mẫu</strong></div><span className="text-xs text-muted-foreground" role="status">{error ? 'Chưa lưu được' : saved ? 'Đã lưu thư viện' : 'Đang lưu…'}</span></header>
    <main>
      <div className="template-library-heading"><div><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft data-icon="inline-start" />Về đợt điều trị</Button><h1>Thư viện mẫu</h1><p>Nội dung dùng lại cho các đợt điều trị trong Khoa.</p></div><Button disabled={busy || !!editing} onClick={() => { setEditing({ kind }); setMessage(''); }}><Plus data-icon="inline-start" />{kind === 'orders' ? 'Tạo mẫu chỉ định' : 'Tạo mẫu diễn biến'}</Button></div>
      {error && <div role="alert" className="episode-action-error">{error}<Button variant="outline" size="sm" onClick={onRetry}>Thử lưu lại</Button>{conflict && <><Button variant="outline" size="sm" onClick={() => onResolveConflict(false)}>Dùng bản mới</Button><Button variant="outline" size="sm" onClick={() => onResolveConflict(true)}>Giữ bản nháp</Button></>}</div>}
      {message && <p role="alert" className="template-library-message">{message}</p>}
      <div className="library-tabs" role="group" aria-label="Loại mẫu">
        {(['orders', 'progress'] as const).map(value => <button aria-pressed={kind === value} disabled={!!editing} key={value} className={kind === value ? 'selected' : ''} onClick={() => { setKind(value); setGroup(''); setSelectedId(''); }}>
          {value === 'orders' ? 'Mẫu chỉ định' : 'Diễn biến bệnh'}<span>{templates.filter(t => t.kind === value).length}</span>
        </button>)}
      </div>
      <div className="template-library-layout">
        <aside className="template-library-browser" aria-label="Danh sách mẫu" inert={!!editing}>
          <div className="template-library-filters"><div className="template-library-search"><Search size={16} aria-hidden="true"/><Input aria-label="Tìm mẫu" placeholder="Tìm tên, nhóm, nội dung…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <NativeSelect aria-label="Lọc nhóm mẫu" value={group} onChange={e => setGroup(e.target.value)}><NativeSelectOption value="">Tất cả nhóm</NativeSelectOption>{groups.map(g => <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>)}</NativeSelect>
            <p className="text-xs text-muted-foreground">{matches.length} mẫu</p>
          </div>
          <div className="template-library-list">{matches.map(t => <button type="button" className="template-library-row" key={t.id} aria-pressed={t.id === selected?.id} onClick={() => setSelectedId(t.id)}><strong>{templateTitle(t)}</strong><span>{t.group || 'Chưa phân nhóm'}</span><p>{t.text.slice(0, 130)}</p>{t.kind === 'orders' && !t.orders && <small>Mẫu văn bản cũ</small>}</button>)}
          {!matches.length && <div className="template-library-empty"><Search size={24}/><strong>{query || group ? 'Không tìm thấy mẫu' : 'Chưa có mẫu'}</strong><p>{query || group ? 'Thử từ khóa hoặc nhóm khác.' : 'Tạo mẫu đầu tiên để dùng lại khi nhập phiếu.'}</p>{(query || group) && <Button variant="ghost" onClick={() => { setQuery(''); setGroup(''); }}>Xóa bộ lọc</Button>}</div>}</div>
        </aside>
        <section className="template-library-detail" aria-label={editing ? 'Chỉnh sửa mẫu' : 'Nội dung mẫu'}>
          {editing ? <><div className="template-library-detail-heading"><div><span className="text-sm text-muted-foreground">{editing.id ? 'Chỉnh sửa mẫu' : 'Mẫu mới'}</span><h2>{editing.name || (kind === 'orders' ? 'Bộ chỉ định' : 'Diễn biến bệnh')}</h2></div></div>
            {changedElsewhere && <p role="alert" className="template-library-message">Mẫu gốc đã thay đổi hoặc bị xóa. Hủy sửa để xem bản mới; nội dung đang nhập vẫn được giữ lại.</p>}
            <fieldset disabled={busy || changedElsewhere || conflict}>
              {kind === 'orders' ? <OrderTemplateEditor key={editing.id ?? 'new-order'} initial={editing} onDirtyChange={setDirty} onSave={save} onCancel={closeEditor}/> : <ProgressTemplateEditor key={editing.id ?? 'new-progress'} initial={editing} onDirtyChange={setDirty} onSave={save} onCancel={closeEditor}/>}
            </fieldset>{(changedElsewhere || conflict) && <Button variant="outline" onClick={closeEditor}>Hủy sửa</Button>}
          </> : selected ? <><div className="template-library-detail-heading"><div><span className="text-sm text-muted-foreground">{selected.group}</span><h2>{templateTitle(selected)}</h2></div><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Xóa mẫu đang chọn" disabled={busy} onClick={() => setDeleting(selected)}><Trash2 /></Button><Button variant="outline" disabled={busy} onClick={() => setEditing(structuredClone(selected))}><Pencil data-icon="inline-start" />Sửa mẫu</Button></div></div>
            {selected.kind === 'orders' && !selected.orders && <p className="template-library-legacy">Mẫu văn bản cũ · Nội dung được giữ nguyên.</p>}
            {selected.orders ? <ol className="template-library-order-preview">{selected.orders.items.map(item => <li key={item.id}><FileText size={16} aria-hidden="true"/><p>{ordersText({ version: 1, items: [item] }) || 'Dòng chưa nhập nội dung'}</p></li>)}</ol> : <p className="template-library-text-preview">{selected.text}</p>}
          </> : <div className="template-library-empty"><BookOpen size={32}/><h2>Chọn một mẫu để xem</h2><p>Xem nội dung đầy đủ trước khi chỉnh sửa.</p></div>}
        </section>
      </div>
    </main>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}><DialogContent title="Xóa mẫu?" description={`Mẫu “${deleting ? templateTitle(deleting) : ''}” sẽ được xóa khỏi thư viện. Nội dung đã dùng trong phiếu vẫn được giữ nguyên.`}><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Giữ lại</Button><Button disabled={busy} onClick={() => { if (deleting) onChange(current => current.filter(t => t.id !== deleting.id)); setDeleting(null); }}>Xóa mẫu</Button></div></DialogContent></Dialog>
  </div>;
}

function ProgressTemplateEditor({ initial, onSave, onCancel, onDirtyChange }: { initial: Partial<Template>; onSave: (template: Template) => void; onCancel: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [text, setText] = useState(initial.text ?? '');
  const [group, setGroup] = useState(initial.group ?? '');
  const dirty = text !== (initial.text ?? '') || group !== (initial.group ?? '');
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  return <div className="flex flex-col gap-4"><FieldGroup><Field><FieldLabel htmlFor="progress-template-group">Nhóm mẫu</FieldLabel><Input id="progress-template-group" value={group} onChange={e => setGroup(e.target.value)} placeholder="Ví dụ: Toàn trạng"/></Field><Field><FieldLabel htmlFor="progress-template-text">Nội dung diễn biến</FieldLabel><Textarea id="progress-template-text" rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="Nhập nội dung muốn dùng lại…"/></Field></FieldGroup><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Hủy</Button><Button disabled={!text.trim()} onClick={() => onSave({ id: initial.id ?? crypto.randomUUID(), kind: 'progress', text: text.trim(), group: group.trim() || 'Mẫu của tôi' })}>Lưu mẫu diễn biến</Button></div></div>;
}
