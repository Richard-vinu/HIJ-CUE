"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DicesIcon } from "lucide-react";
import { updateMyAvatar } from "@/actions/cue";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVATAR_STYLE,
  findGalleryChoice,
  randomAvatarBatch,
  resolveAvatarFeatures,
  resolveAvatarSeed,
  type AvatarChoice,
} from "@/lib/avatar";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

function toFeatures(choice: AvatarChoice) {
  return {
    hairVariant: choice.hairVariant,
    eyesVariant: choice.eyesVariant,
    mouthVariant: choice.mouthVariant,
    eyebrowsVariant: choice.eyebrowsVariant ?? ("neutral" as const),
  };
}

function initialChoice(person: Person): AvatarChoice {
  const seed = resolveAvatarSeed(person);
  const fromSeed = findGalleryChoice(seed);
  if (fromSeed) return fromSeed;
  const features = resolveAvatarFeatures(person);
  if (features) {
    return { ...features, seed };
  }
  return randomAvatarBatch(1)[0]!;
}

export function AvatarPickerDialog({
  person,
  open,
  onOpenChange,
}: {
  person: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<AvatarChoice>(() =>
    initialChoice(person)
  );
  const [options, setOptions] = useState<AvatarChoice[]>(() =>
    randomAvatarBatch(6, initialChoice(person))
  );
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo(
    () => ({
      ...person,
      avatar_style: AVATAR_STYLE,
      avatar_seed: choice.seed,
      avatar_features: toFeatures(choice),
    }),
    [person, choice]
  );

  function onOpen(next: boolean) {
    if (next) {
      const current = initialChoice(person);
      setChoice(current);
      setOptions(randomAvatarBatch(6, current));
      setError(null);
    }
    onOpenChange(next);
  }

  function shuffle() {
    const nextBatch = randomAvatarBatch(6);
    setOptions(nextBatch);
    setChoice(nextBatch[0]!);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMyAvatar(
        person.id,
        AVATAR_STYLE,
        choice.seed,
        toFeatures(choice)
      );
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Set your avatar</DialogTitle>
          <DialogDescription>
            Pick one of the looks below, or shuffle for a new set.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-1">
          <PersonAvatar
            person={draft}
            size={88}
            className="ring-1 ring-ink/10"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={shuffle}
          >
            <DicesIcon className="size-3.5" />
            Shuffle
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-1 sm:grid-cols-6">
          {options.map((item) => {
            const selected = item.seed === choice.seed;
            return (
              <button
                key={item.seed}
                type="button"
                disabled={pending}
                onClick={() => setChoice(item)}
                className={cn(
                  "grid place-items-center rounded-full p-0.5 transition-all",
                  selected
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-popover"
                    : "opacity-90 hover:opacity-100 hover:ring-1 hover:ring-ink/25"
                )}
              >
                <PersonAvatar
                  person={person}
                  size={52}
                  seed={item.seed}
                  features={toFeatures(item)}
                />
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="text-[13px] text-destructive">{error}</p>
        ) : null}

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save avatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
