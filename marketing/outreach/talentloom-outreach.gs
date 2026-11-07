/**
 * TalentLoom agency outreach: a free, automatic 3-email sequence that runs in your own Google account.
 *
 * SETUP (one time, about 5 minutes):
 *  1. Signed in as mallory@talentloom.live, create a blank Google Sheet (sheets.new).
 *  2. Extensions → Apps Script. Delete what's there, paste this whole file, click Save.
 *  3. Pick "setup" in the function dropdown, click Run, and approve the permissions.
 *  4. Back in the Sheet, fill in First name + Email for the agencies you've researched.
 *  5. Menu "TalentLoom Outreach" → "Send me a preview". Check it in your inbox.
 *  6. Settings tab → set "Sending on" to YES. Done. It runs every weekday morning by itself.
 *
 * How it works: each morning it first checks Gmail for replies or bounces and stops those
 * prospects; then it sends the next due email to up to "Daily limit" prospects.
 * Rows without an email address are never touched.
 */

const SHEETS = { P: 'Prospects', T: 'Templates', S: 'Settings', L: 'Log' };
const COLS = ['Agency', 'Priority', 'Niche', 'Suggested contact', 'First name', 'Email',
  'Personal line', 'Status', 'Step', 'Last sent', 'Next send', 'First sent', 'Notes'];
const C = {};
COLS.forEach((c, i) => { C[c] = i; });
const STATUSES = ['Queued', 'Active', 'Replied', 'Done', 'Bounced', 'Paused', 'Skip'];
const FREE_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'icloud.com', 'me.com', 'aol.com', 'live.com', 'proton.me', 'protonmail.com'];
const AUTO_REPLY = /out of office|automatic reply|auto-?reply|autoreply|away from (the )?office/i;

// [Agency, Priority, Niche (short, used in email 2), Suggested contact, Personal line, Status]
const AGENCIES = [
  ['Neon Rose Agency', 'A', 'wellness and beauty', 'Not listed: check LinkedIn',
    'Your roster covers wellness, fashion, travel, family and beauty, which lines up closely with the creators TalentLoom is built for.', 'Queued'],
  ['G&B Digital Management', 'A', 'fashion and beauty', 'Kyle Hjelmeseth (confirm title)',
    "G&B's mix of fashion, beauty, family and food creators is exactly the range TalentLoom is built to help managers scout.", 'Queued'],
  ['Shine Talent Group', 'A', 'fashion and beauty', 'Not listed: check LinkedIn',
    "With a roster of 300+ creators across the US, Canada and Europe, I imagine Shine's team spends real time checking stats on new talent.", 'Queued'],
  ['FamFluence Talent Management', 'A', 'family and parenting', 'Jim Silver (CEO), Alexa Vogue (SVP)',
    "FamFluence's focus on family creators stood out to me. Parenting and home creators are a big part of who TalentLoom is built for.", 'Queued'],
  ['CMG Talent', 'A', 'lifestyle', 'Joey Roesler (Founder & CEO)',
    'I saw CMG Talent works out of Beverly Hills, Nashville and Dallas and represents creators across a lot of niches.', 'Queued'],
  ['Currents Management', 'A', 'family and comedy', 'Cameron & Nilou Ajdari (co-heads)',
    "I saw Currents has been growing its family and comedy rosters, and those are the kinds of creators TalentLoom helps managers find early.", 'Queued'],
  ['Kensington Grey', 'A', 'fashion and lifestyle', 'Shannae Ingleton Smith (President & CEO)',
    "Kensington Grey's work championing diverse creators in fashion, lifestyle and beauty is a big part of why I wanted to reach out.", 'Queued'],
  ['The Digital Dept', 'A', 'lifestyle and fashion', 'Not confirmed: check LinkedIn',
    "Lifestyle and fashion creators like the ones on The Digital Dept's roster are a big part of who TalentLoom is built for.", 'Queued'],
  ['Dulcedo Management', 'A', 'lifestyle and fashion', 'Not listed: check LinkedIn',
    'I saw Dulcedo is growing its team in Dallas, and with 350+ creators, scouting must be a constant job.', 'Queued'],
  ['Ponte Firm', 'A', 'lifestyle', 'Not listed: check LinkedIn',
    'As a boutique firm in Austin and New York, Ponte seems like exactly the kind of team that signs creators early.', 'Queued'],
  ['Select Management Group', 'B', 'lifestyle', 'Not listed: check LinkedIn',
    'With 600+ creators and a team hiring in Nashville, Select is the kind of agency that scouts every week.', 'Queued'],
  ['Whalar Talent', 'B', 'lifestyle', 'Victoria Bachan (Sixteenth, per press)',
    'With 300+ creators and dozens of managers, I imagine Whalar Talent has a lot of people scouting at once.', 'Queued'],
  ['Division Media', 'C', 'lifestyle', 'Not listed: check LinkedIn',
    'I saw Division Media is hiring a talent manager in New York, which usually means the roster is growing.', 'Queued'],
  ['On Record Agency', 'C', 'wellness and skincare', 'Not listed: check LinkedIn',
    "On Record's curated roster across tech, lifestyle, wellness and skincare is a great fit for the creators joining TalentLoom.", 'Queued'],
  ['Agency Cliquish', 'C', 'culture and lifestyle', 'Not listed: check LinkedIn',
    "Cliquish's culture-focused roster out of Atlanta caught my eye.", 'Queued'],
  ['Palette Media', 'C', 'lifestyle', 'Not listed: check LinkedIn',
    'I saw Palette Media is hiring on the talent side, which usually means new creators are coming in.', 'Queued'],
  ['Underscore Talent', 'Later', 'gaming', 'Skip until Twitch is live', '', 'Skip'],
  ['Loaded', 'Later', 'gaming', 'Skip until Twitch is live', '', 'Skip'],
];

