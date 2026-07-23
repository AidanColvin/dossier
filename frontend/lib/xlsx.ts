// a minimal, dependency-free .xlsx writer.
//
// an xlsx file is a zip archive of small xml parts. rather than pull in a
// zip library and a spreadsheet library, this hand-writes both: a "stored"
// (uncompressed) zip encoder, standard crc32, and the handful of ooxml xml
// parts a single-sheet workbook needs. every byte is standard library plus
// plain arithmetic — the same "no dependency" discipline as the app's
// hand-built SVG charts, applied to a binary format instead of a visual one.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Takes bytes. Returns their CRC-32 checksum, the algorithm zip requires. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// a fixed, valid DOS date/time (2024-01-01, midnight). the value is never
// read back by any consumer of this file; it exists because the zip format
// requires a well-formed field there, not because it carries information.
const DOS_TIME = 0;
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * given a list of {name, data} entries
 * return a valid zip archive holding them, uncompressed ("stored" method)
 *
 * stored entries need no deflate implementation, only a crc32 and the
 * three standard zip records (local header, central directory, end of
 * central directory) — the whole reason this stays dependency-free.
 */
export function zipStore(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8(entry.name);
    const checksum = crc32(entry.data);
    const size = entry.data.length;

    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0),
      u16(DOS_TIME), u16(DOS_DATE),
      u32(checksum), u32(size), u32(size),
      u16(nameBytes.length), u16(0),
      nameBytes, entry.data,
    ]);
    localParts.push(local);

    centralParts.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(DOS_TIME), u16(DOS_DATE),
      u32(checksum), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), nameBytes,
    ]));

    offset += local.length;
  }

  const centralDirectory = concat(centralParts);
  const centralStart = offset;
  const end = concat([
    u32(0x06054b50), u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(centralDirectory.length), u32(centralStart), u16(0),
  ]);

  return concat([...localParts, centralDirectory, end]);
}

/** Takes text. Returns it with the five xml special characters escaped. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Takes a zero-based column index. Returns its spreadsheet letter: 0->A, 26->AA. */
function columnLetter(index: number): string {
  let letters = "";
  let n = index;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/** Takes a grid of rows, first row a header. Returns the sheet's cell xml. */
function sheetXml(rows: string[][]): string {
  const rowsXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `</Relationships>`;

function workbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

/**
 * given a sheet name and a grid of string rows (first row the header)
 * return the bytes of a single-sheet .xlsx file, ready to save or download
 */
export function buildXlsx(sheetName: string, rows: string[][]): Uint8Array {
  return zipStore([
    { name: "[Content_Types].xml", data: utf8(CONTENT_TYPES) },
    { name: "_rels/.rels", data: utf8(ROOT_RELS) },
    { name: "xl/workbook.xml", data: utf8(workbookXml(sheetName)) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml(rows)) },
  ]);
}
