import { useState } from 'react';
import { BookOpen, CalendarDays, CircleHelp, FolderHeart, PanelLeft, Plus, Search, Settings2, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';
import type { TreatmentRecordSummary } from '../types';
import { searchEpisodes } from '../services/treatment-records/episodes';
import { formatDay } from '../lib/daily-records';
import './episode-sidebar.css';

type Props = {
  workspaceName: string; onWorkspaceChange: () => void;
  records: TreatmentRecordSummary[]; recordId: string | null; busy: boolean; saved: boolean;
  storageError: boolean; storage: 'local' | 'cloud'; actionError: string;
  query: string; filter: string; onQuery: (value: string) => void; onFilter: (value: string) => void;
  onSelect: (id: string) => Promise<boolean>;
  onNew: () => Promise<boolean>;
  onSettings: () => void; settingsActive: boolean;
  onDefaults: () => void; defaultsActive:boolean;
  libraryActive: boolean; onLibrary: () => void; onHelp: () => void;
};

export function EpisodeSidebar(props: Props) {
  const [drawer, setDrawer] = useState(false);
  const results = searchEpisodes(props.records, props.query, props.filter);
  const activeCount = props.records.filter(record => record.status === 'active').length;
  const openCreate = async () => {
    if (await props.onNew()) { props.onFilter('active'); props.onQuery(''); setDrawer(false); }
  };
  const content = (mobile = false) => <>
    <div className="episode-brand"><img className="episode-brand-mark" src="/noi-ho-hap-logo.png" alt="" width="32" height="36"/><div><strong>Nội Hô Hấp Bình Dương</strong><span>Phiếu theo dõi điều trị</span></div></div>
    <Button variant="outline" className="mx-2 mb-4 h-auto justify-between whitespace-normal py-2 text-left" disabled={props.busy} onClick={()=>{setDrawer(false);props.onWorkspaceChange()}} aria-label="Đổi Khoa">
      <span className="min-w-0 break-words">{props.workspaceName}</span><span>Đổi Khoa</span>
    </Button>
    <div className="episode-sidebar-heading"><h2>Đợt điều trị</h2><span>{activeCount} đang điều trị</span></div>
    <Button className="episode-create" onClick={openCreate} disabled={props.busy}><Plus size={16}/>Đợt mới</Button>
    <label className="episode-search"><Search size={16}/><input aria-label="Tìm đợt điều trị" placeholder="Tên, mã, số vào viện…" value={props.query} onChange={event => props.onQuery(event.target.value)}/></label>
    <div className="episode-filter"><label className="sr-only" htmlFor={mobile ? 'episode-filter-mobile' : 'episode-filter-desktop'}>Trạng thái đợt điều trị</label><select id={mobile ? 'episode-filter-mobile' : 'episode-filter-desktop'} value={props.filter} onChange={event => props.onFilter(event.target.value)}><option value="active">Đang điều trị</option><option value="completed">Đã kết thúc</option><option value="all">Tất cả đợt</option></select><span>{results.length} đợt</span></div>
    <nav className="episode-list" aria-label="Danh sách đợt điều trị" aria-busy={props.busy}>
      {results.map(record => <button key={record.id} className={`episode-item ${record.id === props.recordId ? 'is-current' : ''}`} aria-current={record.id === props.recordId ? 'page' : undefined} disabled={props.busy} onClick={async () => { if (await props.onSelect(record.id)) setDrawer(false); }}>
        <span className="episode-item-title"><strong>{record.patientName.trim() || 'Đợt chưa đặt tên'}</strong>{record.status === 'completed' && <span className="episode-completed-dot" title="Đã kết thúc"/>}</span>
        <span className="episode-item-code">{record.patientCode ? `Mã BN: ${record.patientCode}` : record.admission ? `Số vào viện: ${record.admission}` : 'Chưa có mã người bệnh'}</span>
        <span className="episode-item-date"><CalendarDays size={12}/>{record.startedOn ? formatDay(record.startedOn) : 'Chưa có ngày bắt đầu'}<span>{record.status === 'completed' ? 'Đã kết thúc' : 'Đang điều trị'}</span></span>
      </button>)}
      {!results.length && <div className="episode-empty"><FolderHeart size={25}/><strong>{props.query ? 'Không tìm thấy đợt phù hợp' : 'Chưa có đợt trong danh sách này'}</strong><p>{props.query ? 'Thử tên, mã người bệnh hoặc số vào viện khác.' : 'Đổi bộ lọc hoặc tạo một đợt điều trị mới.'}</p>{props.query && <button onClick={() => props.onQuery('')}>Xóa tìm kiếm</button>}</div>}
    </nav>
    <div className="episode-sidebar-footer"><button aria-current={props.settingsActive?'page':undefined} onClick={()=>{setDrawer(false);props.onSettings()}}><Settings2 size={16}/>Cấu hình Khoa</button><button aria-current={props.defaultsActive?'page':undefined} onClick={()=>{setDrawer(false);props.onDefaults()}}><Settings2 size={16}/>Mẫu chăm sóc</button><button aria-current={props.libraryActive?'page':undefined} onClick={() => { setDrawer(false); props.onLibrary(); }}><BookOpen size={16}/>Thư viện mẫu</button><button onClick={() => { setDrawer(false); props.onHelp(); }}><CircleHelp size={16}/>Cách sử dụng</button><div className={`episode-sync ${props.storageError ? 'has-error' : ''}`} role="status"><ShieldCheck size={15}/><span>{props.storageError ? 'Chưa lưu được nội dung' : props.saved && !props.recordId ? 'Mẫu trống, chưa tạo đợt' : props.saved ? (props.storage === 'cloud' ? 'Đã lưu trên Convex' : 'Đã lưu trên thiết bị') : 'Đang lưu nội dung…'}</span></div></div>
  </>;
  return <>
    <aside className="episode-sidebar no-print">{content()}</aside>
    <Button variant="outline" className="mobile-episode-trigger no-print" onClick={() => setDrawer(true)}><PanelLeft size={17}/><span className="max-w-40 truncate">{props.workspaceName}</span></Button>
    <Dialog open={drawer} onOpenChange={setDrawer}><DialogContent className="episode-drawer" title="Đợt điều trị" description="Chọn một đợt để tiếp tục nhập phiếu.">{content(true)}</DialogContent></Dialog>

  </>;
}