// [Key, Subject, Body]. Placeholders: {{Greeting}} {{FirstName}} {{Agency}} {{Niche}} {{PersonalLine}} {{SenderName}} {{AttachLine}}
const TEMPLATES = [
  ['Step 1', 'Verified creator stats for {{Agency}}',
    '{{Greeting}}\n\n{{PersonalLine}}\n\n' +
    "I'm the founder of TalentLoom. Creators connect their Instagram, TikTok, YouTube or Facebook accounts, so the followers, views and engagement your team sees come straight from the platform, not from screenshots. You can search by niche, platform and audience size, filter to creators who aren't represented yet, and keep shortlists, a pipeline and your roster in one place.\n\n" +
    "We open to management companies on November 17, and I'm inviting a small group of agencies in early as Founding Partners. I'd be glad to set up your account with you on a 15-minute call.\n\n" +
    'Would {{Agency}} be up for a look? {{AttachLine}}'],
  ['Step 2', 'Re: Verified creator stats for {{Agency}}',
    '{{Greeting}}\n\n' +
    "Quick follow-up. If it's useful, I can pull three {{Niche}} creators on TalentLoom who aren't represented yet, with their verified engagement, and send them over. Just reply \"yes\" and I'll put the list together."],
  ['Step 3', 'Re: Verified creator stats for {{Agency}}',
    '{{Greeting}}\n\n' +
    "I'll stop filling your inbox! If scouting gets busy next quarter, you can request access anytime at talentloom.live/for-companies, or reply here and I'll set things up for you."],
  ['Signature', '', '{{SenderName}}\nFounder, TalentLoom · talentloom.live'],
  ['Footer', '', 'Not the right person, or rather not hear from me? Reply "stop" and I won\'t email again.'],
];

// [Setting, Value, Note]
const SETTINGS = [
  ['Sending on', 'NO', 'YES to start sending. Replies are always checked.'],
  ['Daily limit', 20, 'Max emails per day. Keep at 20–30 for good deliverability.'],
  ['Sender name', 'Mallory Lumpkin', ''],
  ['Send from alias', '', 'Optional. Only if set up in Gmail → Settings → Accounts → Send mail as.'],
  ['One-pager Drive file ID', '', 'Optional. Upload the one-pager PDF to Drive; paste the ID from its link (the part after /d/).'],
  ['Mailing address', '', 'Your business mailing address. US law (CAN-SPAM) requires one in commercial email.'],
  ['Days until email 2', 4, ''],
  ['Days until email 3', 8, 'Counted from email 2.'],
  ['Send on weekends', 'NO', ''],
  ['Preview email', '', 'Where previews go. Defaults to your account.'],
];

