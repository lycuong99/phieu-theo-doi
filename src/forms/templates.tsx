import { useForm, useWatch } from 'react-hook-form';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { TemplateKind as Kind } from '../types';
const labels = { progress: 'Diễn biến bệnh', orders: 'Chỉ định' };
type TextDraft = { text: string };
const nonEmpty = (value: string) => !!value.trim() || 'Nhập nội dung mẫu';

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
