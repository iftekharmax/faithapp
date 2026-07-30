#!/usr/bin/env python3
"""Chat bubble UI regression harness.

Renders the same Tailwind classes ChatPanel uses, at 3 viewports, and asserts:
  1. No horizontal scroll on the message thread scroller.
  2. Every bubble stays within 75% of the thread width (+1px tolerance).
  3. Long unbreakable strings, long URLs, long emails all wrap.

Usage:
  python3 scripts/chat-bubble-regression.py [BASE_URL]
BASE_URL is unused for now (self-contained DOM), kept for future auth flows.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/chat-regression"); OUT.mkdir(parents=True, exist_ok=True)

SAMPLES = [
    ("them", "2" * 400),
    ("mine", "A" * 600),
    ("them", "check https://example.com/" + "a" * 300 + "/end"),
    ("mine", "mail me at reallylongusername" + "x" * 200 + "@example.com"),
    ("them", "normal short message"),
    ("mine", "supercalifragilisticexpialidocious" * 20),
]

VIEWPORTS = [
    ("iphone-se", 375, 667),
    ("pixel-7", 412, 915),
    ("desktop", 1280, 900),
]

def html(samples):
    rows = "".join(
        f'''<div class="group flex items-end gap-2 w-full min-w-0 {"justify-end" if who=="mine" else "justify-start"}">
              <div class="relative min-w-0 max-w-[75%] px-3.5 py-2 shadow-sm rounded-2xl [overflow-wrap:anywhere] break-words [word-break:break-word] {"bg-blue-600 text-white" if who=="mine" else "bg-slate-200 text-slate-900"}">
                <p class="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] break-words [word-break:break-word]">{body.replace("<","&lt;")}</p>
              </div>
            </div>'''
        for who, body in samples
    )
    return f"""<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{{margin:0;background:#f8fafc}}</style>
</head><body>
<div id="panel" class="mx-auto flex h-screen w-full max-w-md flex-col border bg-white">
  <div id="scroller" class="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-white to-slate-50">
    <div id="thread" class="p-4 space-y-1 min-w-0 w-full max-w-full overflow-x-hidden">
      {rows}
    </div>
  </div>
</div></body></html>"""

CHECK_JS = r"""() => {
  const thread = document.getElementById('thread');
  const scroller = document.getElementById('scroller');
  const bubbles = Array.from(thread.querySelectorAll('.max-w-\\[75\\%\\]'));
  const tw = thread.getBoundingClientRect().width;
  const cap = tw * 0.75 + 1;
  const wide = bubbles.map((b,i)=>({i, w: b.getBoundingClientRect().width})).filter(x=>x.w > cap);
  return { overflow: scroller.scrollWidth - scroller.clientWidth, threadWidth: tw, cap, wide };
}"""

async def main():
    failures = 0
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name, w, h in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width": w, "height": h})
            page = await ctx.new_page()
            await page.set_content(html(SAMPLES), wait_until="domcontentloaded")
            await page.wait_for_timeout(500)  # Tailwind CDN
            res = await page.evaluate(CHECK_JS)
            path = OUT / f"{name}.png"
            await page.screenshot(path=str(path))
            ok = res["overflow"] <= 1 and not res["wide"]
            print(f"[{name}] {'PASS' if ok else 'FAIL'} overflow={res['overflow']}px thread={res['threadWidth']:.0f}px cap={res['cap']:.0f}px wide={json.dumps(res['wide'])} -> {path}")
            if not ok: failures += 1
            await ctx.close()
        await browser.close()
    if failures:
        print(f"\n{failures} viewport(s) failed.")
        sys.exit(1)
    print("\nAll viewports pass.")

asyncio.run(main())
