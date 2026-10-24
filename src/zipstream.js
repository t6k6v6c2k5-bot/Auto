// Минимальный потоковый читатель ZIP (первая запись, deflate/stored) без зависимостей.
// Читает локальный заголовок и пропускает байты через inflateRaw; размеры из заголовка не нужны.
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';

export function unzipFirstEntry(webStream) {
  const src = Readable.fromWeb(webStream);
  const out = new Readable({ read() {} });
  let buf = Buffer.alloc(0), inflate = null, headerDone = false;
  src.on('data', (chunk) => {
    if (headerDone) { if (!inflate.write(chunk)) { src.pause(); inflate.once('drain', () => src.resume()); } return; }
    buf = Buffer.concat([buf, chunk]);
    if (buf.length < 30) return;
    if (buf.readUInt32LE(0) !== 0x04034b50) return out.destroy(new Error('not a zip'));
    const method = buf.readUInt16LE(8), nameLen = buf.readUInt16LE(26), extraLen = buf.readUInt16LE(28);
    const start = 30 + nameLen + extraLen;
    if (buf.length < start) return;
    headerDone = true;
    if (method === 8) {
      inflate = createInflateRaw();
      inflate.on('data', (d) => { if (!out.push(d)) { inflate.pause(); out.once('drain', () => inflate.resume()); } });
      inflate.on('end', () => out.push(null));
      inflate.on('error', (e) => out.destroy(e));
    } else if (method === 0) {
      inflate = { write: (d) => { out.push(d); return true; }, once() {}, end: () => out.push(null) };
    } else return out.destroy(new Error('unsupported zip method ' + method));
    const rest = buf.subarray(start); buf = null;
    if (rest.length) inflate.write(rest);
  });
  src.on('end', () => { if (inflate) inflate.end(); else out.push(null); });
  src.on('error', (e) => out.destroy(e));
  return out;
}
