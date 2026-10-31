import { TemplateLibraryPage } from './forms/template-library-page';
import { OrderTemplateEditor } from './forms/order-templates';
import type { SaveTemplateDraft } from './forms/order-templates';
import { ordersDocument } from './lib/treatment-orders';
import { WorkspaceSettingsPage } from './components/workspace-settings-page';
import type { WorkspaceSettings, WorkspaceSettingsSnapshot } from './types/workspace';
import { workspaces } from './services/treatment-records/provider';
import { WorkspaceBoundary } from './components/workspace-boundary';
import type { RegisterWorkspaceGuard } from './components/workspace-boundary';
import type { Workspace } from './types';
import { CareDefaultsPage } from './forms/care-defaults-page';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCareDefaults } from './services/treatment-records/use-care-defaults';
import { SaveTemplateEditor } from './forms/templates';
import { PatientForm } from './forms/patient';
import type { SetStateAction } from 'react';
import type { FormKind, Forms, Data, TemplateKind as Kind } from './types';
import { FormTabs, PatientReview } from './forms/shared';
import { TreatmentForm } from './forms/treatment';
import { InfusionForm } from './forms/infusion';
import { CareForm } from './forms/care';
import './forms/forms.css';
import { dayjs } from './lib/date';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, CheckCheck, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from './components/ui/button';
import { formatDay } from './lib/daily-records';
import './daily.css';
import { Dialog, DialogContent } from './components/ui/dialog';
import { EpisodeSidebar } from './components/episode-sidebar';
import { summarizeRecord } from './services/treatment-records/episodes';
import { recordInput } from './services/treatment-records/contracts';

import { parseData, useTreatmentData } from './services/treatment-records';


