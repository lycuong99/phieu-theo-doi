import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { TemplateKind as Kind, Template } from '../types';
const labels = { progress: "Diễn biến bệnh", orders: "Chỉ định" };
type TextDraft = { text: string };
const nonEmpty = (value: string) => !!value.trim() || "Nhập nội dung mẫu";

export function TemplateLibrary({
  templates,
  onChange,
  addTemplate,
  notify,
}: {
  templates: Template[];
  onChange: Dispatch<SetStateAction<Template[]>>;
  addTemplate: (kind: Kind, text: string) => boolean;
  notify: (message: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("progress");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const form = useForm<TextDraft>({ defaultValues: { text: "" } });
  const text = useWatch({ control: form.control, name: "text" });
  const clear = () => {
    setEditing(null);
    form.reset({ text: "" });
  };
  const matches = templates.filter(
    (template) =>
      template.kind === kind &&
      template.text
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  const save = form.handleSubmit(({ text }) => {
    if (editing) {
      onChange((current) =>
        current.map((template) =>
          template.id === editing
            ? { ...template, text: text.trim() }
            : template,
        ),
      );
      clear();
      notify("Đã cập nhật mẫu");
    } else if (addTemplate(kind, text)) form.reset({ text: "" });
  });
  return (
    <>
      <div className="library-tabs">
        {(["progress"] as Kind[]).map((value) => (
          <button
            key={value}
            className={kind === value ? "selected" : ""}
            onClick={() => {
              setKind(value);
              clear();
            }}
          >
            {labels[value]}{" "}
            <span>
              {templates.filter((template) => template.kind === value).length}
            </span>
          </button>
        ))}
      </div>
      <div className="relative my-4">
        <Search
          className="absolute left-3 top-3 text-muted-foreground"
          size={16}
        />
        <Input
          className="pl-9"
          placeholder="Tìm trong thư viện…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="template-list">
        {matches.map((template) => (
          <div className="template-item" key={template.id}>
            <div>
              <p>{template.text}</p>
              <span>{template.group}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(template.id);
                form.reset({ text: template.text });
              }}
            >
              Sửa
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Xóa mẫu ${template.text}`}
              onClick={() => {
                onChange((current) =>
                  current.filter((item) => item.id !== template.id),
                );
                if (editing === template.id) clear();
                notify("Đã xóa mẫu khỏi thư viện");
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {!matches.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Không tìm thấy nội dung phù hợp.
          </p>
        )}
      </div>
      <div className="mt-5 border-t pt-4">
        <label className="field">
          <span>{editing ? "Chỉnh sửa mẫu" : "Thêm mẫu mới"}</span>
          <textarea
            {...form.register("text", { validate: nonEmpty })}
            aria-label={editing ? "Chỉnh sửa mẫu" : "Thêm mẫu mới"}
            className="template-textarea"
            placeholder="Nhập cụm nội dung hoặc đoạn văn muốn dùng lại…"
            rows={3}
          />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          {editing && (
            <Button variant="ghost" onClick={clear}>
              Hủy sửa
            </Button>
          )}
          <Button disabled={!text.trim()} onClick={save}>
            <Plus />
            {editing ? "Lưu thay đổi" : "Thêm vào thư viện"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function SaveTemplateEditor({
  kind,
  text,
  onSave,
}: {
  kind: Kind;
  text: string;
  onSave: (kind: Kind, text: string) => void;
}) {
  const form = useForm<TextDraft>({ defaultValues: { text } });
  const draft = useWatch({ control: form.control, name: "text" });
  return (
    <>
      <label className="field">
        <span>{labels[kind]}</span>
        <textarea
          {...form.register("text", { validate: nonEmpty })}
          aria-label={labels[kind]}
          className="template-textarea"
          rows={5}
        />
      </label>
      <div className="mt-4 flex justify-end">
        <Button
          disabled={!draft.trim()}
          onClick={form.handleSubmit(({ text }) => onSave(kind, text))}
        >
          <Check />
          Lưu vào thư viện
        </Button>
      </div>
    </>
  );
}