/* ---------------- Menu & setup ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('TalentLoom Outreach')
    .addItem('Send me a preview', 'sendPreview')
    .addItem('Run now', 'runSequence')
    .addItem('Check replies only', 'checkRepliesOnly')
    .addSeparator()
    .addItem('Turn sending on', 'resume')
    .addItem('Pause sending', 'pause')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();

  const p = getOrCreate_(ss, SHEETS.P);
  if (p.getLastRow() === 0) {
    p.appendRow(COLS);
    const rows = AGENCIES.map(a => [a[0], a[1], a[2], a[3], '', '', a[4], a[5], 0, '', '', '', '']);
    p.getRange(2, 1, rows.length, COLS.length).setValues(rows);
    p.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#16131F').setFontColor('#FFFFFF');
    p.setFrozenRows(1);
    p.setColumnWidths(1, COLS.length, 130);
    p.setColumnWidth(C['Personal line'] + 1, 380);
    p.setColumnWidth(C['Email'] + 1, 220);
    p.getRange(2, C['Personal line'] + 1, 500, 1).setWrap(true);
    p.getRange(2, C['Status'] + 1, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
    p.getRange(2, C['First name'] + 1, 500, 2).setBackground('#FFF6E5');
  }

  const t = getOrCreate_(ss, SHEETS.T);
  if (t.getLastRow() === 0) {
    t.appendRow(['Key', 'Subject', 'Body']);
    t.getRange(2, 1, TEMPLATES.length, 3).setValues(TEMPLATES);
    t.getRange(1, 1, 1, 3).setFontWeight('bold');
    t.setColumnWidth(2, 300);
    t.setColumnWidth(3, 600);
    t.getRange(2, 3, TEMPLATES.length, 1).setWrap(true);
    t.setFrozenRows(1);
  }

  const s = getOrCreate_(ss, SHEETS.S);
  if (s.getLastRow() === 0) {
    s.appendRow(['Setting', 'Value', 'Note']);
    const rows = SETTINGS.map(r => r.slice());
    rows.find(r => r[0] === 'Preview email')[1] = Session.getEffectiveUser().getEmail();
    s.getRange(2, 1, rows.length, 3).setValues(rows);
    s.getRange(1, 1, 1, 3).setFontWeight('bold');
    s.setColumnWidths(1, 3, 220);
    s.setColumnWidth(3, 480);
    const yn = SpreadsheetApp.newDataValidation().requireValueInList(['YES', 'NO'], true).build();
    s.getRange(2, 2).setDataValidation(yn);
    s.getRange(2 + rows.findIndex(r => r[0] === 'Send on weekends'), 2).setDataValidation(yn);
  }

  const l = getOrCreate_(ss, SHEETS.L);
  if (l.getLastRow() === 0) {
    l.appendRow(['Time', 'Agency', 'Email', 'Event']);
    l.getRange(1, 1, 1, 4).setFontWeight('bold');
    l.setFrozenRows(1);
  }

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  ScriptApp.getProjectTriggers()
    .filter(tr => tr.getHandlerFunction() === 'runSequence')
    .forEach(tr => ScriptApp.deleteTrigger(tr));
  ScriptApp.newTrigger('runSequence').timeBased().everyDays(1).atHour(9).create();

  ss.setActiveSheet(p);
  log_('', '', 'Setup complete. Daily run scheduled around 9 am.');
}

function pause() { setSetting_('Sending on', 'NO'); toast_('Sending paused. Replies are still checked daily.'); }
function resume() { setSetting_('Sending on', 'YES'); toast_('Sending is on. Next run is tomorrow around 9 am, or use Run now.'); }

/* ---------------- Daily run ---------------- */

