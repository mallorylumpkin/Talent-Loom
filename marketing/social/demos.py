"""Animated product-demo videos (9:16) for TikTok/Reels. Usage: python3 demos.py [frames] [d01|d02]
Screens mirror the real TalentLoom pages (Social accounts, Creator search); all numbers and creators are labeled examples."""
import html, os, subprocess, sys
from playwright.sync_api import sync_playwright
from render import CSS, mark, statcard, INK, CANVAS, OUT

W, H, FPS = 1080, 1920, 30

BASE = CSS.replace("WPX", f"{W}px").replace("HPX", f"{H}px").replace("PADpx", "0px").replace("FOOTpx", "120px").replace("TOPpx", "0px") + """
.cap{position:absolute;left:70px;right:70px;top:150px;text-align:center;font-weight:900;font-size:64px;letter-spacing:-.03em;line-height:1.05;opacity:0;animation:fadeup .45s .05s forwards}
@keyframes fadeup{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.9)}100%{opacity:1;transform:none}}
@keyframes slidein{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
.phone{position:absolute;left:80px;right:80px;top:360px;height:1300px;background:#FAF7F2;border:14px solid #16131F;border-radius:72px;overflow:hidden;box-shadow:0 40px 90px rgba(22,19,31,.25)}
.bar{height:110px;display:flex;align-items:center;gap:14px;padding:0 40px;border-bottom:2px solid #E7E1D8;font-weight:800;font-size:32px;background:#fff}
.bar .pg{margin-left:auto;color:#6B6577;font-weight:700;font-size:26px}
.scr{padding:36px}
.h{font-size:48px;font-weight:900;letter-spacing:-.03em}
.sub{font-size:24px;color:#6B6577;font-weight:600;margin-top:8px}
.pbox{background:#fff;border:2px solid #E7E1D8;border-radius:30px;padding:28px;margin-top:28px}
.prow{display:flex;align-items:center;gap:20px;padding:20px 0;border-bottom:2px solid #F1EEEA;font-size:30px;font-weight:700}
.prow:last-child{border:0}
.dot{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:26px}
.btn{margin-left:auto;background:#5B3DF5;color:#fff;font-weight:800;font-size:24px;padding:14px 26px;border-radius:999px}
.btn.ghost{background:#EEEAFF;color:#4B2FE0}
.press{animation:press .3s var(--t) both}
@keyframes press{0%{transform:scale(1)}50%{transform:scale(.88)}100%{transform:scale(1)}}
.cursor{position:absolute;width:64px;height:64px;border-radius:50%;background:rgba(255,107,87,.35);border:5px solid #FF6B57;z-index:9;left:var(--x0);top:var(--y0);animation:move var(--d) cubic-bezier(.5,0,.2,1) var(--dl) forwards}
@keyframes move{to{left:var(--x1);top:var(--y1)}}
.sheet{position:absolute;left:0;right:0;bottom:0;height:560px;background:#fff;border-radius:44px 44px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.15);padding:50px;text-align:center;animation:slidein .4s both}
.spin{width:110px;height:110px;margin:30px auto;border-radius:50%;border:12px solid #EEEAFF;border-top-color:#5B3DF5;animation:rot .8s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.ok{font-size:40px;font-weight:900;color:#0B7A55;opacity:0;animation:pop .35s 1.1s forwards}
.tiles{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:22px}
.tile{background:#FAF7F2;border-radius:22px;padding:22px 18px}
.tile b{display:block;font-size:46px;font-weight:900;letter-spacing:-.03em}
.tile span{font-size:21px;color:#6B6577;font-weight:700}
.badge{display:inline-flex;align-items:center;gap:8px;background:#E9FBF4;color:#0B7A55;font-weight:800;font-size:22px;padding:8px 16px;border-radius:999px}
.sw{width:120px;height:68px;border-radius:999px;background:#D9D3CB;position:relative;margin-left:auto;animation:swbg .3s var(--t) forwards}
.sw::after{content:"";position:absolute;left:8px;top:8px;width:52px;height:52px;border-radius:50%;background:#fff;animation:swk .3s var(--t) forwards}
@keyframes swbg{to{background:#0B7A55}}@keyframes swk{to{left:60px}}
.fchip{display:inline-block;font-size:24px;font-weight:800;padding:12px 22px;border-radius:999px;background:#EEEAFF;color:#4B2FE0;margin:8px 8px 0 0;opacity:0;animation:pop .3s forwards}
.inp{border:2px solid #E7E1D8;border-radius:22px;padding:20px 24px;font-size:28px;font-weight:600;background:#fff;color:#16131F;min-height:76px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.cc{background:#fff;border:2px solid #E7E1D8;border-radius:26px;padding:22px;opacity:0;animation:slidein .4s forwards;position:relative}
.cc .av{width:84px;height:84px;font-size:32px}
.cc .n{font-size:28px;font-weight:800;margin-top:14px}.cc .hd{font-size:20px;color:#6B6577;font-weight:600}
.cc .cst{display:flex;gap:14px;margin-top:12px;font-size:22px;font-weight:800}
.cc .cst span{color:#6B6577;font-weight:600}
.tick{position:absolute;right:18px;top:18px;width:44px;height:44px;border-radius:12px;border:3px solid #CFC8BE;background:#fff}
.tick.on{animation:tickon .2s var(--t) forwards}
@keyframes tickon{to{background:#5B3DF5;border-color:#5B3DF5}}
.cmp{width:100%;border-collapse:collapse;font-size:26px;margin-top:20px}.cmp td{padding:18px 10px;border-bottom:2px solid #F1EEEA;font-weight:700}
.cmp td:first-child{color:#6B6577;font-weight:600}
.toast{position:absolute;left:40px;right:40px;bottom:60px;background:#16131F;color:#fff;font-size:30px;font-weight:800;padding:26px;border-radius:24px;text-align:center;opacity:0;animation:slidein .35s var(--t) forwards}
.ex{position:absolute;right:110px;top:1680px;font-size:24px;color:#6B6577;font-weight:700}
.hook{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 90px}
.hook h1{font-size:120px;opacity:0;animation:fadeup .5s forwards}
.end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px}
.url{margin-top:50px;background:#FF6B57;color:#fff;font-size:54px;font-weight:800;padding:26px 56px;border-radius:999px;opacity:0;animation:pop .45s .4s forwards}
"""