const uid=()=>crypto.randomUUID();
type EpisodeView={day:string;session:'morning'|'afternoon'};
export default function App(){
 return <WorkspaceBoundary>{(workspace,openPicker,registerGuard,onRenamed)=><DepartmentApp onRenamed={onRenamed} workspace={workspace} openPicker={openPicker} registerGuard={registerGuard}/>}</WorkspaceBoundary>;
}
function DepartmentApp(props:{onRenamed:(workspace:Workspace)=>void;workspace:Workspace;openPicker:()=>void;registerGuard:RegisterWorkspaceGuard}){
 const [settings,setSettings]=useState<WorkspaceSettingsSnapshot|null>(null);
 const [error,setError]=useState('');
 const load=()=>{setError('');void workspaces.settings(props.workspace.key).then(setSettings,()=>setError('Không tải được cấu hình Khoa. Kiểm tra kết nối và thử lại.'))};
 useEffect(()=>{let cancelled=false;void workspaces.settings(props.workspace.key).then(next=>{if(!cancelled)setSettings(next)},()=>{if(!cancelled)setError('Không tải được cấu hình Khoa.')});return()=>{cancelled=true}},[props.workspace.key]);
 if(error)return <div role="alert" className="p-6">{error}<Button onClick={load}>Thử lại</Button><Button variant="outline" onClick={props.openPicker}>Đổi Khoa</Button></div>;
 if(!settings)return <p role="status" className="p-6">Đang tải cấu hình Khoa…</p>;
 return <LoadedDepartmentApp {...props} settings={settings} setSettings={setSettings}/>;
}
function LoadedDepartmentApp({workspace,openPicker,registerGuard,settings,setSettings,onRenamed}:{workspace:Workspace;openPicker:()=>void;registerGuard:RegisterWorkspaceGuard;onRenamed:(workspace:Workspace)=>void;settings:WorkspaceSettingsSnapshot;setSettings:(next:WorkspaceSettingsSnapshot)=>void}){
 const state=useTreatmentData(settings.value);
 const careDefaults=useCareDefaults();
 const settingsGuard=useRef<()=>Promise<boolean>>(async()=>true);
 const registerSettingsGuard=useCallback((guard:()=>Promise<boolean>)=>{settingsGuard.current=guard;return()=>{if(settingsGuard.current===guard)settingsGuard.current=async()=>true}},[]);
 const libraryGuard=useRef<()=>Promise<boolean>>(async()=>true);
 const registerLibraryGuard=useCallback((guard:()=>Promise<boolean>)=>{libraryGuard.current=guard;return()=>{if(libraryGuard.current===guard)libraryGuard.current=async()=>true}},[]);
 const careGuard=useRef<()=>Promise<boolean>>(async()=>true);
 const registerCareGuard=useCallback((guard:()=>Promise<boolean>)=>{careGuard.current=guard;return()=>{if(careGuard.current===guard)careGuard.current=async()=>true}},[]);
 useEffect(()=>registerGuard(async()=>{
   if(!await settingsGuard.current())return false;
   if(!await careGuard.current())return false;
   if(!await libraryGuard.current())return false;
   return state.prepareToLeave();
 }),[registerGuard,state.prepareToLeave]);
 const routerNavigate=useNavigate();
 const page=useRouterState({select:state=>state.matches[state.matches.length-1]?.staticData.workspacePage});
 const navigate=(target:'episode'|'defaults'|'settings'|'library')=>{void routerNavigate({to:target==='library'?'/khoa/$workspaceKey/thu-vien-mau':target==='defaults'?'/khoa/$workspaceKey/care-defaults':target==='settings'?'/khoa/$workspaceKey/cau-hinh':'/khoa/$workspaceKey',params:{workspaceKey:workspace.slug??workspace.key}})};
 const openDefaults=async()=>{try{await state.flush();navigate('defaults')}catch{navigate('episode')}};

 const [help,setHelp]=useState(false);
 const [episodeQuery,setEpisodeQuery]=useState('');const [filter,setFilter]=useState('active');
 const views=useRef(new Map<string,EpisodeView>());
 const rememberView=useCallback((id:string,view:EpisodeView)=>{views.current.set(id,view)},[]);
 if(state.loadError)return <div role="alert" className="p-6"><Button variant="outline" onClick={openPicker}>Đổi Khoa</Button><p>Không thể đọc dữ liệu: {state.loadError}</p><Button onClick={()=>window.location.reload()}>Thử lại</Button></div>;
 if(!state.data)return <div role="status" className="p-6">Đang tải các đợt điều trị…</div>;
 return <div className="app-shell">
  <EpisodeSidebar onSettings={()=>navigate('settings')} settingsActive={page==='settings'} workspaceName={workspace.name} onWorkspaceChange={openPicker} {...state} query={episodeQuery} filter={filter} onQuery={setEpisodeQuery} onFilter={setFilter} onSelect={async id=>{if(!await libraryGuard.current())return false;const result=await state.selectRecord(id);if(result)navigate('episode');return result}} onNew={async()=>{if(!await settingsGuard.current())return false;if(!await libraryGuard.current())return false;const result=await state.newDraft();if(result)navigate('episode');return result}} onLibrary={()=>navigate('library')} libraryActive={page==='library'} onHelp={()=>{navigate('episode');setHelp(true)}} onDefaults={()=>void openDefaults()} defaultsActive={page==='defaults'}/>
  <WorkspaceSettingsPage onRenamed={onRenamed} active={page==='settings'} workspaceKey={workspace.key} name={workspace.name} slug={workspace.slug??workspace.key} snapshot={settings} onSaved={setSettings} registerLeaveGuard={registerSettingsGuard}/>
  <CareDefaultsPage registerLeaveGuard={registerCareGuard} active={page==='defaults'} {...careDefaults} onReload={()=>void careDefaults.reload()} onSave={careDefaults.update} onBack={()=>navigate('episode')}/>
  <TemplateLibraryPage active={page==='library'} templates={state.data.templates} saved={state.saved} busy={state.busy} error={state.actionError || (state.storageError?'Chưa lưu được thư viện. Nội dung đang sửa vẫn được giữ lại.':'')} conflict={state.conflict} onRetry={()=>void state.flush().catch(()=>{})} onResolveConflict={keep=>void state.resolveConflict(keep)} onChange={update=>state.setData(current=>({...current,templates:update(current.templates)}))} onBack={()=>navigate('episode')} registerLeaveGuard={registerLibraryGuard}/>
  <TreatmentEditor settings={settings.value} active={page==='episode'} careDefaults={careDefaults} key={state.viewKey} {...state} data={state.data} onLibrary={()=>navigate('library')} help={help} setHelp={setHelp} initialView={views.current.get(state.viewKey)} rememberView={rememberView} onStatusChange={async status=>{if(await state.changeStatus(status))setFilter(status)}}/>
  <Outlet/>
 </div>;
}
function TreatmentEditor({settings,active,careDefaults,data,setData,saved,storageError,storage,recordId,viewKey,busy,conflict,resolveConflict,actionError,flush,onLibrary,help,setHelp,initialView,rememberView,onStatusChange,deleteRecord}:Omit<ReturnType<typeof useTreatmentData>,'data'> & {settings:WorkspaceSettings;active:boolean;careDefaults:ReturnType<typeof useCareDefaults>;data:Data;onLibrary:()=>void;help:boolean;setHelp:(open:boolean)=>void;initialView?:EpisodeView;rememberView:(id:string,view:EpisodeView)=>void;onStatusChange:(status:'active'|'completed')=>Promise<void>}){
 const cloud=storage==='cloud';
 const [toast,setToast]=useState('');const [saveModal,setSaveModal]=useState<SaveTemplateDraft|null>(null);const fileRef=useRef<HTMLInputElement>(null);
 const notify=(s:string)=>setToast(s);

 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(t)},[toast]);
 const episode=summarizeRecord({id:recordId??viewKey,...recordInput(data)});
 const [deleteEpisodeOpen,setDeleteEpisodeOpen]=useState(false);
 const [form,setForm]=useState<FormKind>('treatment');
 const canPrint=!data.patientReview || data.patientReview.resolved;
 const treatmentView=useRef(initialView);
 const rememberTreatment=useCallback((view:EpisodeView)=>{treatmentView.current=view;rememberView(viewKey,view)},[viewKey,rememberView]);
 const changeForm=<K extends FormKind>(key:K,value:SetStateAction<Forms[K]>)=>setData(d=>({...d,forms:{...d.forms,[key]:typeof value==='function'?(value as (old:Forms[K])=>Forms[K])(d.forms[key]):value}}));
 const addTemplate=(k:Kind,text:string)=>{const clean=text.trim();if(!clean)return false;if(data.templates.some(t=>t.kind===k&&t.text.toLowerCase()===clean.toLowerCase())){notify('Nội dung này đã có trong thư viện');return false}setData(d=>({...d,templates:[...d.templates,{id:uid(),kind:k,text:clean,group:'Mẫu của tôi'}]}));notify('Đã lưu nội dung vào thư viện mẫu');return true};
 const exportData=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`phieu-theo-doi-${dayjs().format('YYYY-MM-DD')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Đã xuất bản sao phiếu và thư viện mẫu')};
 const importFile=async(f:File)=>{try{const v=parseData(JSON.parse(await f.text()));setPendingImport(v)}catch{notify('Tệp không hợp lệ. Hãy chọn bản sao JSON đã xuất từ ứng dụng.')}};
 const [pendingImport,setPendingImport]=useState<Data|null>(null);
 if(!active)return null;
 return <>
  <div className="main-shell"><header className="topbar no-print"><div className="breadcrumb">Không gian làm việc <span>/</span> <strong>Đợt điều trị</strong></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`status-dot ${storageError?'bg-red-500':'bg-emerald-500'}`}/>{storageError?'Chưa lưu được — hãy xuất bản sao':saved&&!recordId?'Mẫu trống, chưa tạo đợt':saved?(cloud?'Đã lưu trên Convex':'Đã lưu trên thiết bị'):'Đang lưu…'}</div></header>
   {(actionError||storageError)&&<div className="episode-action-error no-print" role="alert">{actionError||'Chưa lưu được nội dung. Kiểm tra kết nối và thử lưu lại.'}{conflict&&<><button onClick={()=>void resolveConflict(false)}>Dùng bản mới từ thiết bị khác</button><button onClick={()=>void resolveConflict(true)}>Giữ bản nháp của tôi</button></>}{storageError&&!conflict&&<button disabled={busy} onClick={()=>void flush().catch(()=>{})}>Thử lưu lại</button>}</div>}
   <main inert={busy} aria-busy={busy}><div className="page-heading no-print"><div className="episode-view-title"><h1>{episode.patientName.trim()||(recordId?'Đợt chưa đặt tên':'Đợt mới')}</h1><p>{recordId?'Các phiếu theo dõi trong đợt':'Nhập trực tiếp vào mẫu. Đợt điều trị sẽ được tạo và tự lưu khi bạn bắt đầu nhập.'}</p><div className="episode-context"><span className={`episode-status ${episode.status==='completed'?'is-completed':''}`}>{episode.status==='completed'?'Đã kết thúc':'Đang điều trị'}</span><span>Bắt đầu {formatDay(episode.startedOn)}</span>{data.endedOn&&episode.status==='completed'&&<span>Kết thúc {formatDay(data.endedOn)}</span>}{recordId&&<Button variant="ghost" className="episode-status-action" onClick={()=>void onStatusChange(episode.status==='completed'?'active':'completed')}>{episode.status==='completed'?'Tiếp tục điều trị':'Kết thúc đợt'}</Button>}</div></div><div className="flex flex-wrap gap-2">{recordId&&<Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={()=>setDeleteEpisodeOpen(true)}><Trash2/>Xóa đợt</Button>}<Button variant="outline" onClick={onLibrary}><BookOpen/>Thư viện mẫu</Button></div></div>
    <div className="print-heading"><strong>BỆNH VIỆN ĐA KHOA BÌNH DƯƠNG</strong><h1>PHIẾU THEO DÕI ĐIỀU TRỊ</h1><p>MS:36/BV-02</p></div>
    <PatientReview data={data} onChange={setData}/>
    <PatientForm settings={settings} data={data.patient} disabled={!canPrint} onChange={value=>setData(current=>({...current,patient:typeof value==='function'?value(current.patient):value}))}/>
    <FormTabs value={form} onChange={setForm}/>
    <div id="active-form" role="tabpanel" aria-labelledby={`form-tab-${form}`}>
    {form==='treatment'&&<TreatmentForm rows={data.forms.treatment.rows} onChange={value=>changeForm('treatment',old=>({rows:typeof value==='function'?value(old.rows):value}))} patient={data.patient} templates={data.templates} onSaveTemplate={setSaveModal} notify={notify} saved={saved} storageError={storageError} canPrint={canPrint} initialView={treatmentView.current} rememberView={rememberTreatment}/>}
    {form==='infusion'&&<InfusionForm data={data.forms.infusion} onChange={value=>changeForm('infusion',value)} patient={data.patient} canPrint={canPrint}/>}
    {form==='care'&&<CareForm defaults={careDefaults.snapshot?.value??null} defaultsError={careDefaults.error} reloadDefaults={()=>void careDefaults.reload()} data={data.forms.care} onChange={value=>changeForm('care',value)} patient={data.patient} canPrint={canPrint}/>}
    </div>
    <div className="below-table no-print"><p><ShieldCheck size={15}/> {cloud?'Dữ liệu dùng chung và tự đồng bộ giữa các thiết bị. Xuất bản sao để lưu giữ.':'Dữ liệu tự lưu trong trình duyệt này. Xuất bản sao để lưu giữ hoặc chuyển máy.'}</p><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>fileRef.current?.click()}><ArrowUpFromLine/>Nhập bản sao</Button><Button variant="outline" size="sm" onClick={exportData}><ArrowDownToLine/>Xuất bản sao</Button></div><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value=''}}/></div>
    <div className="footer no-print"><span>Nội Hô Hấp Bình Dương <span className="mx-2">·</span> Phiên bản nhập nhanh</span><span>Mở danh sách để chuyển đợt điều trị</span></div><p className="print-note">Ghi chú: Bác sĩ ký ngay sau mỗi lần ghi chép trong phần “Diễn biến bệnh” hoặc “Chỉ định”.</p>
   </main>
  </div>

  <Dialog open={!!saveModal} onOpenChange={open=>{if(!open)setSaveModal(null)}}><DialogContent title={saveModal?.kind==='orders'?'Lưu mẫu chỉ định':'Lưu nội dung làm mẫu'} description="Chỉnh lại nội dung dùng chung trước khi lưu. Bỏ các thông tin riêng của người bệnh.">{saveModal?.kind==='orders'?<OrderTemplateEditor initial={{orders:ordersDocument(saveModal.orders??saveModal.text)}} onCancel={()=>setSaveModal(null)} onSave={template=>{setData(current=>({...current,templates:[...current.templates,template]}));setSaveModal(null);notify('Đã lưu mẫu chỉ định')}}/>:saveModal&&<SaveTemplateEditor kind={saveModal.kind} text={saveModal.text} onSave={(kind,text)=>{if(addTemplate(kind,text))setSaveModal(null)}}/>}</DialogContent></Dialog>
  <Dialog open={deleteEpisodeOpen} onOpenChange={open=>{if(!busy)setDeleteEpisodeOpen(open)}}><DialogContent title={`Xóa đợt của ${episode.patientName.trim()||'người bệnh chưa đặt tên'}?`} description={`Xóa thông tin người bệnh và cả ba loại phiếu của đợt này${cloud?' trên mọi thiết bị dùng chung':''}. Không thể hoàn tác. Thư viện mẫu được giữ nguyên. Sau khi xóa, bạn sẽ chuyển về mẫu trống.`}>{actionError&&<p role="alert" className="day-error">{actionError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setDeleteEpisodeOpen(false)}>Giữ lại</Button><Button className="bg-red-600 hover:bg-red-700" disabled={busy} onClick={async()=>{if(await deleteRecord())setDeleteEpisodeOpen(false)}}><Trash2/>{busy?'Đang xóa…':'Xóa toàn bộ đợt'}</Button></div></DialogContent></Dialog>
  <Dialog open={!!pendingImport} onOpenChange={o=>{if(!o)setPendingImport(null)}}><DialogContent title="Khôi phục bản sao?" description="Thông tin người bệnh, cả ba loại phiếu và thư viện mẫu của đợt đang mở sẽ được thay thế bằng nội dung trong tệp đã chọn."><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setPendingImport(null)}>Hủy</Button><Button onClick={()=>{if(pendingImport){setData(d=>({...pendingImport,status:pendingImport.status??d.status,startedOn:pendingImport.startedOn??d.startedOn,endedOn:pendingImport.endedOn===undefined?d.endedOn:pendingImport.endedOn}));setForm('treatment');}setPendingImport(null);notify('Đã khôi phục dữ liệu từ bản sao')}}>Khôi phục</Button></div></DialogContent></Dialog>
  <Dialog open={help} onOpenChange={setHelp}><DialogContent title="Bắt đầu với nhập nhanh" description="Một đợt điều trị có ba loại phiếu dùng chung thông tin người bệnh."><ol className="space-y-4 text-sm leading-6"><li><strong>1. Nhập thông tin chung.</strong> Thông tin người bệnh được dùng cho mọi ngày và cả ba loại phiếu trong đợt.</li><li><strong>2. Chọn loại phiếu.</strong> Điều trị ghi theo ngày/buổi; truyền dịch ghi từng lần; chăm sóc ghi theo mốc giờ và mục tiêu. Mỗi loại có nút xem trước và in riêng.</li><li><strong>3. Tạo ngày điều trị mới.</strong> Bấm “Tạo ngày mới”, chọn ngày. Diễn biến và chỉ định của cả buổi sáng và chiều được sao chép sang ngày mới. Kiểm tra và cập nhật theo thực tế.</li><li><strong>4. Lưu và dùng lại.</strong> Bấm “Lưu mẫu” để thêm đoạn vào thư viện. {cloud?'Phiếu tự lưu trên Convex; dùng “Xuất bản sao” để giữ tệp riêng.':'Phiếu tự lưu trên trình duyệt; dùng “Xuất bản sao” để giữ tệp riêng.'}</li></ol><p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{cloud?'Bản thử nghiệm lưu trên Convex, chưa có tài khoản hoặc ký xác nhận. Mọi người có link đều có thể xem và sửa dữ liệu chung. Hãy xuất bản sao và dùng dữ liệu giả để thử thao tác.':'Bản thử nghiệm lưu cục bộ, chưa có tài khoản, đồng bộ nhiều máy hoặc ký xác nhận. Hãy dùng dữ liệu giả để thử thao tác.'}</p></DialogContent></Dialog>
  {toast&&<div role="status" className="toast no-print"><CheckCheck size={18}/>{toast}<button aria-label="Đóng thông báo" onClick={()=>setToast('')}><X size={15}/></button></div>}
 </>
}