function checkRepliesOnly() {
  const sh = sheet_(SHEETS.P);
  const data = sh.getDataRange().getValues();
  const n = checkReplies_(sh, data);
  toast_(n ? n + ' prospect(s) marked Replied or Bounced.' : 'No new replies.');
}

function runSequence() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const s = getSettings_();
    const sh = sheet_(SHEETS.P);
    const data = sh.getDataRange().getValues();
    checkReplies_(sh, data);

    if (String(s['Sending on']).toUpperCase() !== 'YES') return;
    const now = new Date();
    const dow = now.getDay();
    if (String(s['Send on weekends']).toUpperCase() !== 'YES' && (dow === 0 || dow === 6)) return;

    const cap = Math.min(Number(s['Daily limit']) || 20, MailApp.getRemainingDailyQuota());
    const tpl = getTemplates_();
    const today = startOfDay_(now);
    let sent = 0;

    for (let r = 1; r < data.length && sent < cap; r++) {
      const row = data[r];
      const email = String(row[C['Email']]).trim();
      const status = String(row[C['Status']]).trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
      if (status !== 'Queued' && status !== 'Active') continue;
      const step = Number(row[C['Step']]) || 0;
      if (step >= 3) continue;
      const due = row[C['Next send']];
      if (due && startOfDay_(new Date(due)) > today) continue;

      const n = step + 1;
      try {
        sendStep_(row, n, tpl, s, email, false);
      } catch (e) {
        row[C['Notes']] = appendNote_(row[C['Notes']], 'Send error: ' + e.message);
        sh.getRange(r + 1, 1, 1, COLS.length).setValues([row]);
        log_(row[C['Agency']], email, 'Error on email ' + n + ': ' + e.message);
        continue;
      }
      row[C['Step']] = n;
      row[C['Last sent']] = now;
      if (n === 1) row[C['First sent']] = now;
      row[C['Status']] = n === 3 ? 'Done' : 'Active';
      row[C['Next send']] = n === 1 ? addDays_(today, Number(s['Days until email 2']) || 4)
        : n === 2 ? addDays_(today, Number(s['Days until email 3']) || 8) : '';
      sh.getRange(r + 1, 1, 1, COLS.length).setValues([row]);
      log_(row[C['Agency']], email, 'Sent email ' + n);
      sent++;
      Utilities.sleep(1500);
    }
    if (sent) log_('', '', 'Run finished: ' + sent + ' sent.');
  } finally {
    lock.releaseLock();
  }
}

function checkReplies_(sh, data) {
  let changed = 0;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const status = String(row[C['Status']]).trim();
    const email = String(row[C['Email']]).trim().toLowerCase();
    const first = row[C['First sent']];
    if ((status !== 'Active' && status !== 'Done') || !email || !first) continue;

    const firstSent = new Date(first);
    const after = Utilities.formatDate(addDays_(firstSent, -1), Session.getScriptTimeZone(), 'yyyy/MM/dd');
    const domain = email.split('@')[1];
    const who = FREE_DOMAINS.indexOf(domain) >= 0 ? email : domain;

    const bounced = GmailApp.search('from:(mailer-daemon OR postmaster) "' + email + '" after:' + after, 0, 1).length > 0;
    if (bounced) {
      row[C['Status']] = 'Bounced';
      row[C['Next send']] = '';
      row[C['Notes']] = appendNote_(row[C['Notes']], 'Bounced: check the address');
      sh.getRange(r + 1, 1, 1, COLS.length).setValues([row]);
      log_(row[C['Agency']], email, 'Bounced: sequence stopped');
      changed++;
      continue;
    }

    const threads = GmailApp.search('from:(' + who + ') after:' + after, 0, 20);
    let reply = null;
    threads.forEach(t => t.getMessages().forEach(m => {
      if (reply) return;
      if (m.getDate() <= firstSent) return;
      if (m.getFrom().toLowerCase().indexOf(who) < 0) return;
      if (AUTO_REPLY.test(m.getSubject())) return;
      reply = m;
    }));
    if (reply) {
      row[C['Status']] = 'Replied';
      row[C['Next send']] = '';
      row[C['Notes']] = appendNote_(row[C['Notes']],
        'Replied ' + Utilities.formatDate(reply.getDate(), Session.getScriptTimeZone(), 'MMM d') + ' from ' + reply.getFrom());
      sh.getRange(r + 1, 1, 1, COLS.length).setValues([row]);
      log_(row[C['Agency']], email, 'Reply found: sequence stopped');
      changed++;
    }
  }
  return changed;
}

