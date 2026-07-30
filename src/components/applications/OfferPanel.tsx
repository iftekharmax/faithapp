import { useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createOffer, deleteOffer, listOffers, setOfferAcceptance,
  OFFER_TYPE_LABELS, type Offer, type OfferType,
} from "@/lib/ats";
import { supabase } from "@/lib/supabase";

export function OfferPanel({ applicationId }: { applicationId: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    offer_type: "conditional" as OfferType,
    offer_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    deposit_amount: "",
    currency: "USD",
    notes: "",
    file: null as File | null,
  });

  const reload = async () => setOffers(await listOffers(applicationId));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await reload(); } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
    const ch = supabase.channel(`offers-${applicationId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "application_offers", filter: `application_id=eq.${applicationId}` },
      () => reload()).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const submit = async () => {
    setBusy(true);
    try {
      await createOffer({
        application_id: applicationId,
        offer_type: form.offer_type,
        offer_date: form.offer_date,
        expiry_date: form.expiry_date || null,
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
        currency: form.currency,
        notes: form.notes,
        offer_file: form.file,
      });
      setForm({ ...form, notes: "", file: null, deposit_amount: "" });
      toast.success("Offer added");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const accept = async (id: string) => { try { await setOfferAcceptance(id, "accepted"); toast.success("Offer accepted"); } catch (e: any) { toast.error(e.message); } };
  const decline = async (id: string) => { try { await setOfferAcceptance(id, "declined"); toast.success("Offer declined"); } catch (e: any) { toast.error(e.message); } };
  const remove = async (id: string) => { try { await deleteOffer(id); toast.success("Removed"); } catch (e: any) { toast.error(e.message); } };

  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 14;
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add offer</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={form.offer_type} onValueChange={(v) => setForm({ ...form, offer_type: v as OfferType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conditional">Conditional</SelectItem>
                <SelectItem value="unconditional">Unconditional</SelectItem>
                <SelectItem value="reject">Rejection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Offer date</Label>
            <Input type="date" value={form.offer_date} onChange={(e) => setForm({ ...form, offer_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expiry date</Label>
            <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Deposit amount</Label>
              <Input type="number" min="0" step="0.01" value={form.deposit_amount}
                onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Offer letter (optional)</Label>
            <Input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add offer
            </Button>
          </div>
        </CardContent>
      </Card>

      {offers.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No offers yet.</p>
      ) : offers.map((o) => (
        <Card key={o.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={o.offer_type === "reject" ? "destructive" : "default"}>{OFFER_TYPE_LABELS[o.offer_type]}</Badge>
                <Badge variant="outline">{o.acceptance}</Badge>
                {isExpiringSoon(o.expiry_date) && o.acceptance === "pending" && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Expiring soon</Badge>
                )}
              </div>
              <div className="flex gap-2">
                {o.acceptance === "pending" && o.offer_type !== "reject" && (
                  <>
                    <Button size="sm" onClick={() => accept(o.id)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => decline(o.id)}>Decline</Button>
                  </>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><span className="text-muted-foreground">Offer:</span> {o.offer_date}</div>
              <div><span className="text-muted-foreground">Expires:</span> {o.expiry_date ?? "—"}</div>
              <div><span className="text-muted-foreground">Deposit:</span> {o.deposit_amount ? `${o.currency ?? ""} ${o.deposit_amount}` : "—"}</div>
              <div><span className="text-muted-foreground">Accepted:</span> {o.accepted_at ? new Date(o.accepted_at).toLocaleDateString() : "—"}</div>
            </div>
            {o.notes && <p className="rounded bg-muted p-2 text-xs">{o.notes}</p>}
            {o.offer_file_url && (
              <Button asChild size="sm" variant="outline">
                <a href={o.offer_file_url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" /> Offer letter</a>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
