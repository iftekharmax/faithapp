import { describe, it, expect } from "vitest";
import { getDocRequestTitle } from "@/components/applications/TimelineEventItem";
import { isDocRequestTransitionAllowed } from "@/lib/document-requests";
import { hasScholarship } from "@/lib/programs";

describe("Timeline Document Event Handling", () => {
  it("formats title correctly according to status", () => {
    expect(getDocRequestTitle("NID", "required")).toBe("Document requested: NID");
    expect(getDocRequestTitle("NID", "pending")).toBe("Document uploaded: NID");
    expect(getDocRequestTitle("NID", "under_review")).toBe("Document under review: NID");
    expect(getDocRequestTitle("NID", "approved")).toBe("Document approved: NID");
    expect(getDocRequestTitle("NID", "rejected")).toBe("Document rejected: NID");
    expect(getDocRequestTitle("NID", "hold")).toBe("Document on hold: NID");
  });

  it("deduplicates timeline events by request_id, keeping only the latest event", () => {
    const rawTimeline = [
      { id: "1", title: "Document approved: NID", metadata: { request_id: "req-nid" }, created_at: "2026-09-30T11:42:41Z" },
      { id: "2", title: "Document uploaded: NID", metadata: { request_id: "req-nid" }, created_at: "2026-09-30T11:41:55Z" },
      { id: "3", title: "Document requested: NID", metadata: { request_id: "req-nid" }, created_at: "2026-09-30T11:41:28Z" },
      { id: "4", title: "Document uploaded: SSC Certificate", metadata: { request_id: "req-ssc" }, created_at: "2026-09-17T15:56:35Z" },
      { id: "5", title: "Document requested: SSC Certificate", metadata: { request_id: "req-ssc" }, created_at: "2026-09-17T15:55:35Z" },
      { id: "6", title: "Status changed", metadata: { from: "draft", to: "under_review" }, created_at: "2026-09-16T17:50:55Z" },
    ];

    const seenRequestIds = new Set<string>();
    const displayed = rawTimeline.filter((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const requestId = typeof meta.request_id === "string" ? meta.request_id : null;
      if (!requestId) return true;
      if (seenRequestIds.has(requestId)) return false;
      seenRequestIds.add(requestId);
      return true;
    });

    expect(displayed).toHaveLength(3);
    expect(displayed.map((e) => e.id)).toEqual(["1", "4", "6"]);
    expect(displayed[0].title).toBe("Document approved: NID");
    expect(displayed[1].title).toBe("Document uploaded: SSC Certificate");
    expect(displayed[2].title).toBe("Status changed");
  });

  it("allows transition from rejected to approved and other valid targets", () => {
    expect(isDocRequestTransitionAllowed("rejected", "approved")).toBe(true);
    expect(isDocRequestTransitionAllowed("rejected", "hold")).toBe(true);
    expect(isDocRequestTransitionAllowed("rejected", "pending")).toBe(true);
    expect(isDocRequestTransitionAllowed("rejected", "under_review")).toBe(true);
    expect(isDocRequestTransitionAllowed("rejected", "required")).toBe(true);
  });

  it("correctly identifies when a scholarship is available or unavailable", () => {
    // Available
    expect(hasScholarship("Scholarship Up to 30%")).toBe(true);
    expect(hasScholarship("<div>£2,500 Postgraduate Scholarship</div>")).toBe(true);
    expect(hasScholarship("36% Discount on Published Tuition Fee")).toBe(true);

    // Unavailable / Empty / Placeholder
    expect(hasScholarship(null)).toBe(false);
    expect(hasScholarship("")).toBe(false);
    expect(hasScholarship("<br>")).toBe(false);
    expect(hasScholarship("Not Specified")).toBe(false);
    expect(hasScholarship("<u>N/A</u>")).toBe(false);
    expect(hasScholarship("None")).toBe(false);
    expect(hasScholarship("No")).toBe(false);
    expect(hasScholarship("Unavailable")).toBe(false);
  });
});
