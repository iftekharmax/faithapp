import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  invalid?: boolean;
};

const TOOLS = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "insertUnorderedList", icon: List, label: "Bullet list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
] as const;

export function RichTextEditor({ value, onChange, placeholder, className, id, invalid }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Sync external value only when it differs from the DOM (avoids caret jumps)
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value ?? "")) el.innerHTML = value ?? "";
  }, [value]);

  function exec(cmd: string) {
    ref.current?.focus();
    document.execCommand(cmd, false);
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Enter URL");
    if (!url) return;
    ref.current?.focus();
    document.execCommand("createLink", false, url);
    onChange(ref.current?.innerHTML ?? "");
  }

  const isEmpty = !value || value === "<br>" || value.replace(/<[^>]*>/g, "").trim() === "";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-sm transition-all",
        focused ? "ring-2 ring-primary/40 border-primary/40" : "border-muted-foreground/20",
        invalid && "border-destructive ring-destructive/30",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
        {TOOLS.map((t) => (
          <Button
            key={t.cmd}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.label}
            title={t.label}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Insert link"
          title="Insert link"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear formatting"
          title="Clear formatting"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
        >
          <Eraser className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        {isEmpty && !focused && (
          <span className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          className="min-h-[140px] w-full px-4 py-3 text-sm leading-relaxed outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  );
}
