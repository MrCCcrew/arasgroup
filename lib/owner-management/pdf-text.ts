import path from "node:path";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

type PositionedText = { text: string; x: number; y: number };
type OcrWorker = {
  recognize: (image: Buffer, options?: object, output?: { tsv?: boolean }) => Promise<{ data: { tsv?: string | null } }>;
  terminate: () => Promise<unknown>;
};

export type NbkVisualRow = {
  pageNumber: number;
  rawRowText: string;
  transactionDate?: string;
  branchCode?: string;
  description: string;
  postingDate?: string;
  amount?: string;
  balance?: string;
  mid?: string;
  transactionReference?: string;
  balanceVerified?: boolean;
  y: number;
};

export type ExtractedPdf = { pages: string[]; pageCount: number; visualRows: NbkVisualRow[] };

GlobalWorkerOptions.workerSrc = `file://${path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs").replace(/\\/g, "/")}`;

async function createPdfCanvas(width: number, height: number) {
  const canvas = await import(/* webpackIgnore: true */ "@napi-rs/canvas") as { createCanvas: (width: number, height: number) => any };
  return canvas.createCanvas(width, height);
}

async function createOcrWorker(): Promise<OcrWorker> {
  const tesseract = await import(/* webpackIgnore: true */ "tesseract.js") as { createWorker: (languages: string) => Promise<OcrWorker> };
  return tesseract.createWorker("eng");
}

function decimal(value?: string) {
  return value && /^-?[\d,]+\.\d{2,3}$/.test(value) ? value.replace(/,/g, "") : undefined;
}

function date(value?: string) {
  return value && /^(?:\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(value) ? value : undefined;
}

function visualRows(pageNumber: number, items: PositionedText[]): NbkVisualRow[] {
  // Current NBK statements are left-to-right: Posting date, description,
  // details, transaction date, amount, balance. Their multi-line details
  // must be grouped beneath the posting-date row anchor.
  const anchors = items
    .filter((item) => item.x < 90 && Boolean(date(item.text)))
    .sort((a, b) => b.y - a.y);
  if (anchors.length > 0) {
    return anchors.map((anchor, index) => {
      const nextY = anchors[index + 1]?.y ?? -Infinity;
      const rowBottom = nextY === -Infinity ? -Infinity : (anchor.y + nextY) / 2;
      const inRow = (item: PositionedText, minX: number, maxX: number) => item.x >= minX && item.x < maxX && item.y <= anchor.y + 22 && item.y > rowBottom;
      const description = items
        .filter((item) => inRow(item, 90, 330))
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.text)
        .join(" ");
      const transactionDate = items.find((item) => inRow(item, 330, 400) && Boolean(date(item.text)))?.text;
      const amount = items.find((item) => inRow(item, 400, 480) && Boolean(decimal(item.text)))?.text;
      const balance = items.find((item) => inRow(item, 480, Infinity) && Boolean(decimal(item.text)))?.text;
      const rowItems = items.filter((item) => item.y <= anchor.y + 22 && item.y > rowBottom).sort((a, b) => b.y - a.y || a.x - b.x);
      return {
        pageNumber,
        rawRowText: rowItems.map((item) => item.text).join(" "),
        transactionDate,
        postingDate: anchor.text,
        description,
        amount,
        balance,
        y: anchor.y,
      };
    }).filter((row) => Boolean(row.transactionDate && row.amount));
  }

  // Legacy NBK layout retained for existing statement formats.
  const grouped: Array<{ y: number; items: PositionedText[] }> = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = grouped.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (row) row.items.push(item);
    else grouped.push({ y: item.y, items: [item] });
  }

  return grouped.flatMap(({ y, items: rowItems }) => {
    const ordered = rowItems.sort((a, b) => a.x - b.x);
    const transactionDate = date(ordered.find((item) => item.x >= 470)?.text);
    const branch = ordered.find((item) => item.x >= 420 && item.x < 470)?.text;
    // A real table row always contains the rightmost transaction date and branch.
    if (!transactionDate || !/^\d{4,5}$/.test(branch ?? "")) return [];
    const balance = decimal(ordered.find((item) => item.x < 90)?.text);
    const amount = decimal(ordered.find((item) => item.x >= 90 && item.x < 170)?.text);
    const postingDate = date(ordered.find((item) => item.x >= 170 && item.x < 235)?.text);
    const description = ordered.filter((item) => item.x >= 235 && item.x < 420).map((item) => item.text).join(" ");
    return [{ pageNumber, rawRowText: ordered.map((item) => item.text).join(" "), transactionDate, branchCode: branch, description, postingDate, amount, balance, y }];
  });
}

