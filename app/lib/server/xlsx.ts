import { Buffer } from "node:buffer";

export type XlsxCellValue = Date | number | string | null | undefined;

export type XlsxCell = {
  style?: "date" | "header" | "wrap";
  value: XlsxCellValue;
};

export type XlsxWorksheet = {
  autoFilter?: boolean;
  columnWidths?: number[];
  freezeHeader?: boolean;
  name: string;
  rows: Array<Array<XlsxCell | XlsxCellValue>>;
};

const CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function xlsxContentType() {
  return CONTENT_TYPE;
}

export function buildXlsxWorkbook(worksheets: XlsxWorksheet[]) {
  const safeWorksheets = worksheets.length
    ? worksheets
    : [{ name: "Sheet1", rows: [] }];
  const now = new Date();
  const worksheetFiles = safeWorksheets.map((worksheet, index) => ({
    data: Buffer.from(worksheetXml(worksheet), "utf8"),
    path: `xl/worksheets/sheet${index + 1}.xml`,
  }));

  return createZip([
    {
      path: "[Content_Types].xml",
      data: Buffer.from(contentTypesXml(safeWorksheets.length), "utf8"),
    },
    {
      path: "_rels/.rels",
      data: Buffer.from(rootRelationshipsXml(), "utf8"),
    },
    {
      path: "docProps/app.xml",
      data: Buffer.from(appPropertiesXml(safeWorksheets), "utf8"),
    },
    {
      path: "docProps/core.xml",
      data: Buffer.from(corePropertiesXml(now), "utf8"),
    },
    {
      path: "xl/workbook.xml",
      data: Buffer.from(workbookXml(safeWorksheets), "utf8"),
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(workbookRelationshipsXml(safeWorksheets.length), "utf8"),
    },
    {
      path: "xl/styles.xml",
      data: Buffer.from(stylesXml(), "utf8"),
    },
    ...worksheetFiles,
  ]);
}

function isXlsxCell(cell: XlsxCell | XlsxCellValue): cell is XlsxCell {
  return Boolean(
    cell &&
      typeof cell === "object" &&
      "value" in cell &&
      !(cell instanceof Date),
  );
}

function normalizeCell(cell: XlsxCell | XlsxCellValue): XlsxCell {
  if (isXlsxCell(cell)) {
    return cell;
  }

  return { value: cell as XlsxCellValue };
}

function worksheetXml(worksheet: XlsxWorksheet) {
  const rowCount = Math.max(1, worksheet.rows.length);
  const columnCount = Math.max(
    1,
    ...worksheet.rows.map((row) => Math.max(1, row.length)),
  );
  const dimension = `A1:${columnName(columnCount)}${rowCount}`;
  const columns = worksheet.columnWidths?.length
    ? `<cols>${worksheet.columnWidths
        .map(
          (width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
        )
        .join("")}</cols>`
    : "";
  const sheetViews = worksheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : "";
  const sheetRows = worksheet.rows.length
    ? worksheet.rows
        .map(
          (row, rowIndex) =>
            `<row r="${rowIndex + 1}">${row
              .map((cell, columnIndex) =>
                cellXml(normalizeCell(cell), rowIndex + 1, columnIndex + 1),
              )
              .join("")}</row>`,
        )
        .join("")
    : '<row r="1"/>';
  const autoFilter = worksheet.autoFilter
    ? `<autoFilter ref="A1:${columnName(columnCount)}${rowCount}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/>${sheetViews}${columns}<sheetData>${sheetRows}</sheetData>${autoFilter}</worksheet>`;
}

function cellXml(cell: XlsxCell, row: number, column: number) {
  const reference = `${columnName(column)}${row}`;
  const styleId = cellStyleId(cell.style);

  if (cell.value === null || cell.value === undefined || cell.value === "") {
    return `<c r="${reference}"${styleId ? ` s="${styleId}"` : ""}/>`;
  }

  if (cell.value instanceof Date) {
    return `<c r="${reference}" s="2"><v>${excelDateSerial(cell.value)}</v></c>`;
  }

  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${styleId ? ` s="${styleId}"` : ""}><v>${cell.value}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"${styleId ? ` s="${styleId}"` : ""}><is><t xml:space="preserve">${escapeXml(
    String(cell.value),
  )}</t></is></c>`;
}

function cellStyleId(style: XlsxCell["style"]) {
  if (style === "header") {
    return 1;
  }

  if (style === "date") {
    return 2;
  }

  if (style === "wrap") {
    return 3;
  }

  return 0;
}

function excelDateSerial(date: Date) {
  return (date.getTime() - EXCEL_EPOCH_MS) / MS_PER_DAY;
}

function columnName(index: number) {
  let value = "";
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }

  return value;
}

function contentTypesXml(sheetCount: number) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function workbookRelationshipsXml(sheetCount: number) {
  const sheetRelationships = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function workbookXml(worksheets: XlsxWorksheet[]) {
  const sheets = worksheets
    .map(
      (worksheet, index) =>
        `<sheet name="${escapeXmlAttribute(safeSheetName(worksheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="m/d/yyyy h:mm AM/PM"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyBorder="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function appPropertiesXml(worksheets: XlsxWorksheet[]) {
  const titles = worksheets
    .map(
      (worksheet) =>
        `<vt:lpstr>${escapeXml(safeSheetName(worksheet.name))}</vt:lpstr>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SuppVis Admin</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${worksheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${worksheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts></Properties>`;
}

function corePropertiesXml(now: Date) {
  const iso = now.toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SuppVis Admin</dc:creator><cp:lastModifiedBy>SuppVis Admin</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
}

function safeSheetName(name: string) {
  const trimmed = name.replace(/[\[\]:*?/\\]/g, " ").trim();

  return (trimmed || "Sheet").slice(0, 31);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXml(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

type ZipFile = {
  data: Buffer;
  path: string;
};

function createZip(files: ZipFile[]) {
  const chunks: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;
  const { date, time } = zipDateTime(new Date());

  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const crc = crc32(file.data);
    const localHeader = Buffer.alloc(30 + name.length);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    name.copy(localHeader, 30);

    chunks.push(localHeader, file.data);

    const directoryHeader = Buffer.alloc(46 + name.length);

    directoryHeader.writeUInt32LE(0x02014b50, 0);
    directoryHeader.writeUInt16LE(20, 4);
    directoryHeader.writeUInt16LE(20, 6);
    directoryHeader.writeUInt16LE(0x0800, 8);
    directoryHeader.writeUInt16LE(0, 10);
    directoryHeader.writeUInt16LE(time, 12);
    directoryHeader.writeUInt16LE(date, 14);
    directoryHeader.writeUInt32LE(crc, 16);
    directoryHeader.writeUInt32LE(file.data.length, 20);
    directoryHeader.writeUInt32LE(file.data.length, 24);
    directoryHeader.writeUInt16LE(name.length, 28);
    directoryHeader.writeUInt32LE(offset, 42);
    name.copy(directoryHeader, 46);
    centralDirectory.push(directoryHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectory.reduce(
    (size, chunk) => size + chunk.length,
    0,
  );
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([...chunks, ...centralDirectory, end]);
}

function zipDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
