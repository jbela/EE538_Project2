import JSZip from "jszip";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { extFromName } from "@/lib/uploads";

function stripXmlText(xml: string): string {
  const parts: string[] = [];
  const re = /<a:t>([^<]*)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    });
  const chunks: string[] = [];
  for (const name of names) {
    const file = zip.files[name];
    if (!file) continue;
    const xml = await file.async("string");
    const t = stripXmlText(xml);
    if (t) chunks.push(t);
  }
  return chunks.join("\n\n");
}

/**
 * Extract readable text from supported uploads for summarization / quiz corpus.
 */
export async function extractTextFromUpload(buffer: Buffer, originalName: string): Promise<string> {
  const ext = extFromName(originalName);

  if (ext === "txt" || ext === "md") {
    return buffer.toString("utf8").trim();
  }

  if (ext === "pdf") {
    const data = await pdfParse(buffer);
    return String(data.text || "").replace(/\s+/g, " ").trim();
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return String(result.value || "").replace(/\s+/g, " ").trim();
  }

  if (ext === "pptx") {
    return (await extractPptxText(buffer)).replace(/\s+/g, " ").trim();
  }

  if (ext === "doc" || ext === "ppt") {
    return "";
  }

  if (ext === "rtf") {
    const raw = buffer.toString("latin1");
    const stripped = raw
      .replace(/\\'[0-9a-f]{2}/gi, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ");
    return stripped.replace(/\s+/g, " ").trim();
  }

  return "";
}
