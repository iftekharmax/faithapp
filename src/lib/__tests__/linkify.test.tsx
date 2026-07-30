import { describe, it, expect } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { linkifyText } from "../linkify";

function anchors(nodes: ReactNode[]) {
  return nodes.filter(
    (n): n is React.ReactElement<any> => isValidElement(n) && (n as any).type === "a",
  );
}
function texts(nodes: ReactNode[]) {
  return nodes.filter((n): n is string => typeof n === "string");
}

const WRAP_RE = /break-all/;
const ANY_RE = /overflow-wrap:anywhere/;

describe("linkifyText", () => {
  it("returns empty for empty input", () => {
    expect(linkifyText("")).toEqual([]);
  });

  it("returns plain text unchanged when no links present", () => {
    const out = linkifyText("hello world");
    expect(texts(out).join("")).toBe("hello world");
    expect(anchors(out)).toHaveLength(0);
  });

  it("wraps http URLs in an anchor with break-all + overflow-wrap:anywhere", () => {
    const url = "https://example.com/" + "a".repeat(300);
    const out = linkifyText(`see ${url} end`);
    const [a] = anchors(out);
    expect(a).toBeTruthy();
    expect(a.props.href).toBe(url);
    expect(a.props.target).toBe("_blank");
    expect(a.props.rel).toBe("noopener noreferrer");
    expect(a.props.className).toMatch(WRAP_RE);
    expect(a.props.className).toMatch(ANY_RE);
  });

  it("prefixes bare www. links with https://", () => {
    const out = linkifyText("visit www.example.com now");
    const [a] = anchors(out);
    expect(a.props.href).toBe("https://www.example.com");
  });

  it("renders emails as mailto: without target=_blank", () => {
    const email = "reallylongusername" + "x".repeat(200) + "@example.com";
    const out = linkifyText(`contact ${email} please`);
    const [a] = anchors(out);
    expect(a.props.href).toBe(`mailto:${email}`);
    expect(a.props.target).toBeUndefined();
    expect(a.props.className).toMatch(WRAP_RE);
  });

  it("handles mixed text + multiple links preserving order", () => {
    const out = linkifyText("go to https://a.test then mail x@y.com bye");
    const a = anchors(out);
    expect(a).toHaveLength(2);
    expect(a[0].props.href).toBe("https://a.test");
    expect(a[1].props.href).toBe("mailto:x@y.com");
    const joined = out
      .map((n) =>
        typeof n === "string" ? n : isValidElement(n) ? (n.props as any).children : "",
      )
      .join("");
    expect(joined).toBe("go to https://a.test then mail x@y.com bye");
  });

  it("keeps every anchor wrap-friendly so bubbles never stretch", () => {
    const out = linkifyText(
      "a https://one.test/" + "b".repeat(500) + " and c@d." + "e".repeat(400),
    );
    for (const a of anchors(out)) {
      expect(a.props.className).toMatch(WRAP_RE);
      expect(a.props.className).toMatch(ANY_RE);
    }
  });
});