def doc(body, dark=False, script=""):
    bg = INK if dark else CANVAS
    return (f"<!doctype html><html><head><meta charset=utf-8><style>{BASE}</style></head>"
            f'<body class="{"dark" if dark else "light"}"><div class="deco d1"></div><div class="deco d2"></div>{body}'
            f'<div class="foot">{mark(bg, 54)}<span>talentloom</span><span class="h">@talentloomhq</span></div>'
            f"<script>window.draw=function(ms){{document.getAnimations().forEach(a=>{{a.pause();a.currentTime=ms}});{script}}}</script></body></html>")

def phone(page, inner, cap, example=True):
    return (f'<div class="cap">{cap}</div><div class="phone"><div class="bar">{mark("#ffffff", 44)}talentloom<span class="pg">{page}</span></div>'
            f'<div class="scr">{inner}</div></div>' + ('<div class="ex">Example account</div>' if example else ""))

def cursor(x0, y0, x1, y1, d=.7, dl=.3):
    return f'<div class="cursor" style="--x0:{x0}px;--y0:{y0}px;--x1:{x1}px;--y1:{y1}px;--d:{d}s;--dl:{dl}s"></div>'

def hook(text):
    return doc(f'<div class="hook"><h1>{text}</h1></div>', dark=True)

def end(title, url):
    return doc(f'<div class="end">{mark(INK, 220)}<h1 class="mid" style="margin-top:50px;opacity:0;animation:fadeup .4s .15s forwards">{title}</h1><div class="url">{url}</div></div>', dark=True)

PLAT = [("Instagram", "#E1306C", "IG"), ("TikTok", "#16131F", "TT"), ("YouTube", "#FF0000", "YT"), ("Facebook", "#1877F2", "FB")]

def counter_js(targets):
    # targets: list of (element id, final value, decimals, suffix, start ms, duration ms)
    lines = []
    for el, v, dec, suf, s, d in targets:
        lines.append(f"(function(){{var p=Math.min(1,Math.max(0,(ms-{s})/{d}));p=1-Math.pow(1-p,3);"
                     f"document.getElementById('{el}').textContent=({v}*p).toFixed({dec})+'{suf}';}})();")
    return "".join(lines)

