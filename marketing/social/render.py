"""Render TalentLoom Instagram assets. Usage: python3 render.py [images|stories|reels|frames] [ids...]"""
import html, math, os, re, subprocess, sys
from playwright.sync_api import sync_playwright
from content import FEED, STORIES

OUT = "/home/claude/social/out"
INK, CANVAS, VIOLET, VIOLET_L, CORAL, AMBER, MUTED = "#16131F", "#FAF7F2", "#5B3DF5", "#A99BFF", "#FF6B57", "#FFB547", "#6B6577"

def mark(bg, size):
    r, dx = 30, 18.6
    c1, c2 = 60 - dx, 60 + dx
    h = math.sqrt(r * r - dx * dx); a = math.atan2(-h, dx); s = .42
    P = lambda t: (c1 + r * math.cos(t), 60 + r * math.sin(t))
    def arc(t1, t2):
        p, q = P(t1), P(t2); return f"M{p[0]:.2f},{p[1]:.2f} A30,30 0 0 1 {q[0]:.2f},{q[1]:.2f}"
    return (f'<svg width="{size}" height="{size}" viewBox="10 10 100 100">'
            f'<circle cx="{c1}" cy="60" r="30" fill="none" stroke="{VIOLET}" stroke-width="12"/>'
            f'<circle cx="{c2}" cy="60" r="30" fill="none" stroke="{bg}" stroke-width="19"/>'
            f'<circle cx="{c2}" cy="60" r="30" fill="none" stroke="{CORAL}" stroke-width="12"/>'
            f'<path d="{arc(a-s, a+s)}" fill="none" stroke="{bg}" stroke-width="19"/>'
            f'<path d="{arc(a-s-.12, a+s+.12)}" fill="none" stroke="{VIOLET}" stroke-width="12"/></svg>')

def fmt(text, dark):
    t = html.escape(text)
    t = re.sub(r"\*(.+?)\*", r'<span class="hv">\1</span>', t)
    t = re.sub(r"_(.+?)_", r'<span class="hc">\1</span>', t)
    return t