type OcrMidLine = { y: number; text: string; mid: string; transactionReference?: string };

function ocrMidLines(tsv: string, pageHeight: number, scale: number): OcrMidLine[] {
  const lines = new Map<string, { top: number; height: number; words: string[] }>();
  for (const source of tsv.split(/\r?\n/).slice(1)) {
    const fields = source.split("\t");
    if (fields.length < 12) continue;
    const [level, page, block, paragraph, line, , left, top, width, height, , ...text] = fields;
    if (level !== "5" || !text.join("\t").trim()) continue;
    const key = [page, block, paragraph, line].join(":");
    const current = lines.get(key) ?? { top: Number(top), height: Number(height), words: [] };
    current.top = Math.min(current.top, Number(top));
    current.height = Math.max(current.height, Number(height));
    current.words.push(text.join("\t"));
    lines.set(key, current);
  }
  const ordered = [...lines.values()].map((line) => ({ ...line, text: line.words.join(" "), y: pageHeight - ((line.top + line.height / 2) / scale) }));
  return ordered.flatMap((line, index) => {
    const match = /\bMID\s*[:.-]?\s*(\d{8,12})\b/i.exec(line.text);
    if (!match) return [];
    const afterMid = `${line.text.slice((match.index ?? 0) + match[0].length)} ${ordered[index + 1]?.text ?? ""}`;
    return [{ y: line.y, text: line.text, mid: match[1], transactionReference: afterMid.match(/\b\d{12,24}\b/)?.[0] }];
  });
}

function addOcrDetails(rows: NbkVisualRow[], ocr: OcrMidLine[]) {
  for (const entry of ocr) {
    const row = rows.reduce<NbkVisualRow | undefined>((closest, candidate) => !closest || Math.abs(candidate.y - entry.y) < Math.abs(closest.y - entry.y) ? candidate : closest, undefined);
    if (!row || Math.abs(row.y - entry.y) > 18) continue;
    row.mid = entry.mid;
    row.transactionReference = entry.transactionReference;
    row.description = [row.description, entry.text].filter(Boolean).join(" ").trim();
    row.rawRowText = [row.rawRowText, entry.text].filter(Boolean).join(" ").trim();
  }
}

function verifyBalances(rows: NbkVisualRow[]) {
  for (let index = 0; index < rows.length - 1; index++) {
    const current = rows[index]; const next = rows[index + 1];
    if (!current.balance || !next.balance || !current.amount) continue;
    const difference = Number(next.balance) - Number(current.balance);
    current.balanceVerified = Math.abs(Math.abs(difference) - Math.abs(Number(current.amount))) < 0.011;
  }
}

/** Rebuilds the NBK transaction table from PDF coordinates; OCR only augments MID text. */
export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdf> {
  const standardFontDataUrl = `${path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")}${path.sep}`;
  const document = await getDocument({ data: Uint8Array.from(bytes), standardFontDataUrl, disableFontFace: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  const allRows: NbkVisualRow[] = [];
  let worker: OcrWorker | null = null;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = (content.items as Array<{ str?: string; transform?: number[] }>).flatMap((item) => {
        const text = item.str?.trim(); const x = item.transform?.[4]; const y = item.transform?.[5];
        return text && x !== undefined && y !== undefined ? [{ text, x, y }] : [];
      });
      const rows = visualRows(pageNumber, items);
      // Text-based NBK files already contain the MID/reference in the details
      // column. Avoid rendering and OCRing every page, which can time out on
      // long statements. OCR remains only as a fallback for legacy rows that
      // truly lack extractable MID text.
      if (rows.length > 0 && items.length < 20 && rows.some((row) => !/\bMID\s*[:.-]?\s*\d{8,12}\b/i.test(row.rawRowText))) {
        const viewport = page.getViewport({ scale: 3 });
        const canvas = await createPdfCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d") as any;
        await page.render({ canvasContext: context, viewport }).promise;
        worker ??= await createOcrWorker();
        const result = await worker.recognize(Buffer.from(await canvas.encode("png")), {}, { tsv: true });
        addOcrDetails(rows, ocrMidLines(result.data.tsv ?? "", page.getViewport({ scale: 1 }).height, 3));
      }
      verifyBalances(rows);
      allRows.push(...rows);
      pages.push(rows.map((row) => row.rawRowText).join("\n"));
    }
  } finally {
    await worker?.terminate();
  }
  return { pages, pageCount: document.numPages, visualRows: allRows };
}
