"use client";

import { useState } from "react";
import {
  avatarUrl,
  type AvatarFeatures,
  type AvatarPerson,
} from "@/lib/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PersonAvatar({
  person,
  size = 32,
  className,
  style: styleOverride,
  seed: seedOverride,
  features: featuresOverride,
}: {
  person: AvatarPerson | null | undefined;
  size?: number;
  className?: string;
  style?: string;
  seed?: string;
  features?: AvatarFeatures | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const name = person?.name?.trim() || "?";
  const src = person
    ? avatarUrl(person, {
        size: Math.max(128, size * 2),
        style: styleOverride,
        seed: seedOverride,
        features: featuresOverride,
      })
    : null;
  const failed = !!src && failedSrc === src;

  if (!person || !src || failed) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink/8 font-mono font-medium text-ink",
          className
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, size * 0.375),
        }}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- DiceBear CDN
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full bg-ink/5 object-cover", className)}
      style={{ width: size, height: size }}
      onError={() => setFailedSrc(src)}
    />
  );
}
