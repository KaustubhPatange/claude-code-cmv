#!/usr/bin/env node
// Generates an asciinema v2 .cast file simulating the CMV TUI dashboard

const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', 'demo.cast');
const W = 108;
const H = 30;
const events = [];
let time = 0;

// ANSI
const CSI = '\x1b[';
const RESET = CSI + '0m';
const BOLD = CSI + '1m';
const DIM = CSI + '2m';
const INVERSE = CSI + '7m';
const CYAN = CSI + '36m';
const GREEN = CSI + '32m';
const YELLOW = CSI + '33m';
const GRAY = CSI + '90m';
const CLEAR = CSI + '2J' + CSI + 'H';
const HIDE_CURSOR = CSI + '?25l';
const SHOW_CURSOR = CSI + '?25h';

function moveTo(r, c) { return CSI + r + ';' + c + 'H'; }

// Strip ANSI for length calc
function visLen(str) { return str.replace(/\x1b\[[0-9;]*m/g, '').length; }

// Write text at exact position, padded to exactly `w` visible chars
function writeCell(row, col, w, content) {
  const vl = visLen(content);
  const padding = Math.max(0, w - vl);
  return moveTo(row, col) + content + ' '.repeat(padding);
}

function addEvent(text, delay = 0) {
  time += delay;
  events.push([parseFloat(time.toFixed(3)), 'o', text]);
}

// Box drawing
const HL = '─', VL = '│';

// Fixed column positions (1-indexed)
const C1 = 1;                 // left border
const C2 = 21;                // border between project & tree
const C3 = 61;                // border between tree & detail
const C4 = W;                 // right border
const projInner = C2 - C1 - 1;  // 19
const treeInner = C3 - C2 - 1;  // 39
const detailInner = C4 - C3 - 1; // 47
const bodyRows = H - 6; // rows 4..H-3

// Draw all vertical borders for a row
function vborders(row) {
  return moveTo(row, C1) + GRAY + VL + RESET +
         moveTo(row, C2) + GRAY + VL + RESET +
         moveTo(row, C3) + GRAY + VL + RESET +
         moveTo(row, C4) + GRAY + VL + RESET;
}

function hfull(c1, c2) { return HL.repeat(c2 - c1 - 1); }

// ── Data ──
const projects = [
  { path: '~/webapp', count: 14 },
  { path: '~/api-server', count: 9 },
  { path: '~/ml-pipeline', count: 5 },
];

function treeItems() {
  return [
    { type: 'snap0', name: 'codebase-analysis', msgs: 82 },
    { type: 'br', text: '├── implement-auth (br)' },
    { type: 'br', text: '├── implement-api (br)' },
    { type: 'snap1', name: 'auth-designed', msgs: 95, prefix: '└── ' },
    { type: 'br', text: '    ├── auth-frontend (br)' },
    { type: 'br', text: '    └── auth-backend (br)' },
    { type: 'sep' },
    { type: 'sess', id: '7e616107-a…', msgs: 42, age: '3h ago', sum: 'Refactoring db layer' },
    { type: 'sess', id: 'a1b2c3d4-e…', msgs: 18, age: '1d ago', sum: 'Initial setup' },
    { type: 'sess', id: 'f9e8d7c6-b…', msgs: 67, age: '2d ago', sum: 'Auth token refresh' },
    { type: 'sess', id: 'b5a4e3f2-9…', msgs: 124, age: '3d ago', sum: 'Full analysis' },
  ];
}

// ── Render a complete frame ──
function renderFrame(opts) {
  const {
    projSel = 0, projFocused = false,
    treeSel = 0, treeFocused = true,
    detailLines = [], actionType = 'snapshot',
    statusMsg = null,
  } = opts;

  let out = CLEAR + HIDE_CURSOR;

  // ─── Row 1: Top border ───
  out += moveTo(1, C1) + GRAY;
  out += '┌' + hfull(C1, C2) + '┬' + hfull(C2, C3) + '┬' + hfull(C3, C4) + '┐';
  out += RESET;

  // ─── Row 2: Headers ───
  out += vborders(2);
  out += writeCell(2, C1 + 1, projInner, ' ' + BOLD + 'Projects' + RESET);
  out += writeCell(2, C2 + 1, treeInner, ' ' + BOLD + '~/webapp' + RESET);
  out += writeCell(2, C3 + 1, detailInner, ' ' + BOLD + 'Details' + RESET);

  // ─── Row 3: Header separator ───
  out += moveTo(3, C1) + GRAY;
  out += '├' + hfull(C1, C2) + '┼' + hfull(C2, C3) + '┼' + hfull(C3, C4) + '┤';
  out += RESET;

  // ─── Body rows (4 .. H-3) ───
  const items = treeItems();

  for (let i = 0; i < bodyRows; i++) {
    const row = 4 + i;
    out += vborders(row);

    // ── Project column ──
    if (i < projects.length) {
      const p = projects[i];
      const countStr = ('' + p.count).padStart(3);
      if (i === projSel && projFocused) {
        out += writeCell(row, C1 + 1, projInner, INVERSE + CYAN + ' ' + p.path + countStr.padStart(projInner - 1 - p.path.length) + RESET);
      } else if (i === projSel) {
        out += writeCell(row, C1 + 1, projInner, ' ' + CYAN + p.path + RESET + DIM + countStr.padStart(projInner - 2 - p.path.length) + RESET);
      } else {
        out += writeCell(row, C1 + 1, projInner, ' ' + DIM + p.path + countStr.padStart(projInner - 2 - p.path.length) + RESET);
      }
    }

    // ── Tree column ──
    if (i < items.length) {
      const item = items[i];
      const highlighted = i === treeSel && treeFocused;

      if (item.type === 'snap0') {
        const msgsStr = (' ' + item.msgs + 'm').padStart(5);
        if (highlighted) {
          const txt = ' ● ' + item.name + msgsStr.padStart(treeInner - 3 - item.name.length);
          out += writeCell(row, C2 + 1, treeInner, INVERSE + CYAN + BOLD + txt + RESET);
        } else {
          out += writeCell(row, C2 + 1, treeInner,
            ' ' + CYAN + '● ' + BOLD + item.name + RESET +
            DIM + msgsStr.padStart(treeInner - 4 - item.name.length) + RESET);
        }
      } else if (item.type === 'snap1') {
        const prefix = item.prefix || '└── ';
        const msgsStr = (' ' + item.msgs + 'm').padStart(5);
        if (highlighted) {
          const txt = '   ' + prefix + item.name + msgsStr.padStart(treeInner - 3 - prefix.length - item.name.length);
          out += writeCell(row, C2 + 1, treeInner, INVERSE + CYAN + BOLD + txt + RESET);
        } else {
          out += writeCell(row, C2 + 1, treeInner,
            '   ' + DIM + prefix + RESET + CYAN + BOLD + item.name + RESET +
            DIM + msgsStr.padStart(treeInner - 4 - prefix.length - item.name.length) + RESET);
        }
      } else if (item.type === 'br') {
        if (highlighted) {
          out += writeCell(row, C2 + 1, treeInner, INVERSE + ' ' + item.text + ' '.repeat(Math.max(0, treeInner - 1 - item.text.length)) + RESET);
        } else {
          out += writeCell(row, C2 + 1, treeInner, '   ' + DIM + item.text + RESET);
        }
      } else if (item.type === 'sep') {
        const label = ' Sessions ';
        const left = Math.floor((treeInner - 2 - label.length) / 2);
        out += writeCell(row, C2 + 1, treeInner,
          ' ' + DIM + HL.repeat(left) + label + HL.repeat(treeInner - 2 - left - label.length) + RESET);
      } else if (item.type === 'sess') {
        const idStr = item.id.padEnd(13);
        const rest = (item.msgs + 'm').padStart(4) + '  ' + item.age.padEnd(7) + ' ' + item.sum;
        if (highlighted) {
          const txt = ' ' + idStr + rest;
          out += writeCell(row, C2 + 1, treeInner, INVERSE + GREEN + txt.slice(0, treeInner) + RESET);
        } else {
          out += writeCell(row, C2 + 1, treeInner,
            ' ' + GREEN + idStr + RESET + DIM + rest.slice(0, treeInner - 14) + RESET);
        }
      }
    }

    // ── Detail column ──
    if (i < detailLines.length && detailLines[i]) {
      out += writeCell(row, C3 + 1, detailInner, detailLines[i]);
    }
  }

  // ─── Action bar separator ───
  const abRow = H - 2;
  out += moveTo(abRow, C1) + GRAY;
  out += '├' + HL.repeat(W - 2) + '┤';
  out += RESET;

  // ─── Action bar content ───
  out += moveTo(abRow + 1, C1) + GRAY + VL + RESET + ' ';
  if (actionType === 'snapshot') {
    out += YELLOW + '[b]' + RESET + ' Branch  ' +
           YELLOW + '[t]' + RESET + ' Trim  ' +
           YELLOW + '[s]' + RESET + ' Snapshot  ' +
           YELLOW + '[d]' + RESET + ' Delete  ' +
           YELLOW + '[e]' + RESET + ' Export  ' +
           YELLOW + '[i]' + RESET + ' Import  ' +
           YELLOW + '[Tab]' + RESET + ' Switch  ' +
           YELLOW + '[q]' + RESET + ' Quit';
  } else if (actionType === 'session') {
    out += YELLOW + '[Enter]' + RESET + ' Open  ' +
           YELLOW + '[s]' + RESET + ' Snapshot  ' +
           YELLOW + '[Tab]' + RESET + ' Switch  ' +
           YELLOW + '[q]' + RESET + ' Quit';
  } else if (actionType === 'branch') {
    out += YELLOW + '[Enter]' + RESET + ' Open  ' +
           YELLOW + '[s]' + RESET + ' Snapshot  ' +
           YELLOW + '[d]' + RESET + ' Delete  ' +
           YELLOW + '[Tab]' + RESET + ' Switch  ' +
           YELLOW + '[q]' + RESET + ' Quit';
  }
  if (statusMsg) {
    const [msg, color] = statusMsg;
    out += moveTo(abRow + 1, W - visLen(msg) - 2) + color + msg + RESET;
  }
  out += moveTo(abRow + 1, C4) + GRAY + VL + RESET;

  // ─── Bottom border ───
  out += moveTo(H, C1) + GRAY;
  out += '└' + HL.repeat(W - 2) + '┘';
  out += RESET;

  return out;
}

// ── Detail builders ──
function lbl(s) { return DIM + s.padEnd(14) + RESET; }

function snapDetail(d) {
  const barW = 16;
  const filled = Math.round(barW * d.pct / 100);
  const bar = GREEN + '█'.repeat(filled) + RESET + DIM + '░'.repeat(barW - filled) + RESET;
  return [
    ' ' + lbl('Name:') + CYAN + BOLD + d.name + RESET,
    ' ' + lbl('Created:') + d.created,
    ' ' + lbl('Source:') + d.source,
    ' ' + lbl('Messages:') + d.messages,
    ' ' + lbl('Size:') + d.size,
    ' ' + lbl('Description:') + d.desc,
    '',
    ' ' + lbl('Branches:') + d.branches,
    ' ' + lbl('Parent:') + d.parent,
    ' ' + BOLD + 'Context' + RESET,
    ' ' + lbl('Tokens:') + '~' + d.used + 'k / ' + d.max + 'k ' + bar + ' ' + d.pct + '%',
    ' ' + lbl('Remaining:') + '~' + (d.max - d.used) + 'k tokens',
    '',
    ' ' + BOLD + 'Breakdown' + RESET,
    ' ' + lbl('Tool results:') + '62% ' + DIM + '(54)' + RESET,
    ' ' + lbl('Signatures:') + '18% ' + DIM + '(11)' + RESET,
    ' ' + lbl('Conversation:') + '15%',
    ' ' + lbl('Tool uses:') + '5% ' + DIM + '(54)' + RESET,
    '',
    ' ' + lbl('Trimmable:') + YELLOW + d.trimmable + RESET,
  ];
}

function branchDetail(name, snap) {
  return [
    ' ' + lbl('Name:') + name,
    ' ' + lbl('Type:') + 'Branch',
    ' ' + lbl('Created:') + '2d ago',
    ' ' + lbl('Snapshot:') + CYAN + snap + RESET,
  ];
}

function sessionDetail(id, age, msgs, sum) {
  return [
    ' ' + lbl('Session ID:') + GREEN + id + RESET,
    ' ' + lbl('Modified:') + age,
    ' ' + lbl('Messages:') + msgs,
    ' ' + lbl('Project:') + '~/webapp',
    ' ' + lbl('Summary:') + DIM + sum + RESET,
    '',
    ' ' + DIM + 'Press ' + YELLOW + '[s]' + RESET + DIM + ' to snapshot' + RESET,
  ];
}

// ── Snapshot detail data ──
const rootSnap = {
  name: 'codebase-analysis', created: '2d ago', source: 'f9e8d7c6-b5a…',
  messages: 82, size: '1.8 MB', desc: '—', branches: 3, parent: '(root)',
  used: 51, max: 200, pct: 25, trimmable: '~1.4 MB (~350k tokens)',
};
const childSnap = {
  name: 'auth-designed', created: '1d ago', source: '13d27827-14…',
  messages: 95, size: '2.3 MB', desc: 'Auth architecture decided', branches: 2,
  parent: 'codebase-analysis', used: 70, max: 200, pct: 35,
  trimmable: '~1.7 MB (~425k tokens)',
};

// ── Animation ──

// 1: Projects focused, root snapshot shown
addEvent(renderFrame({
  projSel: 0, projFocused: true, treeSel: 0, treeFocused: false,
  detailLines: snapDetail(rootSnap), actionType: 'snapshot',
}), 0.8);

// 2: Tab → tree focused, root snapshot highlighted
addEvent(renderFrame({
  projSel: 0, projFocused: false, treeSel: 0, treeFocused: true,
  detailLines: snapDetail(rootSnap), actionType: 'snapshot',
}), 2.0);

// 3: ↓ implement-auth
addEvent(renderFrame({
  treeSel: 1, detailLines: branchDetail('implement-auth', 'codebase-analysis'),
  actionType: 'branch',
}), 1.2);

// 4: ↓ implement-api
addEvent(renderFrame({
  treeSel: 2, detailLines: branchDetail('implement-api', 'codebase-analysis'),
  actionType: 'branch',
}), 0.7);

// 5: ↓ auth-designed (child snapshot)
addEvent(renderFrame({
  treeSel: 3, detailLines: snapDetail(childSnap), actionType: 'snapshot',
}), 0.8);

// 6: Pause on auth-designed context
addEvent(renderFrame({
  treeSel: 3, detailLines: snapDetail(childSnap), actionType: 'snapshot',
}), 2.5);

// 7: ↑ back to root
addEvent(renderFrame({
  treeSel: 0, detailLines: snapDetail(rootSnap), actionType: 'snapshot',
}), 1.5);

// 8: ↓↓↓ to first session
addEvent(renderFrame({
  treeSel: 7,
  detailLines: sessionDetail('7e616107-a…', '3h ago', 42, 'Refactoring db layer'),
  actionType: 'session',
}), 1.5);

// 9: [s] snapshot session
addEvent(renderFrame({
  treeSel: 7,
  detailLines: sessionDetail('7e616107-a…', '3h ago', 42, 'Refactoring db layer'),
  actionType: 'session',
  statusMsg: ['✓ Snapshot "db-refactor" created', GREEN],
}), 1.5);

// 10: ↑ back to root
addEvent(renderFrame({
  treeSel: 0, detailLines: snapDetail(rootSnap), actionType: 'snapshot',
}), 2.0);

// 11: [b] branch
addEvent(renderFrame({
  treeSel: 0, detailLines: snapDetail(rootSnap), actionType: 'snapshot',
  statusMsg: ['✓ Branch "new-feature" created', GREEN],
}), 1.5);

// 12: [t] trim branch
addEvent(renderFrame({
  treeSel: 0, detailLines: snapDetail(rootSnap), actionType: 'snapshot',
  statusMsg: ['✓ Trimmed: 1.8 MB → 612 KB (66%)', GREEN],
}), 2.5);

// 13: Final hold
addEvent(renderFrame({
  treeSel: 0, detailLines: snapDetail(rootSnap), actionType: 'snapshot',
}), 3.0);

addEvent(SHOW_CURSOR, 0.5);

// ── Write ──
const header = {
  version: 2, width: W, height: H,
  timestamp: Math.floor(Date.now() / 1000),
  env: { TERM: 'xterm-256color', SHELL: '/bin/bash' },
  title: 'CMV Dashboard',
};

const lines = [JSON.stringify(header)];
for (const ev of events) lines.push(JSON.stringify(ev));
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(`Written to ${outFile} (${events.length} events, ${time.toFixed(1)}s)`);
