// Minimal RFC4180-ish CSV parser with quoted fields.
// Returns array of records (objects) using header row.
export function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  function readCell() {
    if (i >= n) return { value: '', done: true };
    let value = '';
    let done = false;
    if (text[i] === '"') {
      i++; // opening quote
      while (i < n) {
        const ch = text[i];
        if (ch === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++; // closing quote
          break;
        }
        value += ch;
        i++;
      }
      // consume optional spaces until comma/newline
      while (i < n && text[i] === ' ') i++;
      if (text[i] === ',') i++;
    } else {
      while (i < n) {
        const ch = text[i];
        if (ch === ',' || ch === '\n' || ch === '\r') break;
        value += ch;
        i++;
      }
      if (text[i] === ',') i++;
    }

    // end-of-line handling
    if (text[i] === '\r') i++;
    if (text[i] === '\n') {
      i++;
      done = true;
    } else if (i >= n) {
      done = true;
    }
    return { value: value.trim(), done };
  }

  while (i < n) {
    // skip blank lines
    while (i < n && (text[i] === '\n' || text[i] === '\r')) i++;
    if (i >= n) break;
    const row = [];
    while (true) {
      const { value, done } = readCell();
      row.push(value);
      if (done) break;
    }
    // ignore empty row
    if (row.every((c) => c === '')) continue;
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (const row of rows.slice(1)) {
    const rec = {};
    for (let j = 0; j < header.length; j++) {
      rec[header[j]] = row[j] ?? '';
    }
    out.push(rec);
  }
  return out;
}

