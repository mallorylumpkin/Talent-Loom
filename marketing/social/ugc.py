"""u01: 30s 9:16 creator-recruiting video, timed for Mallory's own voiceover (script in marketing/social/u01-script.md).
Usage: python3 ugc.py [frames]"""
import sys
from demos import doc, phone, cursor, counter_js, render, PLAT, card, CREATORS, end
from render import mark, INK

EXTRA = """<style>
.say{position:absolute;left:80px;right:80px;top:300px;font-weight:900;font-size:104px;letter-spacing:-.04em;line-height:1.02}
.say span{opacity:0;display:inline-block;animation:fadeup .35s forwards}
.dm{position:absolute;left:110px;right:110px;top:900px;background:var(--card,#fff);border-radius:48px;padding:44px;box-shadow:0 30px 80px rgba(0,0,0,.25);animation:slidein .45s .2s both}
.dm .t{font-size:40px;font-weight:900;display:flex;align-items:center}
.dm .t b{margin-left:auto;background:#FF6B57;color:#fff;border-radius:999px;font-size:30px;padding:6px 22px}
.dm .r{display:flex;gap:22px;align-items:center;padding:26px 0;border-bottom:2px solid var(--line,#eee);opacity:.35}
.dm .r i{width:84px;height:84px;border-radius:50%;background:var(--line,#ddd)}
.dm .r div{flex:1}.dm .r u{display:block;height:22px;border-radius:11px;background:var(--line,#ddd);margin:8px 0;text-decoration:none}
.empty{font-size:34px;font-weight:800;text-align:center;margin-top:30px;color:var(--mut,#6B6577)}
.chip3{position:absolute;left:90px;right:90px;top:820px;display:grid;gap:34px}
.chip3 div{background:#fff;border-radius:40px;padding:40px 50px;font-size:64px;font-weight:900;color:#16131F;display:flex;align-items:center;gap:30px;opacity:0;animation:slidein .4s forwards;box-shadow:0 20px 50px rgba(22,19,31,.12)}
.chip3 em{font-style:normal;margin-left:auto;font-size:30px;font-weight:800;background:#EEEAFF;color:#4B2FE0;padding:12px 24px;border-radius:999px}
.shot{z-index:3;position:absolute;left:170px;right:170px;top:760px;height:860px;background:#fff;border-radius:40px;transform:rotate(-4deg);box-shadow:0 30px 80px rgba(0,0,0,.3);padding:50px;animation:slidein .4s both}
.shot .bl{height:30px;border-radius:15px;background:#E7E1D8;margin:22px 0}
.shot .bign{all:unset;display:block;font-family:inherit;font-size:100px;font-weight:900;color:#16131F;letter-spacing:-.04em;margin-top:40px}
.stamp{z-index:4;position:absolute;left:230px;top:1280px;transform:rotate(-14deg) scale(1.6);border:12px solid #FF6B57;color:#FF6B57;font-size:96px;font-weight:900;padding:10px 40px;border-radius:24px;opacity:0;animation:stamp .25s 1.3s forwards;background:rgba(255,255,255,.85)}
@keyframes stamp{to{opacity:1;transform:rotate(-14deg) scale(1)}}
.q{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 90px}
.q h1{font-size:118px;line-height:1.02;letter-spacing:-.04em}
.q h1 span{opacity:0;display:inline-block;animation:fadeup .4s forwards}
</style>"""

def words(text, start=.1, step=.16):
    out = []
    for i, w in enumerate(text.split(" ")):
        w, _, cls = w.partition("|")
        out.append(f'<span class="{cls}" style="animation-delay:{start + i*step:.2f}s">{w}</span>')
    return " ".join(out)

