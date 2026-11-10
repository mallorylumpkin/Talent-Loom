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

NOTIF = """<style>
.lock{position:absolute;inset:0;background:linear-gradient(160deg,#2A2140,#16131F)}
.clock{position:absolute;left:0;right:0;top:330px;text-align:center;color:#FAF7F2;font-size:190px;font-weight:800;letter-spacing:-.04em}
.date{position:absolute;left:0;right:0;top:300px;text-align:center;color:#B9B3C6;font-size:40px;font-weight:700}
.note{position:absolute;left:70px;right:70px;top:760px;background:rgba(255,255,255,.94);border-radius:44px;padding:36px 40px;display:flex;gap:28px;align-items:center;opacity:0;animation:drop .45s cubic-bezier(.2,1.4,.4,1) .6s forwards;box-shadow:0 30px 70px rgba(0,0,0,.35)}
@keyframes drop{from{opacity:0;transform:translateY(-120px) scale(.95)}to{opacity:1;transform:none}}
.note .ic{width:110px;height:110px;border-radius:28px;background:#16131F;display:flex;align-items:center;justify-content:center;flex:none}
.note b{display:block;font-size:34px;color:#16131F}.note p{margin:6px 0 0;font-size:34px;color:#16131F;font-weight:600;line-height:1.25}
.note small{font-size:26px;color:#6B6577;font-weight:700;margin-left:auto;align-self:flex-start}
.msg{background:#fff;border:2px solid #E7E1D8;border-radius:30px;padding:30px;margin-top:26px;font-size:30px;line-height:1.4;font-weight:600;animation:slidein .4s both}
.from{display:flex;gap:20px;align-items:center;font-weight:800;font-size:30px}
.from i{width:76px;height:76px;border-radius:20px;background:linear-gradient(135deg,#16131F,#5B3DF5);display:flex;align-items:center;justify-content:center;color:#fff;font-style:normal;font-size:28px}
.glow{box-shadow:0 0 0 6px #5B3DF5,0 20px 50px rgba(91,61,245,.35)!important}
</style>"""

def you_card(i, glow_at=None):
    g = f'animation:slidein .4s {.3 + i*.18:.2f}s forwards,glowon .3s {glow_at}s forwards' if glow_at else f'animation-delay:{.3 + i*.18:.2f}s'
    return (f'<div class="cc" style="{g}"><div class="av" style="background:linear-gradient(135deg,#FF6B57,#5B3DF5)">YOU</div>'
            '<div class="n">You</div><div class="hd">@yourhandle · Skincare</div><div class="cst">31.4K <span>followers</span></div>'
            '<div class="cst">5.6% <span>engagement</span></div><div style="margin-top:12px"><span class="badge" style="font-size:19px">✓ Instagram</span></div></div>')

