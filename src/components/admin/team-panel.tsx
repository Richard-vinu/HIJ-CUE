"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  TagsIcon,
  XIcon,
} from "lucide-react";
import {
  addPerson,
  createRoleOption,
  deleteRoleOption,
  removePerson,
  setPersonAdmin,
  updateBannerMessage,
  updatePersonRole,
} from "@/actions/cue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PersonAvatar } from "@/components/person-avatar";
import { EventMarquee } from "@/components/event-marquee";
import { DEFAULT_BANNER_MESSAGE } from "@/lib/banner-store";
import {
  ROLE_GROUPS,
  normalizeRole,
  roleGroupFor,
  type RoleGroupId,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { isSuperAdmin, type Person } from "@/lib/types";

type TeamView = "list" | "roles";

function RoleEditor({
  person,
  roleOptions,
  pending,
  onSave,
}: {
  person: Person;
  roleOptions: string[];
  pending: boolean;
  onSave: (role: string) => void;
}) {
  const current = normalizeRole(person.role);
  const options = useMemo(() => {
    const list = [...roleOptions];
    if (current && !list.some((r) => r.toLowerCase() === current.toLowerCase())) {
      list.unshift(current);
    }
    return list;
  }, [roleOptions, current]);

  if (!options.length) {
    return (
      <p className="text-[12.5px] text-ink-2">
        No roles yet — open Manage roles to add some.
      </p>
    );
  }

  return (
    <Select
      value={current || "__none__"}
      disabled={pending}
      onValueChange={(v) => {
        const next = v === "__none__" ? "" : v;
        if (next === current) return;
        onSave(next);
      }}
    >
      <SelectTrigger
        className="glass-surface h-9 w-full min-w-[10rem]"
        aria-label={`Role for ${person.name}`}
      >
        <SelectValue placeholder="Pick a role" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="__none__">No role</SelectItem>
          {options.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function AdminToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#101729] dark:bg-white" : "bg-ink/20",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform dark:bg-[#101729]",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

export function AdminTeamPanel({
  people,
  me,
  bannerMessage,
  roleOptions: initialRoleOptions,
}: {
  people: Person[];
  me: Person;
  bannerMessage: string;
  roleOptions: string[];
}) {
  const router = useRouter();
  const superAdmin = isSuperAdmin(me);
  const [view, setView] = useState<TeamView>("roles");
  const [sortByRole, setSortByRole] = useState(false);
  const [open, setOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [bannerDraft, setBannerDraft] = useState(bannerMessage);
  const [bannerSource, setBannerSource] = useState(bannerMessage);
  const [formError, setFormError] = useState("");
  const [newRole, setNewRole] = useState("");
  const [roleOptions, setRoleOptions] = useState(initialRoleOptions);
  const [rolesSource, setRolesSource] = useState(initialRoleOptions);
  const [pending, startTransition] = useTransition();

  if (bannerMessage !== bannerSource) {
    setBannerSource(bannerMessage);
    setBannerDraft(bannerMessage);
  }
  if (initialRoleOptions !== rolesSource) {
    setRolesSource(initialRoleOptions);
    setRoleOptions(initialRoleOptions);
  }

  const unsetCount = people.filter((p) => !normalizeRole(p.role)).length;
  const admins = useMemo(
    () => people.filter((p) => p.is_admin),
    [people]
  );

  const sortedPeople = useMemo(() => {
    const list = [...people];
    if (!sortByRole) {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => {
      const ra = normalizeRole(a.role) || "zzz";
      const rb = normalizeRole(b.role) || "zzz";
      const cmp = ra.localeCompare(rb);
      return cmp || a.name.localeCompare(b.name);
    });
  }, [people, sortByRole]);

  const grouped = useMemo(() => {
    const buckets = new Map<RoleGroupId, Person[]>();
    for (const g of ROLE_GROUPS) buckets.set(g.id, []);
    for (const p of people) {
      const id = roleGroupFor(p.role);
      buckets.get(id)!.push(p);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return ROLE_GROUPS.map((g) => ({
      ...g,
      people: buckets.get(g.id) ?? [],
    })).filter((g) => g.people.length > 0 || g.id === "none");
  }, [people]);

  function onAdd() {
    setFormError("");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setFormError("Enter a name.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setFormError("Enter a valid email address.");
      return;
    }
    startTransition(async () => {
      const res = await addPerson({
        name: trimmedName,
        email: trimmedEmail,
        is_admin: superAdmin ? isAdmin : false,
        role,
      });
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Person added");
      if ("tempPassword" in res && res.tempPassword) {
        toast.message("Admin login created", {
          description: `Password: ${res.tempPassword}`,
          duration: 20000,
        });
      }
      setOpen(false);
      setName("");
      setEmail("");
      setRole("");
      setIsAdmin(false);
      setFormError("");
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

  function onSaveRole(personId: string, nextRole: string) {
    startTransition(async () => {
      const res = await updatePersonRole(personId, nextRole);
      if (res.error) toast.error(res.error);
      else {
        toast.success(normalizeRole(nextRole) ? "Role updated" : "Role cleared");
        router.refresh();
      }
    });
  }

  function onCreateRole() {
    const clean = newRole.trim();
    if (!clean) {
      toast.error("Enter a role name.");
      return;
    }
    startTransition(async () => {
      const res = await createRoleOption(clean);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.roles) setRoleOptions(res.roles);
      setNewRole("");
      toast.success(`Added “${clean}”`);
      router.refresh();
    });
  }

  function onDeleteRole(roleName: string) {
    if (!confirm(`Remove “${roleName}” from the role list? People keep their current role.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteRoleOption(roleName);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.roles) setRoleOptions(res.roles);
      toast.success("Role removed from list");
      router.refresh();
    });
  }

  function onToggleAdmin(person: Person, next: boolean) {
    if (!superAdmin) return;
    startTransition(async () => {
      const res = await setPersonAdmin(person.id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? `${person.name} is now an admin` : "Admin access removed");
      if ("tempPassword" in res && res.tempPassword) {
        toast.message("Admin login created", {
          description: `Password: ${res.tempPassword}`,
          duration: 20000,
        });
      }
      router.refresh();
    });
  }

  function onSaveBanner(message = bannerDraft) {
    startTransition(async () => {
      const res = await updateBannerMessage(message);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBannerDraft(message.trim() || DEFAULT_BANNER_MESSAGE);
      toast.success("Banner updated");
      router.refresh();
    });
  }

  function canRemove(p: Person) {
    if (p.id === me.id) return false;
    if (isSuperAdmin(p)) return false;
    if (p.is_admin && !superAdmin) return false;
    return true;
  }

  function canToggleAdmin(p: Person) {
    if (!superAdmin) return false;
    if (p.id === me.id) return false;
    if (isSuperAdmin(p)) return false;
    return true;
  }

  return (
    <>
      <div className="mx-auto max-w-[1100px] pb-24 lg:pb-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[24px] font-medium tracking-[-0.02em] text-ink md:text-[28px]">
              Team
            </h1>
            <p className="mt-1 font-mono text-[12px] text-ink-2">
              {people.length} people · {admins.length} admin
              {admins.length === 1 ? "" : "s"}
              {unsetCount
                ? ` · ${unsetCount} role${unsetCount === 1 ? "" : "s"} still to set`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="glass-segment flex rounded-[12px] p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px]",
                  view === "list"
                    ? "glass-pill-active font-medium"
                    : "text-ink-2"
                )}
              >
                <ListIcon className="size-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setView("roles")}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px]",
                  view === "roles"
                    ? "glass-pill-active font-medium"
                    : "text-ink-2"
                )}
              >
                <LayoutGridIcon className="size-3.5" />
                By role
              </button>
            </div>
            {view === "list" ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-[12px]"
                onClick={() => setSortByRole((v) => !v)}
              >
                {sortByRole ? "Sort by name" : "Sort by role"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="hidden h-9 rounded-[12px] lg:inline-flex"
              onClick={() => setRolesOpen(true)}
            >
              <TagsIcon className="size-3.5" />
              Manage roles
              {roleOptions.length ? (
                <span className="font-mono text-[11px] text-ink-2">
                  {roleOptions.length}
                </span>
              ) : null}
            </Button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setOpen(true);
              }}
              className="glass-cta hidden h-9 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[13px] font-medium transition-opacity hover:opacity-95 lg:inline-flex"
            >
              <PlusIcon className="size-4" />
              Add person
            </button>
          </div>
        </div>

        <div className="glass-panel mb-5 space-y-3 p-4 md:p-5">
          <div>
            <div className="text-[15px] font-medium text-ink">Banner message</div>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Scrolls on the team home page (My tasks / All tasks).
            </p>
          </div>
          <EventMarquee message={bannerDraft || DEFAULT_BANNER_MESSAGE} />
          <Field>
            <FieldLabel htmlFor="banner-msg">Message</FieldLabel>
            <Input
              id="banner-msg"
              value={bannerDraft}
              onChange={(e) => setBannerDraft(e.target.value)}
              maxLength={200}
              className="glass-surface"
              placeholder={DEFAULT_BANNER_MESSAGE}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-[12px]"
              disabled={pending || !bannerDraft.trim()}
              onClick={() => onSaveBanner()}
            >
              Save banner
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-[12px]"
              disabled={pending}
              onClick={() => {
                setBannerDraft(DEFAULT_BANNER_MESSAGE);
                onSaveBanner(DEFAULT_BANNER_MESSAGE);
              }}
            >
              Reset to default
            </Button>
          </div>
        </div>

        {!people.length ? (
          <div className="glass-panel px-6 py-14 text-center">
            <p className="text-[15px] font-medium text-ink">No one on the team yet</p>
            <p className="mt-1.5 text-[13px] text-ink-2">
              Add the first person so tasks can be assigned.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="glass-panel overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(7rem,9rem)_4.5rem_2.5rem] gap-3 border-b-[0.5px] border-ink/10 px-4 py-2.5 font-mono text-[11px] tracking-[0.04em] text-ink-2 uppercase md:grid">
              <span>Person</span>
              <span>Email</span>
              <span>Role</span>
              <span>Admin</span>
              <span />
            </div>
            {sortedPeople.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "grid grid-cols-1 gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(7rem,9rem)_4.5rem_2.5rem] md:items-center",
                  i < sortedPeople.length - 1 && "border-b-[0.5px] border-ink/10"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar person={p} size={40} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[15px] font-medium text-ink">
                        {p.name}
                      </span>
                      {isSuperAdmin(p) ? (
                        <span className="rounded-full bg-[#101729] px-1.5 py-0.5 font-mono text-[10px] text-white dark:bg-white dark:text-[#101729]">
                          super admin
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 md:hidden">
                      <div className="truncate font-mono text-xs text-ink-2">
                        {p.email}
                      </div>
                      <div className="mt-1.5">
                        <RoleEditor
                          person={p}
                          roleOptions={roleOptions}
                          pending={pending}
                          onSave={(r) => onSaveRole(p.id, r)}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-2">
                        <span>Admin</span>
                        <AdminToggle
                          checked={p.is_admin}
                          disabled={!canToggleAdmin(p) || pending}
                          onChange={(next) => onToggleAdmin(p, next)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden min-w-0 truncate font-mono text-[13px] text-ink-2 md:block">
                  {p.email}
                </div>
                <div className="hidden md:block">
                  <RoleEditor
                    person={p}
                    roleOptions={roleOptions}
                    pending={pending}
                    onSave={(r) => onSaveRole(p.id, r)}
                  />
                </div>
                <div className="hidden md:flex md:justify-start">
                  <AdminToggle
                    checked={p.is_admin}
                    disabled={!canToggleAdmin(p) || pending}
                    onChange={(next) => onToggleAdmin(p, next)}
                  />
                </div>
                <div className="flex justify-end md:justify-center">
                  {canRemove(p) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${p.name}`}
                      disabled={pending}
                      onClick={() => onRemove(p.id)}
                      className="text-ink-2 hover:text-late"
                    >
                      <XIcon />
                    </Button>
                  ) : (
                    <span className="size-9" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
            <div className="grid gap-4 sm:grid-cols-2">
              {grouped.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "glass-panel overflow-hidden",
                    g.id === "none" && "border-late/25 bg-late/[0.06]"
                  )}
                >
                  <div
                    className={cn(
                      "border-b-[0.5px] px-4 py-2.5 font-mono text-[11px] tracking-[0.06em] uppercase",
                      g.id === "none"
                        ? "border-late/20 text-late"
                        : "border-ink/10 text-ink-2"
                    )}
                  >
                    {g.label}
                    <span className="ml-2 opacity-70">{g.people.length}</span>
                  </div>
                  {g.people.length === 0 ? (
                    <p className="px-4 py-6 text-[13px] text-ink-2">
                      Everyone has a role set.
                    </p>
                  ) : (
                    g.people.map((p, i) => (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3",
                          i < g.people.length - 1 &&
                            "border-b-[0.5px] border-ink/10"
                        )}
                      >
                        <PersonAvatar person={p} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[14.5px] font-medium text-ink">
                            {p.name}
                          </div>
                          <div className="mt-1">
                            <RoleEditor
                              person={p}
                              roleOptions={roleOptions}
                              pending={pending}
                              onSave={(r) => onSaveRole(p.id, r)}
                            />
                          </div>
                        </div>
                        {canRemove(p) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${p.name}`}
                            disabled={pending}
                            onClick={() => onRemove(p.id)}
                            className="shrink-0 text-ink-2 hover:text-late"
                          >
                            <XIcon />
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>

            <aside className="space-y-4">
              <div className="glass-panel overflow-hidden">
                <div className="border-b-[0.5px] border-ink/10 px-4 py-2.5 font-mono text-[11px] tracking-[0.06em] text-ink-2 uppercase">
                  Admins
                </div>
                {admins.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i < admins.length - 1 && "border-b-[0.5px] border-ink/10"
                    )}
                  >
                    <PersonAvatar person={p} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">
                        {p.name}
                      </div>
                      {isSuperAdmin(p) ? (
                        <div className="font-mono text-[10px] text-ink-2">
                          super admin
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div className="p-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full rounded-[12px]"
                    onClick={() => setView("list")}
                  >
                    Manage admins
                  </Button>
                </div>
              </div>
              <div className="rounded-[14px] border border-dashed border-ink/15 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
                Use Manage roles to edit the dropdown list, then assign from each
                person’s role field.
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-[12px] lg:hidden"
                onClick={() => setRolesOpen(true)}
              >
                <TagsIcon className="size-3.5" />
                Manage roles
              </Button>
            </aside>
          </div>
        )}
      </div>

      <div className="glass-bar fixed right-0 bottom-0 left-0 z-30 border-t-[0.5px] border-ink/10 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-[14px]"
            onClick={() => setRolesOpen(true)}
          >
            <TagsIcon className="size-4" />
            Roles
          </Button>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setOpen(true);
            }}
            className="glass-cta flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-[14px] text-[16px] font-medium tracking-[-0.01em]"
          >
            <PlusIcon className="size-[18px]" />
            Add person
          </button>
        </div>
      </div>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="border-white/60 bg-background/90 backdrop-blur-xl sm:max-w-md sm:rounded-[22px] dark:border-white/10">
          <DialogHeader>
            <DialogTitle>Manage roles</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-ink-2">
            Roles you add here show up in the dropdown when assigning people.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreateRole();
                }
              }}
              maxLength={80}
              className="glass-surface min-w-[10rem] flex-1"
              placeholder="e.g. ProPresenter"
              aria-label="New role name"
            />
            <Button
              type="button"
              className="rounded-[12px]"
              disabled={pending || !newRole.trim()}
              onClick={() => onCreateRole()}
            >
              Add role
            </Button>
          </div>
          {roleOptions.length ? (
            <ul className="flex max-h-[min(50vh,22rem)] flex-wrap gap-2 overflow-y-auto py-1">
              {roleOptions.map((r) => (
                <li
                  key={r}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.03] py-1 pr-1 pl-2.5 text-[13px] text-ink"
                >
                  <span>{r}</span>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${r}`}
                    onClick={() => onDeleteRole(r)}
                    className="inline-flex size-6 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-late/15 hover:text-late"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">No roles yet — add one above.</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRolesOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFormError("");
        }}
      >
        <DialogContent className="border-white/60 bg-background/90 backdrop-blur-xl sm:rounded-[22px] dark:border-white/10">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!formError || undefined}>
              <FieldLabel htmlFor="np-name">Name</FieldLabel>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-surface"
                placeholder="Full name"
                autoComplete="name"
              />
            </Field>
            <Field data-invalid={!!formError || undefined}>
              <FieldLabel htmlFor="np-email">Email</FieldLabel>
              <Input
                id="np-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-surface"
                placeholder="name@hij.com"
                autoComplete="email"
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              {roleOptions.length ? (
                <Select
                  value={role || "__none__"}
                  onValueChange={(v) =>
                    setRole(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger id="np-role" className="glass-surface w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__none__">No role</SelectItem>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[13px] text-ink-2">
                  Add roles via Manage roles first.
                </p>
              )}
            </Field>
            {formError ? (
              <p className="text-[13px] text-destructive">{formError}</p>
            ) : null}
            {superAdmin ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                />
                Admin (can sign in to /admin)
              </label>
            ) : (
              <p className="text-[13px] text-ink-2">
                Only the super admin can grant admin access.
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-[14px]"
              disabled={pending}
              onClick={onAdd}
            >
              {pending ? "Adding…" : "Add person"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
