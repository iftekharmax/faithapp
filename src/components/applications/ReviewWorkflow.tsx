import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listReviews, upsertReview, REVIEW_STAGES, REVIEW_STAGE_LABELS,
  type Review, type ReviewStage,
} from "@/lib/ats";
import { supabase } from "@/lib/supabase";

export function ReviewWorkflow({ applicationId }: { applicationId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<ReviewStage, string>>({} as any);

  const reload = async () => setReviews(await listReviews(applicationId));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await reload(); } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
    const ch = supabase.channel(`reviews-${applicationId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "application_reviews", filter: `application_id=eq.${applicationId}` },
      () => reload()).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const byStage = useMemo(() => {
    const m = new Map<ReviewStage, Review>();
    reviews.forEach((r) => m.set(r.stage, r));
    return m;
  }, [reviews]);

  const isLocked = (stage: ReviewStage) => {
    const idx = REVIEW_STAGES.indexOf(stage);
    if (idx === 0) return false;
    const prev = byStage.get(REVIEW_STAGES[idx - 1]);
    return prev?.decision !== "approved";
  };

  const submit = async (stage: ReviewStage, decision: Review["decision"]) => {
    try {
      await upsertReview({
        application_id: applicationId,
        stage, decision,
        comments: comments[stage] || undefined,
      });
      toast.success(`Stage ${REVIEW_STAGE_LABELS[stage]} — ${decision}`);
      setComments((c) => ({ ...c, [stage]: "" }));
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {REVIEW_STAGES.map((stage, i) => {
        const r = byStage.get(stage);
        const locked = isLocked(stage);
        return (
          <Card key={stage} className={locked ? "opacity-60" : ""}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {r?.decision === "approved" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                    r?.decision === "rejected" ? <XCircle className="h-5 w-5 text-red-600" /> :
                    locked ? <Lock className="h-5 w-5 text-muted-foreground" /> :
                    <Circle className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <div className="text-sm font-semibold">
                      Stage {i + 1}: {REVIEW_STAGE_LABELS[stage]}
                    </div>
                    {r?.decided_at && (
                      <div className="text-[11px] text-muted-foreground">
                        {r.reviewer_email ?? "—"} · {new Date(r.decided_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                {r && (
                  <Badge
                    variant={r.decision === "approved" ? "default" : r.decision === "rejected" ? "destructive" : "secondary"}
                  >
                    {r.decision.replace("_", " ")}
                  </Badge>
                )}
              </div>
              {r?.comments && <p className="rounded bg-muted p-2 text-xs">{r.comments}</p>}
              {!locked && (
                <>
                  <Textarea
                    rows={2}
                    placeholder="Comments (optional)"
                    value={comments[stage] ?? r?.comments ?? ""}
                    onChange={(e) => setComments((c) => ({ ...c, [stage]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => submit(stage, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => submit(stage, "changes_requested")}>Request changes</Button>
                    <Button size="sm" variant="destructive" onClick={() => submit(stage, "rejected")}>Reject</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