def scenes2():
    # 0-3.4 "Picture this: an agency finds you. Not the other way around."
    s1 = doc(EXTRA + f'<div class="q"><h1>{words("Picture this: an agency finds|hv you.|hv", .05, .22)}</h1>'
             f'<div style="font-size:54px;font-weight:800;color:var(--mut);margin-top:50px;opacity:0;animation:fadeup .4s 1.8s forwards">Not the other way around.</div></div>', dark=True)
    # 3.4-7.0 "You make your free profile and switch on discoverable."
    s2 = doc(phone("Privacy & discoverability", f'<div class="h">Privacy</div><div class="pbox"><div class="prow" style="border:0">'
             f'<div>Discoverable<div class="sub" style="margin:0">Approved companies can find you</div></div><div class="sw" style="--t:1.4s"></div></div></div>'
             f'<div class="pbox"><div class="prow"><span>Followers & engagement</span><span class="badge" style="margin-left:auto">Public</span></div>'
             f'<div class="prow"><span>Email & phone</span><span class="badge" style="margin-left:auto;background:#F1EEEA;color:#6B6577">Private</span></div></div>',
             "Your profile <span class='hv'>goes live</span>") + cursor(700, 1500, 790, 605, .8, .4))
    # 7.0-10.6 "You connect your accounts, so your stats come straight from the platform."
    tiles = ('<div class="tiles"><div class="tile"><b id="f">0</b><span>Followers</span></div><div class="tile"><b id="v">0</b><span>Avg views</span></div>'
             '<div class="tile"><b id="e">0</b><span>Engagement</span></div></div>')
    s3 = doc(phone("Social accounts", f'<div class="h">Your accounts</div><div class="pbox" style="animation:slidein .4s both"><div class="prow" style="border:0;padding-top:0">'
             f'<div class="dot" style="background:#E1306C">IG</div><div>@yourhandle<div class="sub" style="margin:0">Instagram · Primary</div></div>'
             f'<span class="badge" style="margin-left:auto">✓ Verified</span></div>{tiles}</div>', "Your stats, <span class='hc'>verified</span>"),
             script=counter_js([("f", 31.4, 1, "K", 400, 1400), ("v", 9.2, 1, "K", 600, 1400), ("e", 5.6, 1, "%", 800, 1400)]))
    # 10.6-14.4 "Meanwhile, a management team is searching your niche..."
    fchips = "".join(f'<span class="fchip" style="animation-delay:{1.3 + i*.35:.2f}s">{x}</span>'
                     for i, x in enumerate(["Niche: Skincare", "Followers: 10K–100K", "Not represented"]))
    s4 = doc(phone("Creator search · Example Management", f'<div class="h">Creator search</div><div class="inp" style="margin-top:26px" id="kw"></div><div style="margin-top:10px">{fchips}</div>',
             "Meanwhile, an agency <span class='hv'>searches your niche</span>", example=False)
             + '<div class="ex">Example agency</div>',
             script="var t='skincare';var n=Math.max(0,Math.min(t.length,Math.floor((ms-200)/90)));document.getElementById('kw').textContent=t.slice(0,n)||'Name, handle or headline';document.getElementById('kw').style.color=n?'#16131F':'#9A93A6';")
    # 14.4-18.0 "...and your profile comes up, with numbers they can trust."
    grid = card(CREATORS[2], 0) + you_card(1, 1.3) + card(CREATORS[0], 2) + card(CREATORS[3], 3)
    s5 = doc(NOTIF + '<style>@keyframes glowon{to{box-shadow:0 0 0 6px #5B3DF5,0 20px 50px rgba(91,61,245,.35)}}</style>'
             + phone("Creator search · Example Management", f'<div class="h" style="font-size:40px">12 creators</div><div class="cards">{grid}</div>',
             "There <span class='hc'>you</span> are", example=False) + '<div class="ex">Example agency & creators</div>')
    # 18.0-22.6 "If they're interested, the inquiry comes straight to you."
    s6 = doc(NOTIF + '<div class="lock"></div><div class="date">Tuesday, November 18</div><div class="clock">9:41</div>'
             f'<div class="note"><div class="ic">{mark(INK, 80)}</div><div><b>TalentLoom</b><p>New inquiry from Example Management</p></div><small>now</small></div>'
             '<div class="ex" style="color:#B9B3C6;top:1700px">Example notification</div>', dark=True)
    # 22.6-26.2 "You decide what happens next."
    s7 = doc(NOTIF + phone("Inquiries", '<div class="h">Inquiries</div><div class="msg"><div class="from"><i>EM</i>Example Management<span class="badge" style="margin-left:auto;background:#EEEAFF;color:#4B2FE0">Verified company</span></div>'
             '<p style="margin:22px 0 0">Hi! We came across your profile while scouting skincare creators and would love to set up a call about representation.</p></div>'
             '<div style="display:flex;gap:18px;margin-top:30px"><div class="btn press" style="--t:2.2s;margin:0;font-size:30px;padding:22px 44px">Reply</div>'
             '<div class="btn ghost" style="margin:0;font-size:30px;padding:22px 44px">Not now</div></div>',
             "You decide <span class='hv'>what's next</span>", example=False) + cursor(700, 1500, 250, 985, .8, 1.2) + '<div class="ex">Example inquiry</div>')
    # 26.2-30 "Your creator account is free. Link's in bio."
    s8 = end("Get found. <span class='hv'>Free</span> for creators 18+", "Link in bio")
    return [(s1, 3.4), (s2, 3.6), (s3, 3.6), (s4, 3.8), (s5, 3.6), (s6, 4.6), (s7, 3.6), (s8, 3.8)]

if __name__ == "__main__":
    fo = "frames" in sys.argv
    which = [a for a in sys.argv[1:] if a.startswith("u")] or ["u01", "u02"]
    if "u01" in which: render("u01", scenes(), fo)
    if "u02" in which: render("u02", scenes2(), fo)