CSS = """
@font-face{font-family:D;src:local('Inter Display Black'),local('InterDisplay-Black');font-weight:900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:WPX;height:HPX;overflow:hidden}
body{font-family:'Inter Display','Inter',sans-serif;background:var(--bg);color:var(--fg);position:relative;-webkit-font-smoothing:antialiased}
.light{--bg:#FAF7F2;--fg:#16131F;--mut:#6B6577;--hv:#5B3DF5;--card:#fff;--line:#E7E1D8}
.dark{--bg:#16131F;--fg:#FAF7F2;--mut:#B9B3C6;--hv:#A99BFF;--card:#221E2E;--line:#332D42}
.hv{color:var(--hv)} .hc{color:#FF6B57}
.deco{position:absolute;border-radius:50%;border-style:solid;opacity:.10}
.d1{width:760px;height:760px;border-width:90px;border-color:#5B3DF5;right:-330px;top:-300px}
.d2{width:620px;height:620px;border-width:80px;border-color:#FF6B57;left:-300px;bottom:-280px}
.dark .deco{opacity:.16}
.wrap{position:absolute;inset:0;padding:PADpx 96px;display:flex;flex-direction:column}
.foot{position:absolute;left:96px;right:96px;bottom:FOOTpx;display:flex;align-items:center;gap:16px;font-weight:700;font-size:30px}
.foot .h{margin-left:auto;color:var(--mut);font-weight:600}
.count{position:absolute;right:96px;top:TOPpx;font-size:28px;font-weight:700;color:var(--mut)}
.kick{display:inline-block;align-self:flex-start;background:#FF6B57;color:#fff;font-weight:800;font-size:34px;padding:14px 30px;border-radius:999px;letter-spacing:.01em}
.dark .kick{background:#FF6B57}
h1{font-weight:900;letter-spacing:-.035em;line-height:.98}
.big{font-size:132px}.mid{font-size:96px}.sm{font-size:76px}
p.body{font-size:42px;line-height:1.3;color:var(--mut);font-weight:500;margin-top:30px}
.grow{flex:1}
.swipe{font-size:34px;font-weight:700;color:var(--mut);align-self:flex-end}
.num{width:150px;height:150px;border-radius:50%;background:#5B3DF5;color:#fff;font-size:84px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-bottom:56px}
.out{font-size:220px;font-weight:900;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:5px #5B3DF5;line-height:1;margin-bottom:40px}
.dark .out{-webkit-text-stroke-color:#A99BFF}
.pill{display:inline-block;background:#FF6B57;color:#fff;font-weight:800;font-size:44px;padding:26px 52px;border-radius:999px;margin-top:56px;align-self:flex-start}
.card{background:var(--card);border:2px solid var(--line);border-radius:44px;padding:48px;box-shadow:0 30px 80px rgba(22,19,31,.12)}
.who{display:flex;align-items:center;gap:28px}
.av{width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,#5B3DF5,#FF6B57);color:#fff;font-weight:900;font-size:48px;display:flex;align-items:center;justify-content:center}
.nm{font-size:46px;font-weight:800}.hd{font-size:30px;color:var(--mut);font-weight:600;margin-top:6px}
.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:40px}
.st{background:var(--bg);border-radius:28px;padding:28px 24px}
.st b{display:block;font-size:56px;font-weight:900;letter-spacing:-.03em}
.st span{font-size:26px;color:var(--mut);font-weight:600}
.src{margin-top:30px;display:inline-flex;align-items:center;gap:12px;background:#E9FBF4;color:#0B7A55;font-weight:700;font-size:28px;padding:12px 22px;border-radius:999px}
.ex{font-size:24px;color:var(--mut);margin-top:22px;font-weight:600}
.row{display:flex;align-items:center;justify-content:space-between;padding:34px 0;border-bottom:2px solid var(--line);font-size:42px;font-weight:700}
.row:last-child{border:0}
.tag{font-size:30px;font-weight:800;padding:12px 26px;border-radius:999px}
.t1{background:#E9FBF4;color:#0B7A55}.t2{background:#EEEAFF;color:#4B2FE0}.t3{background:#F1EEEA;color:#6B6577}
.chk{display:flex;align-items:center;gap:30px;font-size:44px;font-weight:700;padding:20px 0}
.box{width:62px;height:62px;flex:none;border-radius:18px;background:#5B3DF5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:40px}
.chips{display:flex;flex-wrap:wrap;gap:22px;margin-top:70px}
.chip{font-size:42px;font-weight:800;padding:24px 40px;border-radius:999px;background:var(--card);border:2px solid var(--line)}
.chip.v{background:#5B3DF5;color:#fff;border-color:#5B3DF5}
.qm{font-size:300px;line-height:.6;color:#FF6B57;font-weight:900;height:140px}
"""

def page(w, h, inner, dark=False, pad=110, foot=80, top=80, count=None, extra_css=""):
    css = (CSS.replace("WPX", f"{w}px").replace("HPX", f"{h}px").replace("PADpx", f"{pad}px")
           .replace("FOOTpx", f"{foot}px").replace("TOPpx", f"{top}px"))
    bg = INK if dark else CANVAS
    cnt = f'<div class="count">{count}</div>' if count else ""
    footer = (f'<div class="foot">{mark(bg, 54)}<span>talentloom</span><span class="h">@talentloomhq</span></div>')
    return (f"<!doctype html><html><head><meta charset=utf-8><style>{css}{extra_css}</style></head>"
            f'<body class="{"dark" if dark else "light"}"><div class="deco d1"></div><div class="deco d2"></div>'
            f'{cnt}<div class="wrap">{inner}</div>{footer}</body></html>')

