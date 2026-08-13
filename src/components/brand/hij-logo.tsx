import Image from "next/image";
import { cn } from "@/lib/utils";

const SRC = "/hij-logo.png";

type HijLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Circular HIJ church seal — use for marks in headers and auth screens. */
export function HijLogo({ size = 32, className, priority }: HijLogoProps) {
  return (
    <Image
      src={SRC}
      alt="Hope In Jesus Apostolic Church of Christ"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}

type HijBrandLockupProps = {
  markSize?: number;
  title?: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  priority?: boolean;
};

/** Logo + wordmark used in app chrome. */
export function HijBrandLockup({
  markSize = 40,
  title = "HIJ Cue",
  subtitle = "White Clouds Media",
  className,
  titleClassName,
  subtitleClassName,
  priority,
}: HijBrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <HijLogo size={markSize} priority={priority} />
      <div className="min-w-0">
        <div
          className={cn(
            "text-[19px] leading-none font-medium tracking-[-0.02em] text-ink whitespace-nowrap",
            titleClassName
          )}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className={cn(
              "mt-1 font-mono text-[11px] tracking-[0.12em] text-ink-2 uppercase",
              subtitleClassName
            )}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
