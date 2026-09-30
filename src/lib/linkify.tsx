import React from "react";

// Matches URLs (http/https/www) and emails. Kept intentionally simple so the
// regex is fast enough to run on every message render.
const TOKEN_RE = /((?:https?:\/\/|www\.)[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

/**
 * Split a plain-text message into text + link fragments so long URLs / emails
 * can wrap inside a chat bubble instead of forcing the bubble to stretch.
 *
 * Links are rendered with `break-all` + `overflow-wrap: anywhere` so any long
 * unbreakable token (URL, hash, token) wraps at any character.
 */
export function linkifyText(body: string): React.ReactNode[] {
  if (!body) return [];
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE);
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const token = m[0];
    const isEmail = token.includes("@") && !token.startsWith("http") && !token.startsWith("www.");
    const href = isEmail ? `mailto:${token}` : token.startsWith("http") ? token : `https://${token}`;
    out.push(
      <a
        key={`${m.index}-${token}`}
        href={href}
        target={isEmail ? undefined : "_blank"}
        rel={isEmail ? undefined : "noopener noreferrer"}
        className="underline underline-offset-2 break-all [overflow-wrap:anywhere]"
        onClick={(e) => e.stopPropagation()}
      >
        {token}
      </a>,
    );
    last = m.index + token.length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}
