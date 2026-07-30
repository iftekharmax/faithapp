import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2, Camera, Mail, Phone, MapPin, Briefcase, Globe, Calendar,
  User as UserIcon, FileText, Save, Building2, Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { uploadAvatar, validateAvatarFile, AVATAR_MAX_BYTES } from "@/lib/user-management";
import { PhotoCropDialog } from "@/components/profile/PhotoCropDialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile · Faith AMS" },
      { name: "description", content: "Manage your Faith AMS profile, contact details, and photo." },
    ],
  }),
  component: ProfilePage,
});

interface ExtendedProfile {
  bio: string | null;
  date_of_birth: string | null;
  job_title: string | null;
  department: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  website: string | null;
}

function ProfilePage() {
  const { profile, user, roles, refresh } = useAuth();
  const [form, setForm] = useState({
    full_name: "", phone: "", avatar_url: "",
    bio: "", date_of_birth: "", job_title: "", department: "",
    address: "", city: "", country: "", timezone: "", website: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("bio,date_of_birth,job_title,department,address,city,country,timezone,website")
        .eq("id", user.id).maybeSingle();
      const ext = (data as ExtendedProfile | null) ?? {} as ExtendedProfile;
      setForm({
        full_name: profile?.full_name ?? "",
        phone: profile?.phone ?? "",
        avatar_url: profile?.avatar_url ?? "",
        bio: ext.bio ?? "",
        date_of_birth: ext.date_of_birth ?? "",
        job_title: ext.job_title ?? "",
        department: ext.department ?? "",
        address: ext.address ?? "",
        city: ext.city ?? "",
        country: ext.country ?? "",
        timezone: ext.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
        website: ext.website ?? "",
      });
    })();
  }, [user?.id, profile?.id]);

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onPickPhoto = () => fileRef.current?.click();

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) return toast.error(err);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const onCropped = async (blob: Blob) => {
    if (!user) return;
    if (blob.size > AVATAR_MAX_BYTES) { toast.error("Cropped image is too large."); return; }
    setUploading(true);
    try {
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadAvatar(user.id, file);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      upd("avatar_url", url);
      await refresh();
      setCropSrc(null);
      toast.success("Photo updated");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name || null,
      phone: form.phone || null,
      avatar_url: form.avatar_url || null,
      bio: form.bio || null,
      date_of_birth: form.date_of_birth || null,
      job_title: form.job_title || null,
      department: form.department || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      timezone: form.timezone || null,
      website: form.website || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Profile updated");
  };

  const initials = (() => {
    const name = form.full_name?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return (user?.email ?? "?").slice(0, 2).toUpperCase();
  })();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card shadow-lg">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/30 to-fuchsia-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <div className="relative shrink-0">
            <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl sm:h-28 sm:w-28">
              <AvatarImage
                src={form.avatar_url || undefined}
                alt={form.full_name ? `${form.full_name} profile photo` : "Profile photo"}
              />
              <AvatarFallback
                aria-label={`Initials ${initials}`}
                className="bg-gradient-to-br from-primary to-fuchsia-500 text-2xl font-bold text-primary-foreground"
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={onPickPhoto}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition hover:scale-105 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={uploading ? "Uploading photo" : "Change profile photo"}
              aria-busy={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={onPhoto}
              aria-hidden
              tabIndex={-1}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {form.full_name || "Unnamed user"}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user?.email}
            </p>
            {form.job_title && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> {form.job_title}{form.department ? ` · ${form.department}` : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <Badge key={r} className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                  {ROLE_LABELS[r]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        {/* Personal */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <UserIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Personal information</CardTitle>
                <CardDescription>Your basic profile details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={form.full_name} onChange={(e) => upd("full_name", e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="+880 ..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={form.date_of_birth} onChange={(e) => upd("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bio" className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Bio</Label>
              <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => upd("bio", e.target.value)} placeholder="A short bio about yourself..." maxLength={500} />
              <p className="text-[11px] text-muted-foreground">{form.bio.length}/500</p>
            </div>
          </CardContent>
        </Card>

        {/* Work */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Work</CardTitle>
                <CardDescription>Role and organization</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={form.job_title} onChange={(e) => upd("job_title", e.target.value)} placeholder="e.g. Senior Counselor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Department</Label>
              <Input id="department" value={form.department} onChange={(e) => upd("department", e.target.value)} placeholder="e.g. Admissions" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website" className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Website</Label>
              <Input id="website" type="url" value={form.website} onChange={(e) => upd("website", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone" className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Timezone</Label>
              <Input id="timezone" value={form.timezone} onChange={(e) => upd("timezone", e.target.value)} placeholder="Asia/Dhaka" />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Location</CardTitle>
                <CardDescription>Address details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Street address</Label>
              <Input id="address" value={form.address} onChange={(e) => upd("address", e.target.value)} placeholder="Street, area" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => upd("city", e.target.value)} placeholder="Dhaka" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={(e) => upd("country", e.target.value)} placeholder="Bangladesh" />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/80 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          <Button type="submit" disabled={saving} size="lg" className="min-w-[140px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </form>

      <PhotoCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={() => setCropSrc(null)}
        onCropped={onCropped}
      />
    </div>
  );
}
