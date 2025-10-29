import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import removeMd from "remove-markdown";

export type ExportFormat = "pdf" | "docx" | "csv" | "txt";

export interface ExportResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export async function exportContent(
  content: string,
  format: ExportFormat,
  filename?: string
): Promise<ExportResult> {
  switch (format) {
    case "txt":
      return toTxt(content);
    case "csv":
      return toCsv(content);
    case "docx":
      return await toDocx(content);
    case "pdf":
    default:
      return await toPdf(content);
  }
}

function toTxt(content: string): ExportResult {
  const plain = removeMd(content || "").trim();
  return {
    buffer: Buffer.from(plain, "utf8"),
    mimeType: "text/plain",
    extension: "txt",
  };
}

function toCsv(content: string): ExportResult {
  const csv = markdownToCsv(content || "");
  return {
    buffer: Buffer.from(csv, "utf8"),
    mimeType: "text/csv",
    extension: "csv",
  };
}

async function toDocx(content: string): Promise<ExportResult> {
  const lines = (content || "").split(/\r?\n/);
  const paragraphs: Paragraph[] = [];
  let inCode = false;
  for (const line of lines) {
    const fence = line.trim().startsWith("```");
    if (fence) {
      inCode = !inCode;
      continue; // skip fence lines
    }
    if (inCode) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: { ascii: "Consolas" } })],
        })
      );
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].replace(/\s*#+\s*$/, "").trim();
      const headingLevel =
        level === 1
          ? HeadingLevel.TITLE
          : level === 2
          ? HeadingLevel.HEADING_1
          : level === 3
          ? HeadingLevel.HEADING_2
          : level === 4
          ? HeadingLevel.HEADING_3
          : level === 5
          ? HeadingLevel.HEADING_4
          : HeadingLevel.HEADING_5;
      paragraphs.push(
        new Paragraph({
          text,
          heading: headingLevel,
        })
      );
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "" }));
    } else {
      paragraphs.push(new Paragraph({ text: removeMd(line) }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  };
}

async function toPdf(content: string): Promise<ExportResult> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  return await new Promise<ExportResult>((resolve, reject) => {
  doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        mimeType: "application/pdf",
        extension: "pdf",
      });
    });

    // Basic markdown-ish rendering: headings, code blocks, lists
    const lines = (content || "").split(/\r?\n/);
    let inCode = false;
    doc.fontSize(12);

    for (const rawLine of lines) {
      const line = rawLine || "";
      if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
        inCode = !inCode;
        if (inCode) {
          doc.moveDown(0.5);
          doc.font("Courier").fontSize(10);
        } else {
          doc.font("Helvetica").fontSize(12).moveDown(0.5);
        }
        continue;
      }

      if (inCode) {
        doc.text(line, { continued: false });
        continue;
      }

      const m = /^(#{1,6})\s+(.*)$/.exec(line);
      if (m) {
        const level = m[1].length;
        const text = m[2].replace(/\s*#+\s*$/, "").trim();
        const size = level === 1 ? 20 : level === 2 ? 18 : level === 3 ? 16 : 14;
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(size).text(text).moveDown(0.2).font("Helvetica").fontSize(12);
        continue;
      }

      const list = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
      if (list) {
        const item = list[1];
        doc.circle(doc.x + 2, doc.y + 6, 1.5).fillColor("black").fill();
        doc.fillColor("black").text("   " + removeMd(item));
        continue;
      }

      if (line.trim() === "") {
        doc.moveDown(0.5);
      } else {
        doc.text(removeMd(line));
      }
    }

    doc.end();
  });
}

function markdownToCsv(md: string): string {
  const trimmed = (md || "").trim();
  if (!trimmed) return "";

  // 1) Try fenced ```csv block
  const csvFence = /```csv\n([\s\S]*?)\n```/i.exec(trimmed);
  if (csvFence) return csvFence[1].trim();

  // 2) Try JSON array code block
  const jsonFence = /```json\n([\s\S]*?)\n```/i.exec(trimmed);
  if (jsonFence) {
    try {
      const arr = JSON.parse(jsonFence[1]);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") {
        const headers = Array.from(new Set(arr.flatMap((o: any) => Object.keys(o))));
        const rows = arr.map((o: any) => headers.map((h) => csvEscape(o[h])));
        return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      }
    } catch {}
  }

  // 3) Try markdown table
  const tableMatch = /\n\|(.+?)\|\n\|([\-:\s\|]+)\|\n([\s\S]+?)\n\n/m.exec("\n" + trimmed + "\n\n");
  if (tableMatch) {
    const header = tableMatch[1].split("|").map((s) => s.trim()).filter(Boolean);
    const bodyLines = tableMatch[3]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && l.endsWith("|"));
    const rows = bodyLines.map((l) => l.substring(1, l.length - 1).split("|").map((s) => csvEscape(s.trim())));
    return [header.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  // 4) Fallback: one-column CSV from lines
  return trimmed
    .split(/\r?\n/)
    .map((l) => csvEscape(removeMd(l)))
    .join("\n");
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
