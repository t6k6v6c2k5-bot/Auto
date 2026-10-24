// Потоковый CSV-разбор (разделитель ; или ,), кавычки с "" внутри. Переносов строк внутри полей в реестре нет.
export function parseLine(line, d) {
  const out = []; let i = 0; const n = line.length;
  while (i <= n) {
    if (line[i] === '"') {
      let v = ''; i++;
      for (; i < n; i++) {
        if (line[i] === '"') { if (line[i + 1] === '"') { v += '"'; i++; } else { i++; break; } } else v += line[i];
      }
      out.push(v); if (line[i] === d) i++; else break;
    } else {
      const j = line.indexOf(d, i);
      if (j < 0) { out.push(line.slice(i)); break; }
      out.push(line.slice(i, j)); i = j + 1;
      if (i === n) { out.push(''); break; }
    }
  }
  return out;
}
export const detectDelimiter = (header) => (header.split(';').length > header.split(',').length ? ';' : ',');