def statcard(label="From Instagram"):
    return (f'<div class="card"><div class="who"><div class="av">YN</div><div><div class="nm">Your Name</div>'
            f'<div class="hd">@yourhandle · Lifestyle</div></div></div>'
            f'<div class="stats"><div class="st"><b>48.2K</b><span>Followers</span></div>'
            f'<div class="st"><b>12.6K</b><span>Avg views</span></div><div class="st"><b>4.1%</b><span>Engagement</span></div></div>'
            f'<div class="src">✓ {label}</div><div class="ex">Example profile</div></div>')

def slide_inner(s, dark):
    t = s["t"]
    lines = lambda txt, cls: "".join(f'<h1 class="{cls}"{" style=\"margin-top:40px;color:var(--mut)\"" if i else ""}>{fmt(x, dark)}</h1>'
                                      for i, x in enumerate(txt.split("|")))
    if t == "cover":
        return (f'<div class="kick">{fmt(s["kicker"], dark)}</div><div class="grow"></div>'
                f'<h1 class="big">{fmt(s["title"], dark)}</h1><div style="height:120px"></div>'
                f'<div class="swipe">Swipe →</div><div style="height:110px"></div>')
    if t == "statement":
        return f'<div class="grow"></div>{lines(s["title"], "mid")}<div class="grow"></div>'
    if t == "quote":
        return f'<div class="grow"></div><div class="qm">“</div><h1 class="big">{fmt(s["title"], dark)}</h1><div class="grow"></div>'
    if t == "step":
        return (f'<div class="grow"></div><div class="num">{s["n"]}</div><h1 class="sm">{fmt(s["title"], dark)}</h1>'
                f'<p class="body">{fmt(s["body"], dark)}</p><div class="grow"></div>')
    if t == "list":
        return (f'<div class="grow"></div><div class="out">{s["n"]}</div><h1 class="sm">{fmt(s["title"], dark)}</h1>'
                f'<p class="body">{fmt(s["body"], dark)}</p><div class="grow"></div>')
    if t == "cta":
        return (f'<div class="grow"></div>{mark(INK, 170)}<h1 class="mid" style="margin-top:60px">{fmt(s["title"], True)}</h1>'
                f'<div class="pill">{fmt(s["body"], True)}</div><div class="grow"></div>')
    if t == "card":
        return f'<h1 class="sm" style="margin-top:40px">{fmt(s["title"], dark)}</h1><div class="grow"></div>{statcard()}<div class="grow"></div>'
    if t == "countdown":
        return (f'<div class="grow"></div><div class="kick" style="font-size:44px">{fmt(s["kicker"], True)}</div>'
                f'<h1 class="big" style="margin-top:50px">{fmt(s["title"], True)}</h1>'
                f'<p class="body">Founding Creator spots open now.</p><div class="grow"></div>')
    if t == "privacy":
        rows = [("Followers & engagement", "Public", "t1"), ("Rates", "Companies only", "t2"),
                ("Email & phone", "Private", "t3"), ("Brand deals", "Companies only", "t2")]
        r = "".join(f'<div class="row"><span>{a}</span><span class="tag {c}">{b}</span></div>' for a, b, c in rows)
        return f'<h1 class="sm" style="margin-top:40px">Field by field.</h1><div class="grow"></div><div class="card" style="padding:20px 48px">{r}</div><div class="grow"></div>'
    if t == "check":
        items = "".join(f'<div class="chk"><div class="box">✓</div><span>{html.escape(i)}</span></div>' for i in s["items"])
        return f'<div class="grow"></div>{items}<div class="grow"></div>'
    if t == "platforms":
        chips = ["Instagram", "TikTok", "YouTube", "Facebook"]
        more = ["LTK", "ShopMy", "Amazon Storefront"]
        c = "".join(f'<div class="chip v">{x}</div>' for x in chips) + "".join(f'<div class="chip">{x}</div>' for x in more)
        return (f'<div class="grow"></div><h1 class="big">{fmt(s["title"], dark)}</h1><div class="chips">{c}</div>'
                f'<p class="body" style="margin-top:50px">Filled chips sync verified stats.</p><div class="grow"></div>')
    raise ValueError(t)