def scenes():
    # 1) Hook 0-3.0s: "You're waiting for an agency to slide into your DMs?"
    s1 = doc(EXTRA + f'<div class="say">{words("Waiting for an agency to slide into your DMs?|hc", .05, .14)}</div>'
             '<div class="dm"><div class="t">Message requests<b>0</b></div>'
             + '<div class="r"><i></i><div><u style="width:55%"></u><u style="width:80%"></u></div></div>' * 2
             + '<div class="empty">No new requests</div></div>', dark=True)
    # 2) 3.0-7.8s: "Here's the thing: talent managers scout by numbers they can trust. Followers, views, engagement."
    chips = "".join(f'<div style="animation-delay:{1.6 + i*.55:.2f}s">{n}<em>{t}</em></div>'
                    for i, (n, t) in enumerate([("Followers", "reach"), ("Views", "attention"), ("Engagement", "trust")]))
    s2 = doc(EXTRA + f'<div class="say" style="font-size:92px">{words("Managers scout by numbers|hv they can trust.", .05, .14)}</div>'
             f'<div class="chip3">{chips}</div>')
    # 3) 7.8-10.8s: "And a screenshot proves… nothing."
    s3 = doc(EXTRA + f'<div class="say" style="font-size:96px">{words("A screenshot proves…", .05, .16)}</div>'
             '<div class="shot"><div class="bl" style="width:40%"></div><div class="bign">48.2K</div><div class="bl" style="width:70%"></div>'
             '<div class="bl"></div><div class="bl" style="width:60%"></div><div class="bl" style="width:85%"></div></div>'
             '<div class="stamp">NOTHING</div>', dark=True)
    # 4) 10.8-14.0s: "So what if your stats could prove themselves?"
    s4 = doc(EXTRA + f'<div class="q"><h1>{words("What if your stats could prove|hv themselves?|hv", .05, .2)}</h1></div>', dark=True)
    # 5) 14.0-17.0s: "That's TalentLoom. You connect your Instagram, TikTok, YouTube or Facebook..."
    rows = "".join(f'<div class="prow"><div class="dot" style="background:{c}">{a}</div>{n}'
                   f'<div class="btn{" press" if n=="Instagram" else ""}" style="--t:1.5s">Connect</div></div>' for n, c, a in PLAT)
    s5 = doc(phone("Social accounts", f'<div class="h">Social accounts</div><div class="pbox"><div style="font-size:32px;font-weight:800">Connect for verified numbers</div>'
             f'<div class="sub">Stats come straight from the platform.</div>{rows}</div>', "Connect <span class='hv'>your accounts</span>")
             + cursor(700, 1500, 814, 728, .8, .5))
    # 6) 17.0-20.6s: "...and your stats come straight from the platform."
    tiles = ('<div class="tiles"><div class="tile"><b id="f">0</b><span>Followers</span></div><div class="tile"><b id="v">0</b><span>Avg views</span></div>'
             '<div class="tile"><b id="e">0</b><span>Engagement</span></div></div>')
    s6 = doc(phone("Social accounts", f'<div class="h">Your accounts</div><div class="pbox" style="animation:slidein .4s both"><div class="prow" style="border:0;padding-top:0">'
             f'<div class="dot" style="background:#E1306C">IG</div><div>@yourhandle<div class="sub" style="margin:0">Instagram · Primary</div></div>'
             f'<span class="badge" style="margin-left:auto">✓ Verified</span></div>{tiles}</div>',
             "Straight from <span class='hc'>the platform</span>"),
             script=counter_js([("f", 48.2, 1, "K", 400, 1400), ("v", 12.6, 1, "K", 600, 1400), ("e", 4.1, 1, "%", 800, 1400)]))
    # 7) 20.6-25.0s: "Agencies search by niche and audience size."
    fchips = "".join(f'<span class="fchip" style="animation-delay:{.5 + i*.4:.2f}s">{x}</span>'
                     for i, x in enumerate(["Niche: Beauty", "Platform: Instagram", "Followers: 10K–500K", "Not represented"]))
    grid = "".join(card(c, i) for i, c in enumerate(CREATORS[:2]))
    s7 = doc(phone("Creator search", f'<div class="h">Creator search</div><div style="margin-top:6px">{fchips}</div>'
             f'<div class="cards" style="margin-top:30px">{grid.replace("animation-delay:0.25s", "animation-delay:2.3s").replace("animation-delay:0.43s", "animation-delay:2.5s")}</div>',
             "Agencies search by <span class='hv'>niche</span>") + '<div class="ex">Example creators</div>')
    # 8) 25.0-30.0s: "Your creator account is free. Link's in bio."
    s8 = end("Your creator account is <span class='hv'>free</span>", "Link in bio")
    return [(s1, 3.0), (s2, 4.8), (s3, 3.0), (s4, 3.2), (s5, 3.0), (s6, 3.6), (s7, 4.4), (s8, 5.0)]

if __name__ == "__main__":
    render("u01", scenes(), "frames" in sys.argv)