def creator_demo():
    rows = "".join(f'<div class="prow"><div class="dot" style="background:{c}">{a}</div>{n}'
                   f'<div class="btn{" press" if n=="Instagram" else ""}" style="--t:1.35s">Connect</div></div>' for n, c, a in PLAT)
    s2 = doc(phone("Social accounts", f'<div class="h">Social accounts</div><div class="pbox"><div style="font-size:32px;font-weight:800">Connect for verified numbers</div>'
             f'<div class="sub">Stats come straight from the platform.</div>{rows}</div>', "Tap <span class='hv'>Connect</span>")
             + cursor(700, 1500, 814, 728, .8, .4))
    s3 = doc(phone("Social accounts", f'<div class="h">Social accounts</div><div class="pbox" style="opacity:.4"><div style="font-size:32px;font-weight:800">Connect for verified numbers</div>{rows}</div>'
             f'<div class="sheet"><div style="font-size:36px;font-weight:800">Connecting Instagram…</div><div class="spin"></div><div class="ok">✓ Access approved</div></div>',
             "Approve on <span class='hc'>Instagram</span>"))
    tiles = ('<div class="tiles"><div class="tile"><b id="f">0</b><span>Followers</span></div><div class="tile"><b id="v">0</b><span>Avg views</span></div>'
             '<div class="tile"><b id="e">0</b><span>Engagement</span></div></div>')
    s4 = doc(phone("Social accounts", f'<div class="h">Your accounts</div><div class="pbox" style="animation:slidein .4s both"><div class="prow" style="border:0;padding-top:0">'
             f'<div class="dot" style="background:#E1306C">IG</div><div>@yourhandle<div class="sub" style="margin:0">Instagram · Primary</div></div>'
             f'<span class="badge" style="margin-left:auto">✓ Verified</span></div>{tiles}</div>'
             f'<div class="pbox" style="opacity:0;animation:slidein .4s 2.2s forwards"><div style="font-size:28px;font-weight:800">Synced just now</div>'
             f'<div class="sub">Refreshes every day while connected.</div></div>', "Your real stats <span class='hv'>fill in</span>"),
             script=counter_js([("f", 48.2, 1, "K", 500, 1400), ("v", 12.6, 1, "K", 700, 1400), ("e", 4.1, 1, "%", 900, 1400)]))
    s5 = doc(phone("Your profile", f'<div class="h">Your profile</div><div style="margin-top:26px;animation:slidein .4s both">{statcard()}</div>',
             "Labeled so managers <span class='hv'>trust it</span>"))
    s6 = doc(phone("Privacy & discoverability", f'<div class="h">Privacy</div><div class="pbox"><div class="prow" style="border:0">'
             f'<div>Discoverable<div class="sub" style="margin:0">Approved companies can find you</div></div><div class="sw" style="--t:1.1s"></div></div></div>'
             f'<div class="pbox"><div class="prow"><span>Followers & engagement</span><span class="badge" style="margin-left:auto">Public</span></div>'
             f'<div class="prow"><span>Rates</span><span class="badge" style="margin-left:auto;background:#EEEAFF;color:#4B2FE0">Companies only</span></div>'
             f'<div class="prow"><span>Email & phone</span><span class="badge" style="margin-left:auto;background:#F1EEEA;color:#6B6577">Private</span></div></div>',
             "Go live <span class='hc'>when you're ready</span>") + cursor(700, 1500, 790, 605, .7, .3))
    return [(hook("Watch my stats<br><span class='hv'>fill in</span> by<br>themselves"), 2.2), (s2, 3.0), (s3, 2.2), (s4, 4.0), (s5, 3.0), (s6, 3.2),
            (end("Get found by real management teams", "talentloom.live"), 2.8)]

CREATORS = [("MR", "Maya R.", "@mayamakes", "48.2K", "5.3%", "#5B3DF5,#FF6B57"), ("JT", "Jess T.", "@jessglow", "112K", "4.8%", "#FF6B57,#FFB547"),
            ("AL", "Ava L.", "@avabeauty", "27.9K", "6.1%", "#2EC4A0,#5B3DF5"), ("KS", "Kai S.", "@kaiskin", "64.5K", "4.2%", "#16131F,#5B3DF5")]

def card(c, i, tick=None, static=False):
    ini, n, h, f, e, g = c
    t = (f'<div class="tick{" on" if tick else ""}" style="--t:{tick or 0}s"></div>') if static else ""
    st = "opacity:1;animation:none" if static else f"animation-delay:{.25 + i*.18:.2f}s"
    return (f'<div class="cc" style="{st}">{t}<div class="av" style="background:linear-gradient(135deg,{g})">{ini}</div>'
            f'<div class="n">{n}</div><div class="hd">{h} · Beauty</div><div class="cst">{f} <span>followers</span></div>'
            f'<div class="cst">{e} <span>engagement</span></div><div style="margin-top:12px"><span class="badge" style="font-size:19px">✓ Instagram</span></div></div>')