def feed_pages():
    for p in FEED:
        if p["kind"] == "reel":
            continue
        n = len(p["slides"])
        for i, s in enumerate(p["slides"], 1):
            dark = s.get("dark") or s["t"] in ("cta", "countdown")
            yield f'{p["id"]}-{i}', page(1080, 1350, slide_inner(s, dark), dark=dark, count=f"{i}/{n}" if n > 1 else None)

STORY_STYLE = {"hello": (False, "👋"), "tip": (False, None), "ask": (True, None), "warn": (True, "🚩"),
               "count": (True, None), "live": (True, None), "manager": (True, None)}

def story_pages():
    for date, kind, head, body, link in STORIES:
        dark, emoji = STORY_STYLE[kind]
        big = kind in ("count", "live")
        inner = (f'<div style="height:200px"></div>'
                 + (f'<div style="font-size:120px;margin-bottom:30px">{emoji}</div>' if emoji else "")
                 + f'<div class="kick">{html.escape(head)}</div>' * (not big)
                 + (f'<h1 class="big" style="font-size:180px;color:#FF6B57">{html.escape(head)}</h1>' if big else "")
                 + f'<div class="grow"></div><h1 class="mid" style="font-size:{92 if len(body) < 60 else 80}px">{fmt(body, dark)}</h1><div class="grow"></div>'
                 + (f'<div style="height:330px"></div>' if link else '<div style="height:200px"></div>'))
        yield f'story-{date}', page(1080, 1920, inner, dark=dark, foot=150, top=180)

def shoot(items, quality=90):
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        for name, doc in items:
            h = 1350 if not name.startswith("story") else 1920
            pg.set_viewport_size({"width": 1080, "height": h})
            pg.set_content(doc); pg.wait_for_timeout(30)
            pg.screenshot(path=f"{OUT}/{name}.jpg", type="jpeg", quality=quality)
        b.close()

# ---------------------------------------------------------------- Reels
REEL_CSS = """
.ln{font-size:118px;font-weight:900;letter-spacing:-.04em;line-height:1.02;text-align:center;opacity:0;animation:rise .55s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes rise{from{opacity:0;transform:translateY(60px) scale(.96)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.85) translateY(40px)}100%{opacity:1;transform:none}}
@keyframes drift{from{transform:translate(0,0) rotate(0)}to{transform:translate(-60px,50px) rotate(20deg)}}
@keyframes drift2{from{transform:translate(0,0)}to{transform:translate(70px,-60px)}}
.deco.d1{animation:drift 6s linear forwards}.deco.d2{animation:drift2 6s linear forwards}
.stepk{font-size:44px;font-weight:800;background:#5B3DF5;color:#fff;padding:14px 36px;border-radius:999px;align-self:center;opacity:0;animation:rise .45s forwards;margin-bottom:40px}
.pc{opacity:0;animation:pop .6s cubic-bezier(.2,.8,.2,1) .35s forwards;margin-top:70px}
.url{align-self:center;margin-top:60px;background:#FF6B57;color:#fff;font-size:56px;font-weight:800;padding:28px 60px;border-radius:999px;opacity:0;animation:pop .5s .5s forwards}
.bar{position:absolute;left:0;top:0;height:12px;background:#FF6B57}
"""

