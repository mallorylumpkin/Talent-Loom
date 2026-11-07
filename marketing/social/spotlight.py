"""Weekly Founding Creator Spotlight carousel (5 slides, 1080x1350).
Fill CREATOR below (or pass a JSON file) and run:  python3 spotlight.py [creator.json]
Only use a creator's photo, words and stats with their written OK (see the outreach message in the Marketing Kit)."""
import base64, html, json, os, sys
from render import page, fmt, mark, shoot, INK

CREATOR = {
    "slug": "template",
    "name": "[Creator Name]",
    "handle": "@[handle]",
    "niche": "[Niche] creator · [City, State]",
    "photo": "",                       # path to a square photo they sent you; blank = initials
    "initials": "CN",
    "why": "[In their words: why they joined TalentLoom, one or two sentences.]",
    "platform": "Instagram",           # the connected platform the stats come from
    "stats": [("[48.2K]", "Followers"), ("[12.6K]", "Avg views"), ("[4.1%]", "Engagement")],
    "creates": ["[What they post #1]", "[What they post #2]", "[What they post #3]"],
}

EXTRA = """
.ph{width:420px;height:420px;border-radius:50%;object-fit:cover;border:14px solid #fff;box-shadow:0 30px 70px rgba(22,19,31,.18);
    background:linear-gradient(135deg,#5B3DF5,#FF6B57);color:#fff;font-weight:900;font-size:150px;display:flex;align-items:center;justify-content:center}
.badge2{display:inline-flex;align-items:center;gap:12px;background:#16131F;color:#fff;font-weight:800;font-size:30px;padding:14px 28px;border-radius:999px}
"""

def photo(c):
    if c["photo"] and os.path.exists(c["photo"]):
        b64 = base64.b64encode(open(c["photo"], "rb").read()).decode()
        return f'<img class="ph" src="data:image/jpeg;base64,{b64}">'
    return f'<div class="ph">{html.escape(c["initials"])}</div>'

def slides(c):
    e = html.escape
    yield (f'<div class="kick">Founding Creator Spotlight</div><div class="grow"></div>{photo(c)}'
           f'<h1 class="mid" style="margin-top:56px">Meet <span class="hv">{e(c["handle"])}</span></h1>'
           f'<p class="body">{e(c["niche"])}</p><div class="grow"></div><div class="swipe">Swipe →</div><div style="height:110px"></div>', False)
    yield (f'<div class="grow"></div><div class="qm">“</div><h1 class="sm" style="font-size:68px;line-height:1.1">{e(c["why"])}</h1>'
           f'<p class="body">{e(c["name"])}, {e(c["handle"])}</p><div class="grow"></div>', False)
    tiles = "".join(f'<div class="st"><b>{e(v)}</b><span>{e(k)}</span></div>' for v, k in c["stats"])
    yield (f'<h1 class="sm" style="margin-top:40px">Their numbers, <span class="hv">verified</span></h1><div class="grow"></div>'
           f'<div class="card"><div class="who"><div class="av">{e(c["initials"])}</div><div><div class="nm">{e(c["name"])}</div>'
           f'<div class="hd">{e(c["handle"])} · {e(c["niche"].split("·")[0].strip())}</div></div></div><div class="stats">{tiles}</div>'
           f'<div class="src">✓ From {e(c["platform"])}</div></div><div class="grow"></div>', False)
    items = "".join(f'<div class="chk"><div class="box">✓</div><span>{e(x)}</span></div>' for x in c["creates"])
    yield (f'<h1 class="sm" style="margin-top:40px">What {e(c["name"].split()[0])} creates</h1><div class="grow"></div>{items}<div class="grow"></div>', False)
    yield (f'<div class="grow"></div>{mark(INK, 150)}<h1 class="mid" style="margin-top:50px">Go follow <span class="hc">{e(c["handle"])}</span></h1>'
           f'<p class="body" style="color:#B9B3C6">You don\'t need a million followers to get a manager. Want to be our next Founding Creator?</p>'
           f'<div class="pill">Join free at talentloom.live</div><div class="grow"></div>', True)

if __name__ == "__main__":
    c = dict(CREATOR, **(json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}))
    c["stats"] = [tuple(x) for x in c["stats"]]
    out = list(slides(c))
    shoot([(f'spotlight-{c["slug"]}-{i}', page(1080, 1350, inner, dark=dark, count=f"{i}/{len(out)}", extra_css=EXTRA))
           for i, (inner, dark) in enumerate(out, 1)])
    print("rendered", len(out), "slides")
