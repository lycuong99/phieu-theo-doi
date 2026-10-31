import { Button } from './ui/button';
import { resolveWorkspace } from '../services/workspaces/model';
import { useBlocker, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Workspace } from '../types';
import { TreatmentServicesProvider, workspaces, workspaceStorage } from '../services/treatment-records/provider';
import { rememberedWorkspace, rememberWorkspace, selectWorkspace } from '../services/workspaces/selection';
import { WorkspacePicker } from './workspace-picker';
import { Dialog, DialogContent } from './ui/dialog';

export type RegisterWorkspaceGuard = (guard: () => Promise<boolean>) => () => void;

export function WorkspaceBoundary({ children }: {
  children: (workspace: Workspace, openPicker: () => void, registerGuard: RegisterWorkspaceGuard, onRenamed: (workspace: Workspace) => void) => ReactNode;
}) {
  const navigate = useNavigate();
  const routeKey = useRouterState({ select: state => /^\/khoa\/([^/]+)/.exec(state.location.pathname)?.[1] });
  const pathname = useRouterState({select: state => state.location.pathname});
  const aliases = useRef(new Map<string,string>());
  const legacyDefaults = useRouterState({ select: state => state.location.pathname === '/care-defaults' });
  useBlocker({ shouldBlockFn: async ({ current, next }) => {
    if (current.pathname === next.pathname) return false;
    const allowed = await beforeLeave.current();
    setError(allowed ? '' : 'Chưa lưu được nội dung đang sửa. Hãy xử lý lỗi trước khi chuyển trang hoặc đổi Khoa.');
    return !allowed;
  }, enableBeforeUnload: false });
  const [items, setItems] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const beforeLeave = useRef<() => Promise<boolean>>(async () => true);
  const registerGuard = useCallback<RegisterWorkspaceGuard>(guard => {
    beforeLeave.current = guard;
    return () => { if (beforeLeave.current === guard) beforeLeave.current = async () => true; };
  }, []);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await workspaces.list()); }
    catch { setError('Không tải được danh sách Khoa. Kiểm tra kết nối và thử tải lại.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void workspaces.list().then(items => {
      if (cancelled) return;
      setItems(items);
      try { if (!routeKey) setCurrent(rememberedWorkspace(window.localStorage, workspaceStorage, items)); }
      catch { setError('Không đọc được Khoa đã ghi nhớ. Hãy chọn lại Khoa.'); }
    }, () => { if (!cancelled) setError('Không tải được danh sách Khoa. Kiểm tra kết nối và thử tải lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (loading) return;
    if (routeKey) {
      const item = resolveWorkspace(items, routeKey) ?? items.find(item => item.key === aliases.current.get(routeKey));
      if (!item) { setCurrent(null); setError('Không tìm thấy Khoa trong đường dẫn. Hãy chọn lại Khoa.'); return; }
      setCurrent(item);
      if (item.slug && routeKey !== item.slug) {
        const to = pathname.endsWith('/cau-hinh') ? '/khoa/$workspaceKey/cau-hinh' : pathname.endsWith('/care-defaults') ? '/khoa/$workspaceKey/care-defaults' : '/khoa/$workspaceKey';
        void navigate({to,params:{workspaceKey:item.slug},replace:true,ignoreBlocker:true});
      }
      try { rememberWorkspace(window.localStorage, workspaceStorage, item); } catch { /* URL still identifies this department. */ }
    } else if (current) {
      void navigate({ to: legacyDefaults ? '/khoa/$workspaceKey/care-defaults' : '/khoa/$workspaceKey', params: { workspaceKey: current.slug ?? current.key }, replace: true });
    }
  }, [routeKey, loading, items, current, legacyDefaults, navigate, pathname]);
  async function choose(item: Workspace) {
    if (item.key === current?.key) { setOpen(false); return; }
    const selected = await selectWorkspace(item, beforeLeave.current,
      next => rememberWorkspace(window.localStorage, workspaceStorage, next),
      next => { setOpen(false); void navigate({ to: '/khoa/$workspaceKey', params: { workspaceKey: next.slug ?? next.key } }); });
    if (!selected) throw new Error('Chưa lưu được bản đang sửa. Đóng hộp thoại để hoàn thiện hoặc xử lý xung đột, rồi đổi Khoa lại.');
  }
  const picker = <WorkspacePicker directory={workspaces} items={items} current={current} loading={loading} error={error}
    onReload={reload} onSelect={choose} onCreated={item => setItems(items => [...items, item])}/>;
  if (!current) return <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-6 py-12">
    <header className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">Phiếu theo dõi</p><h1>Chọn Khoa làm việc</h1>
      <p className="text-sm text-muted-foreground">Lựa chọn được ghi nhớ trên trình duyệt này. Bạn có thể đổi Khoa trong ứng dụng.</p></header>
    {picker}
    {workspaceStorage === 'local' && <p className="text-sm text-muted-foreground">Đang lưu trên thiết bị này. Danh sách Khoa và dữ liệu chưa đồng bộ sang thiết bị khác.</p>}
  </main>;
  return <>
    {error && <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-white p-4 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" aria-label="Đóng thông báo" onClick={() => setError('')}>Đóng</Button></div>}
    <TreatmentServicesProvider key={current.key} workspaceKey={current.key}>
      {children(current, () => { setOpen(true); void reload(); }, registerGuard, next => { if(current.slug) aliases.current.set(current.slug,current.key); setCurrent(next); setItems(items => items.map(item => item.key === next.key ? next : item)); })}
    </TreatmentServicesProvider>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Chọn Khoa làm việc" description={`Khoa hiện tại: ${current.name}. Nội dung đang sửa sẽ được lưu trước khi chuyển Khoa.`}>{picker}</DialogContent></Dialog>
  </>;
}
