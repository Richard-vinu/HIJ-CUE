"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { MonitorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "hij-cue-desktop-tip";
const TIP_EVENT = "hij-cue-desktop-tip";

function subscribeTip(onStoreChange: () => void) {
  window.addEventListener(TIP_EVENT, onStoreChange);
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener(TIP_EVENT, onStoreChange);
    mq.removeEventListener("change", onStoreChange);
  };
}

function shouldOfferTip(): boolean {
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return false;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(max-width: 1023px)").matches;
}

/** Soft nudge on phones — admin UI is built for desktop. */
export function DesktopPreferredNotice() {
  const eligible = useSyncExternalStore(subscribeTip, shouldOfferTip, () => false);
  const [dismissed, setDismissed] = useState(false);
  const open = eligible && !dismissed;

  const dismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    window.dispatchEvent(new Event(TIP_EVENT));
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-w-[min(100%,22rem)] rounded-[20px] border-white/60 bg-background/95 sm:rounded-[22px] dark:border-white/10">
        <DialogHeader>
          <div className="mb-2 grid size-11 place-items-center rounded-[14px] bg-ink/8 text-ink dark:bg-white/10">
            <MonitorIcon className="size-5" strokeWidth={1.75} />
          </div>
          <DialogTitle className="text-left text-[20px] tracking-[-0.02em]">
            Best on desktop
          </DialogTitle>
          <DialogDescription className="text-left text-[14.5px] leading-relaxed text-ink-2">
            You’re on a phone. For the best experience with the admin panel —
            tasks, events calendar, and team — open HIJ Cue on a desktop or
            laptop.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            className="h-11 w-full rounded-[14px] sm:w-auto"
            onClick={dismiss}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
