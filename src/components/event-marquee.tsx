"use client";

import { cn } from "@/lib/utils";

/** Slow, readable Independence-themed marquee (India flag accents). */
export function EventMarquee({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  const text = message.trim();
  if (!text) return null;

  // Repeat so long messages still loop smoothly
  const loop = `${text}   ···   ${text}   ···   `;

  return (
    <div
      className={cn(
        "event-marquee relative overflow-hidden rounded-[14px]",
        className
      )}
      role="status"
      aria-label={text}
    >
      {/* India flag stripe */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-1">
        <span className="h-full flex-1 bg-[#FF9933]" />
        <span className="h-full flex-1 bg-white dark:bg-[#f5f5f5]" />
        <span className="h-full flex-1 bg-[#138808]" />
      </div>

      <div className="event-marquee-track flex w-max items-center gap-0 py-3 pt-3.5 whitespace-nowrap">
        <span className="event-marquee-text px-4 font-mono text-[13px] font-medium tracking-[0.04em] uppercase sm:text-[14px]">
          {loop}
        </span>
        <span
          aria-hidden
          className="event-marquee-text px-4 font-mono text-[13px] font-medium tracking-[0.04em] uppercase sm:text-[14px]"
        >
          {loop}
        </span>
      </div>
    </div>
  );
}
