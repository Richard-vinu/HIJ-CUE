"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

type MentionState = {
  start: number;
  query: string;
} | null;

function getMentionAtCursor(value: string, cursor: number): MentionState {
  const before = value.slice(0, cursor);
  const match = before.match(/(^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const start = cursor - query.length - 1;
  return { start, query };
}

export function MentionTextarea({
  people,
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
  disabled,
}: {
  people: Person[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<MentionState>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return people
      .filter((p) => {
        const name = p.name.toLowerCase();
        const slug = p.slug.toLowerCase();
        return !q || name.includes(q) || slug.includes(q);
      })
      .slice(0, 6);
  }, [mention, people]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mention?.query, mention?.start]);

  function updateMentionFromEl(el: HTMLTextAreaElement) {
    setMention(getMentionAtCursor(el.value, el.selectionStart ?? 0));
  }

  function insertMention(person: Person) {
    const el = ref.current;
    if (!el || !mention) return;

    const end = el.selectionStart ?? value.length;
    const handle = person.name.replace(/^Pastor\s+/i, "").split(/\s+/)[0];
    const inserted = `@${handle} `;
    const finalValue = value.slice(0, mention.start) + inserted + value.slice(end);

    onChange(finalValue);
    setMention(null);

    requestAnimationFrame(() => {
      const pos = mention.start + inserted.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          updateMentionFromEl(e.target);
        }}
        onClick={(e) => updateMentionFromEl(e.currentTarget)}
        onKeyUp={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key))
            return;
          updateMentionFromEl(e.currentTarget);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Delay so click on suggestion can fire
          window.setTimeout(() => setMention(null), 150);
        }}
      />

      {mention && suggestions.length > 0 ? (
        <div
          className="absolute right-0 bottom-[calc(100%+6px)] left-0 z-50 overflow-hidden rounded-[14px] border border-ink/10 bg-white/95 shadow-[0_12px_40px_rgba(16,23,41,0.16)] backdrop-blur-xl"
          role="listbox"
          aria-label="Mention someone"
        >
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                i === activeIndex ? "bg-ink/[0.06]" : "hover:bg-ink/[0.04]"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(p);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/8 font-mono text-[11px] text-ink-2">
                {initials(p.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">
                  {p.name}
                </div>
                <div className="truncate font-mono text-[11px] text-ink-2">
                  @{p.name.replace(/^Pastor\s+/i, "").split(/\s+/)[0]}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Highlight @mentions in comment text for display */
export function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@[A-Za-z][\w'-]*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-medium text-ink">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