/* ---------------- Preview ---------------- */

function sendPreview() {
  const s = getSettings_();
  const to = String(s['Preview email'] || Session.getEffectiveUser().getEmail()).trim();
  const data = sheet_(SHEETS.P).getDataRange().getValues();
  let row = data.slice(1).find(r => String(r[C['Email']]).trim() && ['Queued', 'Active'].indexOf(r[C['Status']]) >= 0);
  if (!row) row = data[1];
  const tpl = getTemplates_();
  [1, 2, 3].forEach(n => sendStep_(row, n, tpl, s, to, true));
  toast_('Sent 3 preview emails to ' + to + ' using ' + row[C['Agency']] + '.');
}

/* ---------------- Sending ---------------- */

function sendStep_(row, n, tpl, s, to, preview) {
  const first = String(row[C['First name']]).trim();
  const fileId = String(s['One-pager Drive file ID'] || '').trim();
  const vars = {
    Greeting: first ? 'Hi ' + first + ',' : 'Hi ' + row[C['Agency']] + ' team,',
    FirstName: first,
    Agency: row[C['Agency']],
    Niche: row[C['Niche']] || 'lifestyle',
    PersonalLine: row[C['Personal line']] || '',
    SenderName: s['Sender name'] || 'Mallory Lumpkin',
    AttachLine: fileId ? "I've attached a one-page overview."
      : "There's a one-page overview at talentloom.live/for-companies.",
  };
  const t = tpl['Step ' + n];
  if (!t) throw new Error('Missing template "Step ' + n + '"');

  let subject = fill_(t.subject, vars);
  if (preview) subject = '[PREVIEW ' + n + '/3] ' + subject;

  let text = fill_(t.body, vars) + '\n\n' + fill_((tpl['Signature'] || {}).body || '', vars);
  const footer = fill_((tpl['Footer'] || {}).body || '', vars);
  const addr = String(s['Mailing address'] || '').trim();
  if (footer || addr) text += '\n\n--\n' + [footer, addr].filter(Boolean).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#16131F">' +
    escapeHtml_(text).replace(/\n/g, '<br>') + '</div>';

  const opts = { name: vars.SenderName, htmlBody: html };
  const alias = String(s['Send from alias'] || '').trim();
  if (alias) opts.from = alias;
  if (n === 1 && fileId) opts.attachments = [DriveApp.getFileById(fileId).getAs(MimeType.PDF)];

  GmailApp.sendEmail(to, subject, text, opts);
}

/* ---------------- Helpers ---------------- */

function getOrCreate_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing "' + name + '" tab. Run setup first.');
  return sh;
}
function getSettings_() {
  const out = {};
  sheet_(SHEETS.S).getDataRange().getValues().slice(1).forEach(r => { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}
function setSetting_(key, value) {
  const sh = sheet_(SHEETS.S);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (vals[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
}
function getTemplates_() {
  const out = {};
  sheet_(SHEETS.T).getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) out[String(r[0]).trim()] = { subject: String(r[1] || ''), body: String(r[2] || '') };
  });
  return out;
}
function fill_(str, vars) { return String(str).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m)); }
function escapeHtml_(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function startOfDay_(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays_(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function appendNote_(old, note) { return old ? old + ' | ' + note : note; }
function log_(agency, email, event) {
  const l = SpreadsheetApp.getActive().getSheetByName(SHEETS.L);
  if (l) l.appendRow([new Date(), agency, email, event]);
}
function toast_(msg) { SpreadsheetApp.getActive().toast(msg, 'TalentLoom Outreach', 6); }
