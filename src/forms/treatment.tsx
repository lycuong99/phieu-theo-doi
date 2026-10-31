import { OrderTemplatePicker } from './order-templates';
import type { SaveTemplateDraft } from './order-templates';
import { OrdersEditor } from '../components/treatment-orders/orders-editor';
import { appendOrderTemplate, ordersDocument, ordersText } from '../lib/treatment-orders';
import { useController, useForm } from "react-hook-form";
import { useSynchronizedForm } from "./use-synchronized-form";
import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Copy,
  FileText,
  LayoutTemplate,
  ListPlus,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { DatePicker } from "../components/date-picker";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent } from "../components/ui/dialog";
import {
  dayContent,
  dayRows,
  nextDay,
  copyDay,
  updateDay,
  formatDay,
} from "../lib/daily-records";
import { printForm } from "../lib/print-form";
import { localTime } from "../services/treatment-records/model";
import type { TemplateKind as Kind, Template, Patient, TreatmentRow as Row, DrugName, TreatmentOrders } from '../types';
import type { Dispatch, SetStateAction } from "react";
const uid = () => crypto.randomUUID();
const labels = { progress: "Diễn biến bệnh", orders: "Chỉ định" };
function Picker({
  templates,
  onSelect,
  kind,
}: {
  templates: Template[];
  onSelect: (text: string) => void;
  kind: Kind;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className="picker-button">
          <ListPlus />
          <span>Chọn nội dung</span>
          <ChevronDown className="!size-3 ml-2" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-30 w-[min(360px,90vw)] rounded-xl border bg-white p-1.5 shadow-xl"
        >
          <Command label={`Chọn ${labels[kind]}`}>
            <div className="flex items-center gap-2 border-b px-2">
              <Search size={16} className="text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Gõ để tìm nội dung…"
                className="h-11 w-full text-sm outline-none"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="p-4 text-sm text-muted-foreground">
                Chưa có mẫu phù hợp. Bạn có thể nhập trực tiếp.
              </Command.Empty>
              {Array.from(new Set(templates.map((t) => t.group))).map(
                (group) => (
                  <Command.Group key={group} heading={group}>
                    {templates
                      .filter((t) => t.group === group)
                      .map((t) => (
                        <Command.Item
                          key={t.id}
                          value={t.text}
                          onSelect={() => {
                            onSelect(t.text);
                            setOpen(false);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2.5 text-sm data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-800"
                        >
                          <span>{t.text}</span>
                          <Plus size={14} />
                        </Command.Item>
                      ))}
                  </Command.Group>
                ),
              )}
            </Command.List>
            <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
              ↑ ↓ di chuyển · Enter để chọn · Esc để đóng
            </div>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function TreatmentForm({
  rows,
  onChange,
  patient,
  templates,
  onSaveTemplate,
  notify,
  saved,
  storageError,
  canPrint,
  initialView,
  rememberView,
  drugNames: suppliedNames = [],
}: {
  drugNames?: readonly DrugName[];
  rows: Row[];
  onChange: Dispatch<SetStateAction<Row[]>>;
  patient: Patient;
  templates: Template[];
  onSaveTemplate: (value: SaveTemplateDraft) => void;
  notify: (message: string) => void;
  saved: boolean;
  storageError: boolean;
  canPrint: boolean;
  initialView?: {
    day: string;
    session: "morning" | "afternoon";
  };
  rememberView: (view: {
    day: string;
    session: "morning" | "afternoon";
  }) => void;
}) {
  const days = [...new Set(rows.map((r) => r.time.slice(0, 10)))].sort();
  const [selectedDay, setSelectedDay] = useState(initialView?.day ?? "");
  const activeDay = days.includes(selectedDay)
    ? selectedDay
    : days[days.length - 1];
  const [session, setSession] = useState<"morning" | "afternoon">(
    initialView?.session ?? "morning",
  );
  const content = dayContent(rows, activeDay, session);
  const drugNames = [...new Map([...suppliedNames, ...rows.flatMap(row => ordersDocument(row.orders).items
    .flatMap(item => item.kind === 'medication' && item.name.trim() ? [{ id: item.name, name: item.name }] : []))]
    .map(item => [item.name, item])).values()];
  useEffect(() => {
    rememberView({ day: activeDay, session });
  }, [activeDay, session, rememberView]);
  const [newDayOpen, setNewDayOpen] = useState(false);
  const [deleteDayOpen, setDeleteDayOpen] = useState(false);
  const newDayForm = useForm({ defaultValues: { day: "" } });
  const { field: targetDayField } = useController({
    control: newDayForm.control,
    name: "day",
  });
  const targetDay = targetDayField.value;
  const setTargetDay = (day: string) =>
    newDayForm.setValue("day", day, { shouldDirty: true });
  const [dayError, setDayError] = useState("");
  const [copiedFrom, setCopiedFrom] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const [printAll, setPrintAll] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const printFrame = useRef<HTMLIFrameElement>(null);
  const openNewDay = () => {
    let target = nextDay(activeDay);
    while (days.includes(target)) target = nextDay(target);
    setTargetDay(target);
    setDayError("");
    setNewDayOpen(true);
  };
  const changeContent = <K extends Kind>(k: K, text: TreatmentContent[K]) =>
    onChange((current) => updateDay(current, activeDay, k, text, session));
  const createDay = () => {
    try {
      const next = copyDay(rows, activeDay, targetDay, uid());
      onChange(next);
      setSelectedDay(targetDay);
      setSession("morning");
      setCopiedFrom({ source: activeDay, target: targetDay });
      setNewDayOpen(false);
      notify(
        `Đã tạo ngày ${formatDay(targetDay)} từ ngày ${formatDay(activeDay)}`,
      );
    } catch (error) {
      setDayError(
        error instanceof Error ? error.message : "Không thể tạo ngày mới",
      );
    }
  };
  return (
    <section aria-label="Phiếu theo dõi điều trị">
      <div className="form-heading">
        <div>
          <h2>Theo dõi điều trị</h2>
          <p>Ghi diễn biến bệnh và chỉ định theo ngày, buổi.</p>
        </div>
        <Button
          disabled={!canPrint}
          onClick={() => {
            setPrintAll(false);
            setPrintReady(false);
            setPrintPreview(true);
          }}
        >
          <Printer />
          In ngày này
        </Button>
      </div>
      <section className="daily-workspace">
        <div className="day-navigation no-print">
          <div className="day-navigation-title">
            <CalendarDays size={18} />
            <h2>Ngày điều trị</h2>
            <span>{days.length} ngày</span>
          </div>
          <div className="day-actions">
            <DatePicker
              value={activeDay}
              onChange={setSelectedDay}
              availableDates={days}
              label="Đến ngày điều trị"
            />
            <Button
              variant="ghost"
              className="delete-day-button"
              onClick={() => setDeleteDayOpen(true)}
            >
              <Trash2 />
              Xóa ngày
            </Button>
            <Button onClick={openNewDay}>
              <Copy />
              Tạo ngày mới
            </Button>
          </div>
        </div>
        <div
          className="day-tabs no-print"
          role="tablist"
          aria-label="Chọn ngày điều trị"
        >
          {days.map((day, index) => (
            <button
              key={day}
              id={`tab-${day}`}
              role="tab"
              aria-selected={day === activeDay}
              aria-controls="day-editor"
              tabIndex={day === activeDay ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next =
                    days[
                      (index + (e.key === "ArrowRight" ? 1 : days.length - 1)) %
                        days.length
                    ];
                  setSelectedDay(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              className={day === activeDay ? "day-tab selected" : "day-tab"}
              onClick={() => setSelectedDay(day)}
            >
              <span>Ngày {index + 1}</span>
              <strong>{formatDay(day)}</strong>
              {day === localTime().slice(0, 10) && <small>Hôm nay</small>}
            </button>
          ))}
        </div>
        <div
          id="day-editor"
          role="tabpanel"
          aria-labelledby={`tab-${activeDay}`}
          className="day-editor"
        >
          <div className="day-editor-heading">
            <div>
              <h2>Nội dung ngày {formatDay(activeDay)}</h2>
              <p>Một ngày gồm mặt trước buổi sáng và mặt sau buổi chiều.</p>
            </div>
            <span className="daily-save-state">
              {storageError
                ? "Chưa lưu được"
                : saved
                  ? "Đã tự lưu"
                  : "Đang lưu…"}
            </span>
          </div>
          {copiedFrom?.target === activeDay && (
            <div className="copied-banner" role="status">
              <Copy size={17} />
              <div>
                <strong>
                  Đã lấy lại toàn bộ nội dung ngày{" "}
                  {formatDay(copiedFrom.source)}
                </strong>
                <span>
                  Chỉnh sửa cho ngày {formatDay(activeDay)}. Nội dung ngày trước
                  được giữ riêng.
                </span>
              </div>
              <button
                aria-label="Đóng ghi chú sao chép"
                onClick={() => setCopiedFrom(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div
            className="session-tabs"
            role="tablist"
            aria-label="Buổi điều trị"
          >
            {(["morning", "afternoon"] as const).map((part) => (
              <button
                key={part}
                role="tab"
                aria-selected={session === part}
                aria-controls="session-editor"
                id={`session-${part}`}
                onClick={() => setSession(part)}
                className={
                  session === part ? "session-tab selected" : "session-tab"
                }
              >
                <strong>
                  {part === "morning" ? "Buổi sáng" : "Buổi chiều"}
                </strong>
                <span>
                  {part === "morning" ? "Mặt trước" : "Mặt sau"}
                  {dayContent(rows, activeDay, part).progress.trim() ||
                  ordersText(dayContent(rows, activeDay, part).orders).trim()
                    ? " · Có nội dung"
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <p className="session-hint">
            {session === "morning"
              ? "Nhập nội dung buổi sáng. Nếu vượt mặt trước, phần còn lại tự chuyển sang đầu mặt sau."
              : "Nhập nội dung buổi chiều. Bản in đặt sau phần buổi sáng chuyển tiếp, nếu có."}
          </p>
          <TreatmentSessionEditor
            key={`${activeDay}-${session}`}
            activeDay={activeDay}
            session={session}
            content={content}
            drugNames={drugNames}
            templates={templates}
            onChange={changeContent}
            onSaveTemplate={onSaveTemplate}
          />
          <div className="daily-next">
            <div>
              <strong>Tiếp tục ngày kế tiếp</strong>
              <p>
                Tạo ngày mới với đầy đủ nội dung sáng và chiều ngày{" "}
                {formatDay(activeDay)}.
              </p>
            </div>
            <Button variant="outline" onClick={openNewDay}>
              Tạo ngày mới từ ngày này
              <ArrowRight />
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={printPreview} onOpenChange={setPrintPreview}>
        <DialogContent
          className="print-preview-dialog"
          title="Xem trước phiếu in"
          description="Khổ A4 · Bố cục theo mẫu MS:36/BV-02. Kiểm tra nội dung trước khi in."
        >
          <div className="preview-toolbar">
            <label className="print-scope">
              Phạm vi in
              <select
                value={printAll ? "all" : "day"}
                onChange={(e) => {
                  setPrintReady(false);
                  setPrintAll(e.target.value === "all");
                }}
              >
                <option value="day">Ngày {formatDay(activeDay)}</option>
                <option value="all">Tất cả {days.length} ngày</option>
              </select>
            </label>
            <span>
              Khi in: chọn A4, tỷ lệ 100%, tắt đầu/chân trang, chọn in hai mặt
              và lật cạnh dài.
            </span>
            <Button
              disabled={!printReady}
              onClick={() => {
                printFrame.current?.contentWindow?.focus();
                printFrame.current?.contentWindow?.print();
              }}
            >
              <Printer />
              In phiếu / Lưu PDF
            </Button>
          </div>
          <iframe
            ref={printFrame}
            title="Bản xem trước phiếu theo dõi điều trị A4"
            className="print-preview-frame"
            srcDoc={printForm(
              patient,
              printAll ? rows : dayRows(rows, activeDay),
            )}
            onLoad={() => setPrintReady(true)}
          />
          <div className="preview-footer">
            <span>
              Mỗi ngày tối thiểu 2 mặt: sáng ở trước, chiều ở sau. Sáng tràn
              được nối ở mặt sau trước nội dung chiều.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintPreview(false)}
            >
              Quay lại chỉnh sửa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={newDayOpen} onOpenChange={setNewDayOpen}>
        <DialogContent
          title="Tạo ngày mới"
          description={`Lấy lại toàn bộ diễn biến và chỉ định từ ngày ${formatDay(activeDay)} để tiếp tục chỉnh sửa.`}
        >
          <div className="new-day-source">
            <CalendarDays size={20} />
            <div>
              <span>Ngày nguồn</span>
              <strong>{formatDay(activeDay)}</strong>
            </div>
            <ArrowRight />
            <div>
              <span>Thông tin được giữ</span>
              <strong>Người bệnh, diễn biến, chỉ định</strong>
            </div>
          </div>
          <label className="field">
            <span>Ngày mới</span>
            <DatePicker
              value={targetDay}
              disabledDates={days}
              label="Chọn ngày mới"
              onChange={(day) => {
                setTargetDay(day);
                setDayError("");
              }}
            />
          </label>
          {(dayError || days.includes(targetDay)) && (
            <p role="alert" className="day-error">
              {dayError ||
                "Ngày này đã tồn tại. Chọn ngày khác để giữ nguyên nội dung đã ghi."}
            </p>
          )}
          <p className="new-day-hint">
            Sau khi tạo, bạn sẽ chuyển sang ngày mới. Các thay đổi tại đó không
            làm thay đổi nội dung ngày nguồn.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewDayOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={
                !targetDay ||
                targetDay === activeDay ||
                days.includes(targetDay)
              }
              onClick={createDay}
            >
              <Copy />
              Tạo ngày mới và lấy lại nội dung
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDayOpen} onOpenChange={setDeleteDayOpen}>
        <DialogContent
          title={`Xóa ngày ${formatDay(activeDay)}?`}
          description={
            days.length === 1
              ? "Đây là ngày cuối cùng. Diễn biến và chỉ định sẽ được xóa để nhập lại; thông tin người bệnh và thư viện mẫu được giữ."
              : "Xóa thông tin và nội dung của ngày này. Các ngày khác và thư viện mẫu được giữ. Bạn có thể chọn lại ngày này khi tạo ngày mới."
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDayOpen(false)}>
              Giữ lại
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                const deleted = activeDay;
                const remaining = days.filter((day) => day !== deleted);
                onChange((current) =>
                  remaining.length
                    ? current.filter((r) => r.time.slice(0, 10) !== deleted)
                    : [
                        {
                          id: uid(),
                          time: `${deleted}T00:00`,
                          progress: "",
                          orders: "",
                        },
                      ],
                );
                setSelectedDay(
                  remaining.filter((day) => day < deleted).at(-1) ||
                    remaining[0] ||
                    deleted,
                );
                setCopiedFrom(null);
                setDeleteDayOpen(false);
                notify(
                  remaining.length
                    ? `Đã xóa ngày ${formatDay(deleted)}. Có thể tạo lại ngày này.`
                    : "Đã xóa nội dung. Bạn có thể nhập lại ngày này.",
                );
              }}
            >
              <Trash2 />
              {days.length === 1 ? "Xóa nội dung để nhập lại" : "Xóa ngày này"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type TreatmentContent = { progress: string; orders: TreatmentOrders };
type TreatmentEditor = ReturnType<typeof useSynchronizedForm<{ progress: string }>>;
function TreatmentSessionEditor({ activeDay, session, content, templates, drugNames, onChange, onSaveTemplate }: {
  activeDay: string;
  session: "morning" | "afternoon";
  content: TreatmentContent;
  templates: Template[];
  drugNames: readonly DrugName[];
  onChange: <K extends Kind>(kind: K, value: TreatmentContent[K]) => void;
  onSaveTemplate: (value: SaveTemplateDraft) => void;
}) {
  const editor = useSynchronizedForm({ progress: content.progress }, (_name, value) => onChange('progress', value));
  return <div id="session-editor" role="tabpanel" aria-labelledby={`session-${session}`} className="daily-columns">
    {(["progress", "orders"] as const).map(kind => {
      const text = kind === 'orders' ? ordersText(content.orders) : content.progress;
      return <section className="daily-column" key={`${activeDay}-${session}-${kind}`}>
        <div className="daily-column-title"><FileText size={17} /><h3>{labels[kind]}</h3></div>
        <div className="daily-tools">
          {kind === 'orders' ? <OrderTemplatePicker templates={templates} onSelect={template => onChange('orders', appendOrderTemplate(content.orders, template.orders ?? template.text))} /> : <Picker kind={kind} templates={templates.filter(template => template.kind === kind)} onSelect={selected => {
              const current = editor.form.getValues('progress');
              editor.change('progress', `${current.trim()}${current.trim() ? "\n" : ""}${selected}`);
          }} />}
          <Button size="sm" variant="ghost" disabled={!text.trim()} onClick={() => onSaveTemplate({ kind, text, ...(kind === 'orders' ? { orders: content.orders } : {}) })}>
            <LayoutTemplate data-icon="inline-start" />{kind === 'orders' ? 'Lưu mẫu chỉ định' : 'Lưu mẫu'}
          </Button>
        </div>
        {kind === 'orders' ? <OrdersEditor value={content.orders} onChange={value => onChange('orders', value)} drugNames={drugNames}
          label={`Chỉ định ${session === 'morning' ? 'buổi sáng' : 'buổi chiều'} ngày ${formatDay(activeDay)}`} />
          : <><label className="daily-text-label"><TreatmentTextControl editor={editor}
            label={`Diễn biến bệnh ${session === 'morning' ? 'buổi sáng' : 'buổi chiều'} ngày ${formatDay(activeDay)}`} /></label>
            <div className="daily-column-footer"><span>{text.length} ký tự</span><span>Mỗi lần Enter là một dòng mới</span></div></>}
      </section>;
    })}
  </div>;
}
function TreatmentTextControl({ editor, label }: { editor: TreatmentEditor; label: string }) {
  const { field } = useController({ control: editor.form.control, name: 'progress' });
  return <textarea {...field} aria-label={label} onChange={event => editor.change('progress', event.target.value)}
    placeholder="Chọn nội dung có sẵn hoặc ghi diễn biến buổi này…" rows={12} />;
}
