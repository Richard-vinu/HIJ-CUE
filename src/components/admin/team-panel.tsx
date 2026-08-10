"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { addPerson, removePerson } from "@/actions/cue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import type { Person } from "@/lib/types";

export function AdminTeamPanel({
  people,
  meId,
}: {
  people: Person[];
  meId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, startTransition] = useTransition();

  function onAdd() {
    startTransition(async () => {
      const res = await addPerson({ name, email, is_admin: isAdmin });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Person added");
      setOpen(false);
      setName("");
      setEmail("");
      setIsAdmin(false);
      router.refresh();
    });
  }

  function onRemove(id: string) {
    if (!confirm("Remove this person?")) return;
    startTransition(async () => {
      const res = await removePerson(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Removed");
        router.refresh();
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-structure bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-structure px-3.5 py-3">
        <div className="font-mono text-[11px] text-ink-2">
          {people.length} people · you are an admin
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Add person
        </Button>
      </div>

      {people.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 border-b border-structure px-3.5 py-2.5"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-structure bg-page font-mono text-xs text-ink-2">
            {initials(p.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-medium">{p.name}</span>
              {p.is_admin ? (
                <Badge variant="outline" className="font-mono text-[10.5px]">
                  admin
                </Badge>
              ) : null}
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-ink-2">
              {p.email}
            </div>
          </div>
          {p.id !== meId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove person"
              disabled={pending}
              onClick={() => onRemove(p.id)}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="np-name">Name</FieldLabel>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="np-email">Email</FieldLabel>
              <Input
                id="np-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              Admin (can sign in to /admin)
            </label>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={onAdd}>
              Add person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