def company_demo():
    chips = "".join(f'<span class="fchip" style="animation-delay:{.9 + i*.35:.2f}s">{x}</span>'
                    for i, x in enumerate(["Niche: Beauty", "Platform: Instagram", "Followers: 10K–500K", "Not represented"]))
    s2 = doc(phone("Creator search", f'<div class="h">Creator search</div><div class="sub">Only creators who\'ve chosen to be discoverable appear here.</div>'
             f'<div class="inp" style="margin-top:26px" id="kw"></div><div style="margin-top:10px">{chips}</div>',
             "Filter by <span class='hv'>niche</span> and audience", example=False),
             script="var t='skincare';var n=Math.max(0,Math.min(t.length,Math.floor((ms-200)/90)));document.getElementById('kw').textContent=t.slice(0,n)||'Name, handle or headline';document.getElementById('kw').style.color=n?'#16131F':'#9A93A6';")
    grid = "".join(card(c, i) for i, c in enumerate(CREATORS))
    s3 = doc(phone("Creator search", f'<div style="display:flex;align-items:center"><div class="h" style="font-size:40px">24 creators</div>'
             f'<span class="badge" style="margin-left:auto;background:#EEEAFF;color:#4B2FE0">Sort: Highest engagement</span></div><div class="cards">{grid}</div>',
             "Stats pulled from <span class='hc'>their accounts</span>", example=False) + '<div class="ex">Example creators</div>')
    grid2 = "".join(card(c, i, tick={0: 0.8, 2: 1.7}.get(i), static=True) for i, c in enumerate(CREATORS))
    s4 = doc(phone("Creator search", f'<div style="display:flex;align-items:center"><div class="h" style="font-size:40px">24 creators</div>'
             f'<div class="btn press" style="--t:2.3s">Compare selected (2)</div></div><div class="cards">{grid2}</div>',
             "Shortlist and <span class='hv'>compare</span>", example=False)
             + cursor(500, 1500, 458, 609, .5, .3) + '<div class="ex">Example creators</div>'
             + '<style>.cursor{animation:move .5s .3s forwards,move2 .5s 1.2s forwards,move3 .45s 1.9s forwards}'
               '@keyframes move2{to{left:454px;top:962px}}@keyframes move3{to{left:760px;top:515px}}</style>')
    s5 = doc(phone("Compare", f'<div class="h">Compare</div><table class="cmp" style="animation:slidein .4s both">'
             f'<tr><td></td><td>Maya R.</td><td>Ava L.</td></tr><tr><td>Followers</td><td>48.2K</td><td>27.9K</td></tr>'
             f'<tr><td>Avg views</td><td>12.6K</td><td>9.8K</td></tr><tr><td>Engagement</td><td>5.3%</td><td>6.1%</td></tr>'
             f'<tr><td>Representation</td><td>Open</td><td>Open</td></tr></table>'
             f'<div class="btn press" style="--t:1.9s;display:inline-block;margin-top:40px;font-size:30px;padding:22px 40px">Send inquiry to Ava</div>'
             f'<div class="toast" style="--t:2.3s">✓ Inquiry sent</div>',
             "Reach out <span class='hc'>in the app</span>", example=False) + cursor(500, 1500, 274, 991, .6, 1.1) + '<div class="ex">Example creators</div>')
    return [(hook("POV: you're a<br>talent manager<br><span class='hc'>scouting</span> creators"), 2.4), (s2, 3.4), (s3, 3.2), (s4, 3.0), (s5, 3.2),
            (end("Scout with real numbers", "talentloom.live/for-companies"), 2.8)]

def render(name, scenes, frames_only=False):
    os.makedirs(f"{OUT}/tmp", exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={"width": W, "height": H})
        parts = []
        for k, (d, dur) in enumerate(scenes):
            pg.set_content(d); pg.wait_for_timeout(40)
            n = round(dur * FPS)
            if frames_only:
                for f in (int(n * .6), n - 1):
                    pg.evaluate(f"draw({f*1000/FPS})"); pg.screenshot(path=f"{OUT}/tmp/{name}-s{k}-{f}.jpg", type="jpeg", quality=80)
                continue
            tmp = f"{OUT}/tmp/{name}-{k}.part.mp4"
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS), "-f", "mp4", tmp], stdin=subprocess.PIPE)
            for f in range(n):
                pg.evaluate(f"draw({f*1000/FPS})"); ff.stdin.write(pg.screenshot(type="jpeg", quality=92))
            ff.stdin.close()
            if ff.wait(): raise SystemExit("ffmpeg failed")
            os.rename(tmp, tmp.replace(".part", "")); parts.append(tmp.replace(".part", ""))
        b.close()
    if frames_only: return
    lst = f"{OUT}/tmp/{name}.txt"; open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    final = f"{OUT}/{name}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart", final + ".part.mp4"], check=True)
    os.rename(final + ".part.mp4", final)
    print(name, sum(s for _, s in scenes), "s")

if __name__ == "__main__":
    fo = "frames" in sys.argv
    which = [a for a in sys.argv[1:] if a.startswith("d")] or ["d01", "d02"]
    if "d01" in which: render("d01", creator_demo(), fo)
    if "d02" in which: render("d02", company_demo(), fo)