def reel_scene(sc, k, total, t0, dur):
    dark = sc.get("dark", False)
    lines = sc["lines"]
    if sc.get("step"):
        body = (f'<div class="stepk">{html.escape(lines[0])}</div>'
                f'<div class="ln" style="animation-delay:.15s;font-size:104px">{fmt(lines[1], dark)}</div>')
    elif sc.get("end"):
        body = (f'<div style="align-self:center;opacity:0;animation:pop .5s forwards">{mark(INK if dark else CANVAS, 220)}</div>'
                f'<div class="ln" style="animation-delay:.2s;margin-top:50px">{fmt(lines[0], dark)}</div>'
                f'<div class="url">{html.escape(lines[1])}</div>')
    else:
        body = "".join(f'<div class="ln" style="animation-delay:{.12*i:.2f}s">{fmt(x, dark)}</div>' for i, x in enumerate(lines))
    if sc.get("statcard"):
        body += f'<div class="pc">{statcard()}</div>'
        body = body.replace('class="ln"', 'class="ln" style="font-size:96px"', 1) if False else body
    # progress bar: grows across the whole reel
    if sc.get("instant"):  # hook text fully visible on frame 0 (no fade-in), so the first frame stops the scroll
        css_bar_instant = ".ln,.stepk{opacity:1!important;animation:none!important}"
    else:
        css_bar_instant = ""
    css_bar = css_bar_instant + f"@keyframes bar{{from{{width:{t0/total*100:.2f}%}}to{{width:{(t0+dur)/total*100:.2f}%}}}}.bar{{animation:bar {dur}s linear forwards}}"
    inner = f'<div class="grow" style="max-height:420px"></div>{body}<div class="grow"></div><div style="height:520px"></div>'
    doc = page(1080, 1920, inner, dark=dark, pad=0, foot=150, top=180, extra_css=REEL_CSS + css_bar)
    return doc.replace('<div class="wrap">', '<div class="bar"></div><div class="wrap" style="padding:0 80px;justify-content:center">')

def render_reels(ids=None, frames_only=False):
    os.makedirs(f"{OUT}/tmp", exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        for p in FEED:
            if p["kind"] != "reel" or (ids and p["id"] not in ids):
                continue
            total = sum(s["d"] for s in p["scenes"])
            t0, parts = 0.0, []
            for k, sc in enumerate(p["scenes"]):
                pg.set_content(reel_scene(sc, k, total, t0, sc["d"])); pg.wait_for_timeout(30)
                nfr = round(sc["d"] * 30)
                if frames_only:
                    for f in (nfr - 1,):
                        pg.evaluate(f"document.getAnimations().forEach(a=>{{a.pause();a.currentTime={f*1000/30}}})")
                        pg.screenshot(path=f"{OUT}/tmp/{p['id']}-s{k}.jpg", type="jpeg", quality=80)
                    t0 += sc["d"]; continue
                tmp = f"{OUT}/tmp/{p['id']}-{k}.part.mp4"
                ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg",
                                       "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                                       "-r", "30", "-f", "mp4", tmp], stdin=subprocess.PIPE)
                for f in range(nfr):
                    pg.evaluate(f"document.getAnimations().forEach(a=>{{a.pause();a.currentTime={f*1000/30}}})")
                    ff.stdin.write(pg.screenshot(type="jpeg", quality=92))
                ff.stdin.close()
                if ff.wait() != 0:
                    raise SystemExit("ffmpeg failed")
                os.rename(tmp, tmp.replace(".part.mp4", ".mp4")); parts.append(tmp.replace(".part.mp4", ".mp4"))
                t0 += sc["d"]
            if frames_only:
                continue
            lst = f"{OUT}/tmp/{p['id']}.txt"
            open(lst, "w").write("".join(f"file '{x}'\n" for x in parts))
            final = f"{OUT}/{p['id']}.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-c:v", "copy", "-c:a", "aac",
                            "-shortest", "-movflags", "+faststart", final + ".part.mp4"], check=True)
            os.rename(final + ".part.mp4", final)
            # cover frame for previews
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.5", "-i", final, "-frames:v", "1", "-q:v", "3",
                            f"{OUT}/{p['id']}-cover.jpg"], check=True)
            print("reel", p["id"], f"{total:.1f}s")
        b.close()

if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    ids = sys.argv[2:] or None
    if what in ("images", "all"):
        shoot([x for x in feed_pages() if not ids or x[0].split("-")[0] in ids])
    if what in ("stories", "all"):
        shoot(list(story_pages()))
    if what in ("reels", "all"):
        render_reels(ids)
    if what == "frames":
        render_reels(ids, frames_only=True)
