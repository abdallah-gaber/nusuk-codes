import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const load = async (path) => JSON.parse(await readFile(path, "utf8"));
const out = (value) => process.stdout.write(JSON.stringify(value, null, 2) + "\n");

function canonicalPost(link) {
  if (typeof link !== "string") return null;
  const url = URL.parse(link);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const xPost = /^\/mynusuk\/status\/(\d+)\/?$/i.exec(url.pathname);
  if (xPost && ["x.com", "twitter.com"].includes(url.hostname)) {
    return "https://x.com/MyNusuk/status/" + xPost[1];
  }
  const facebookPost = /^\/mynusuk\/posts\/([a-z0-9]+)\/?$/i.exec(url.pathname);
  if (facebookPost && ["facebook.com", "www.facebook.com"].includes(url.hostname)) {
    return "https://www.facebook.com/MyNusuk/posts/" + facebookPost[1];
  }
  return null;
}

function calendarDate(month, day, year) {
  const date = new Date(`${month} ${day}, ${year} 00:00:00 UTC`);
  if (!Number.isFinite(date.getTime()) || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString().slice(0, 10);
}

function oEmbedDate(evidence, source) {
  if (canonicalPost(evidence.url) !== source || evidence.author_url !== "https://x.com/MyNusuk") return null;
  // X's documented response supplies display HTML for this known permalink.
  const date = />([A-Z][a-z]+) (\d{1,2}), (\d{4})<\/a>\s*<\/blockquote>/.exec(evidence.html);
  return date && calendarDate(...date.slice(1));
}

function readPoster(lines) {
  const anchors = lines.filter((line) => /^Winner No\.?$/i.test(line.text) && Math.abs(line.x - 0.5) < 0.1);
  const note = anchors.length === 1 ? anchors[0] : null;
  if (!note) return { winnerOrdinal: null, displayName: null };
  const centerLines = lines.filter((line) => Math.abs(line.x - note.x) < 0.07);
  const digits = centerLines.filter((line) =>
    /^\d{1,3}$/.test(line.text) && line.y < note.y && note.y - line.y < 0.075,
  );
  if (digits.length !== 1) return { winnerOrdinal: null, displayName: null };
  const number = digits[0];
  const rowSpacing = note.y - number.y;
  const nameLines = centerLines.filter((line) =>
    Math.abs(line.y - (note.y + 2 * rowSpacing)) < rowSpacing * 0.42,
  );
  const name = nameLines.length === 1
    ? nameLines[0].text.replace(/[\u200e\u200f]/g, "").trim().normalize("NFC")
    : "";
  const nameShape = /^(?:[A-Z]+(?: [A-Z]+)+|[\p{Script=Arabic}\p{Mark}]+(?: [\p{Script=Arabic}\p{Mark}]+)+)$/u;
  return {
    winnerOrdinal: Number(number.text) || null,
    displayName: nameShape.test(name) && !/\p{Number}/u.test(name) ? name : null,
  };
}

function dateFromImage(lines) {
  const dates = lines.flatMap(({ text }) => {
    if (/last edited/i.test(text)) return [];
    const match = /\b(?:AM|PM)\b[^A-Za-z]*([A-Z][a-z]{2}) (\d{1,2}),\s*(\d{4})\b/.exec(text);
    return match ? [calendarDate(...match.slice(1))] : [];
  });
  return dates.length === 1 ? dates[0] : null;
}

async function extract(manifestPath, runtime, models) {
  const evidence = await load(manifestPath);
  const require = createRequire(resolve(runtime, "package.json"));
  const { createWorker, PSM } = require("tesseract.js");
  const worker = await createWorker(["eng", "ara"], 1, {
    langPath: resolve(models), gzip: false, cacheMethod: "none",
  });
  const rows = [];
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    for (const item of evidence) {
      const source = canonicalPost(item.url);
      const row = { sampleDay: item.sampleDay, announcementUrl: source, status: "review-required" };
      try {
        if (!source) throw new Error("No official permalink found");
        if (!(item.width > 0 && item.height > 0)) throw new Error("Missing capture dimensions");
        const image = await readFile(resolve(dirname(manifestPath), item.image));
        const { data } = await worker.recognize(image, {}, { blocks: true });
        const lines = (data.blocks ?? []).flatMap((block) =>
          block.paragraphs.flatMap((paragraph) => paragraph.lines.map(({ text, bbox }) => ({
            text: text.trim(),
            x: (bbox.x0 + bbox.x1) / (2 * item.width),
            y: (bbox.y0 + bbox.y1) / (2 * item.height),
          }))),
        );
        const imageDate = dateFromImage(lines);
        const embedDate = item.oEmbed
          ? oEmbedDate(await load(resolve(dirname(manifestPath), item.oEmbed)), source)
          : null;
        const announcedOn = imageDate && embedDate && imageDate !== embedDate ? null : (embedDate ?? imageDate);
        const country = typeof item.observedCountry === "string" && /^[A-Z]{2}$/.test(item.observedCountry)
          ? item.observedCountry : null;
        Object.assign(row, readPoster(lines), {
          announcedOn,
          imageDate,
          embedDate,
          country,
          countrySource: country ? "manual-poster-observation" : null,
          imageSha256: createHash("sha256").update(image).digest("hex"),
        });
      } catch (error) {
        row.error = error.message;
      }
      rows.push(row);
    }
  } finally {
    await worker.terminate();
  }
  return rows;
}

function score(rows, archive) {
  const fields = ["displayName", "country", "winnerOrdinal", "announcedOn", "announcementUrl"];
  return rows.map((row) => {
    const expected = archive.records.find((record) => record.announcedOn === row.sampleDay);
    if (!expected) return { sampleDay: row.sampleDay, error: "No expected row for sample date" };
    const checks = Object.fromEntries(fields.map((field) => [
      field, row[field] == null ? "missing" : row[field] === expected[field] ? "match" : "different",
    ]));
    return {
      sampleDay: row.sampleDay,
      checks,
      imageDateMatches: row.imageDate === expected.announcedOn,
      validated: Object.values(checks).every((check) => check === "match"),
    };
  });
}

const [command, input, ...args] = process.argv.slice(2);
try {
  if (command === "discover" && input && args.length === 0) {
    const urls = await load(input);
    out([...new Set(urls.map(canonicalPost).filter(Boolean))]);
  } else if (command === "extract" && input && args.length === 2) {
    out(await extract(input, ...args));
  } else if (command === "score" && input && args.length === 1) {
    out(score(await load(input), await load(args[0])));
  } else {
    throw new Error(
      "Usage: node poc.mjs discover LINKS.json | extract EVIDENCE.json NPM_PREFIX TESSDATA_DIR | score CANDIDATES.json ARCHIVE.json",
    );
  }
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
