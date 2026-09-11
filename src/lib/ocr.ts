import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { DayOfWeek, Subject } from '../types'

/** Best-effort match so an imported row is pre-linked to a subject the user already created. */
export function matchSubjectId(guess: string, subjects: Subject[]): string | null {
  const lower = guess.toLowerCase()
  const found = subjects.find((s) => {
    const name = s.name.toLowerCase().trim()
    return name.length > 2 && (lower.includes(name) || name.includes(lower))
  })
  return found?.id ?? null
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const DAY_NAME_TO_INDEX: Record<string, DayOfWeek> = {
  dimanche: 0, sunday: 0, sun: 0,
  lundi: 1, monday: 1, mon: 1,
  mardi: 2, tuesday: 2, tue: 2, tues: 2,
  mercredi: 3, wednesday: 3, wed: 3,
  jeudi: 4, thursday: 4, thu: 4, thur: 4, thurs: 4,
  vendredi: 5, friday: 5, fri: 5,
  samedi: 6, saturday: 6, sat: 6,
}

// Matches "8:30_10:00", "8:30-10:00" and "08:00 - 10:00" alike — timetables commonly
// use an underscore in column headers and a hyphen for in-cell overrides.
const TIME_RANGE_RE = /(\d{1,2})[:h](\d{2})\s*[-–—_]\s*(\d{1,2})[:h](\d{2})/
const GROUP_CODE_RE = /^[A-Z]{2,8}\d?(?:_[A-Z0-9]+){1,4},?$/
const ROOM_CODE_RE = /^[A-Z]-?\d{1,3}$/
const NAME_RE = /^[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+[A-ZÀ-Ý][A-Za-zà-ÿ'-]*){1,3}$/

export interface ParsedTimetableRow {
  raw: string
  day: DayOfWeek | null
  start_minute: number | null
  end_minute: number | null
  title: string
  groups: string[]
  /** Set when this row and another share the same day/time/group but a different subject —
   * the classic signature of a class that only meets "par quinzaine" (every other week). */
  possiblyBiweekly: boolean
  biweeklyPairKey: string | null
}

function timeMatchToMinutes(m: RegExpExecArray, groupOffset: 0 | 2): number {
  const hour = parseInt(m[1 + groupOffset], 10)
  const minute = parseInt(m[2 + groupOffset], 10)
  return hour * 60 + minute
}

function makeRow(partial: Partial<ParsedTimetableRow> & { raw: string }): ParsedTimetableRow {
  return {
    day: null,
    start_minute: null,
    end_minute: null,
    title: 'Class',
    groups: [],
    possiblyBiweekly: false,
    biweeklyPairKey: null,
    ...partial,
  }
}

/**
 * Flags pairs of rows that occupy the same day and overlapping time, and share at least one
 * student group code, but describe a different subject — they can only both be real if they
 * alternate weeks. Mutates the given rows in place.
 */
function detectBiweeklyPairs(rows: ParsedTimetableRow[]): void {
  let pairCounter = 0
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    if (a.day === null || a.start_minute === null || a.end_minute === null || a.groups.length === 0) continue
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j]
      if (b.day !== a.day || b.start_minute === null || b.end_minute === null) continue
      if (a.title === b.title) continue
      const overlaps = a.start_minute < b.end_minute && b.start_minute < a.end_minute
      if (!overlaps) continue
      const sharesGroup = a.groups.some((g) => b.groups.includes(g))
      if (!sharesGroup) continue

      const key = a.biweeklyPairKey ?? b.biweeklyPairKey ?? `pair-${pairCounter++}`
      a.possiblyBiweekly = true
      b.possiblyBiweekly = true
      a.biweeklyPairKey = key
      b.biweeklyPairKey = key
    }
  }
}

// ---------------------------------------------------------------------------
// Structured extraction for native (non-scanned) PDFs — reads the PDF's own text
// layer and its on-page coordinates to reconstruct the day/time grid, instead of
// rasterizing to an image and OCR-ing it. Far more accurate whenever available.
// ---------------------------------------------------------------------------

interface PositionedItem {
  str: string
  x: number
  y: number
}

function buildTitle(rawLines: string[], groups: string[]): { title: string; groups: string[] } {
  const teacher: string[] = []
  const room: string[] = []
  const subject: string[] = []
  const allGroups = [...groups]

  for (const line of rawLines) {
    const cleaned = line.trim()
    if (!cleaned) continue
    if (GROUP_CODE_RE.test(cleaned)) {
      allGroups.push(cleaned.replace(/,$/, ''))
    } else if (ROOM_CODE_RE.test(cleaned)) {
      room.push(cleaned)
    } else if (NAME_RE.test(cleaned)) {
      teacher.push(cleaned)
    } else {
      subject.push(cleaned)
    }
  }

  const parts = [subject.join(' '), teacher.join(' '), room.join(', ')].filter(Boolean)
  return { title: parts.join(' · ') || 'Class', groups: [...new Set(allGroups)] }
}

async function extractStructuredFromPdf(file: File): Promise<ParsedTimetableRow[] | null> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const allRows: ParsedTimetableRow[] = []
  let totalChars = 0

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: PositionedItem[] = content.items
      .map((it) => {
        const anyIt = it as { str?: string; transform?: number[] }
        return { str: (anyIt.str ?? '').trim(), x: Math.round(anyIt.transform?.[4] ?? 0), y: Math.round(anyIt.transform?.[5] ?? 0) }
      })
      .filter((it) => it.str.length > 0)
    totalChars += items.reduce((sum, it) => sum + it.str.length, 0)

    const dayRows = items
      .filter((it) => DAY_NAME_TO_INDEX[it.str.toLowerCase()] !== undefined)
      .sort((a, b) => b.y - a.y)
    if (dayRows.length === 0) continue

    // Column headers: the topmost band of items matching a time range, clustered by x.
    const timeItems = items.filter((it) => TIME_RANGE_RE.test(it.str))
    const headerY = timeItems.length > 0 ? Math.max(...timeItems.map((it) => it.y)) : null
    const headerItems =
      headerY !== null ? timeItems.filter((it) => Math.abs(it.y - headerY) < 6).sort((a, b) => a.x - b.x) : []

    const columns = headerItems.map((h) => {
      const m = TIME_RANGE_RE.exec(h.str)!
      return { x: h.x, start: timeMatchToMinutes(m, 0), end: timeMatchToMinutes(m, 2) }
    })
    const colBoundaries = columns.map((c, i) => (i === 0 ? -Infinity : Math.round((columns[i - 1].x + c.x) / 2)))
    colBoundaries.push(Infinity)
    const colIndex = (x: number) => {
      for (let i = 0; i < columns.length; i++) {
        if (x >= colBoundaries[i] && x < colBoundaries[i + 1]) return i
      }
      return columns.length - 1
    }

    const dayBoundaries = dayRows.map((d, i) => ({
      day: DAY_NAME_TO_INDEX[d.str.toLowerCase()],
      top: i === 0 ? (headerY ?? Infinity) : Math.round((dayRows[i - 1].y + d.y) / 2),
      bottom: i === dayRows.length - 1 ? -Infinity : Math.round((d.y + dayRows[i + 1].y) / 2),
    }))
    const dayForY = (y: number) => dayBoundaries.find((b) => y < b.top && y >= b.bottom)?.day ?? null

    const leftmostDataX = Math.min(...dayRows.map((d) => d.x)) + 40
    const dataItems = items.filter((it) => it.x > leftmostDataX && (headerY === null || it.y < headerY))

    const buckets = new Map<string, PositionedItem[]>()
    for (const it of dataItems) {
      const day = dayForY(it.y)
      if (day === null) continue
      const col = columns.length > 0 ? colIndex(it.x) : 0
      const key = `${day}|${col}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(it)
    }

    for (const [key, lines] of buckets) {
      const [dayStr, colStr] = key.split('|')
      const day = Number(dayStr) as DayOfWeek
      const col = Number(colStr)
      const nominal = columns[col]
      lines.sort((a, b) => b.y - a.y)

      let current: { start: number | null; end: number | null; rawLines: string[] } | null = null
      const sessionsInBucket: Array<{ start: number | null; end: number | null; rawLines: string[] }> = []

      for (const line of lines) {
        const m = TIME_RANGE_RE.exec(line.str)
        if (m) {
          if (current) sessionsInBucket.push(current)
          current = { start: timeMatchToMinutes(m, 0), end: timeMatchToMinutes(m, 2), rawLines: [] }
        } else {
          if (!current) current = { start: nominal?.start ?? null, end: nominal?.end ?? null, rawLines: [] }
          current.rawLines.push(line.str)
        }
      }
      if (current) sessionsInBucket.push(current)

      for (const s of sessionsInBucket) {
        if (s.rawLines.length === 0) continue
        const { title, groups } = buildTitle(s.rawLines, [])
        allRows.push(
          makeRow({
            raw: s.rawLines.join(' | '),
            day,
            start_minute: s.start,
            end_minute: s.end,
            title,
            groups,
          })
        )
      }
    }
  }

  // A scanned/image-only PDF has no real text layer — fall back to OCR for those.
  if (totalChars < 30) return null

  detectBiweeklyPairs(allRows)
  return allRows.filter((r) => r.start_minute !== null && r.end_minute !== null && r.end_minute > r.start_minute)
}

// ---------------------------------------------------------------------------
// Fallback: OCR for images / scanned PDFs with no usable text layer.
// ---------------------------------------------------------------------------

function to24hLoose(hourStr: string, minStr: string | undefined, meridiem: string | undefined, otherMeridiem?: string): number {
  let hour = parseInt(hourStr, 10)
  const minute = minStr ? parseInt(minStr, 10) : 0
  const m = (meridiem ?? otherMeridiem)?.toLowerCase()
  if (m === 'pm' && hour < 12) hour += 12
  if (m === 'am' && hour === 12) hour = 0
  if (!m && hour >= 1 && hour <= 6) hour += 12
  return hour * 60 + minute
}

const LOOSE_TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

/** Turns raw OCR text into best-guess timetable rows for the user to review and correct. */
export function parseTimetableText(text: string): ParsedTimetableRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: ParsedTimetableRow[] = []
  let currentDay: DayOfWeek | null = null

  for (const line of lines) {
    const dayMatch = Object.keys(DAY_NAME_TO_INDEX).find((name) => new RegExp(`\\b${name}\\b`, 'i').test(line))
    if (dayMatch) currentDay = DAY_NAME_TO_INDEX[dayMatch]

    const timeMatch = LOOSE_TIME_RE.exec(line)
    if (!timeMatch) continue

    const [, h1, m1, ampm1, h2, m2, ampm2] = timeMatch
    const start_minute = to24hLoose(h1, m1, ampm1, ampm2)
    const end_minute = to24hLoose(h2, m2, ampm2, ampm1)

    let title = line
      .replace(LOOSE_TIME_RE, ' ')
      .replace(dayMatch ? new RegExp(`\\b${dayMatch}\\b`, 'i') : /$^/, ' ')
      .replace(/[|,;:_\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title) title = 'Class'

    if (end_minute > start_minute) {
      rows.push(makeRow({ raw: line, day: dayMatch ? DAY_NAME_TO_INDEX[dayMatch] : currentDay, start_minute, end_minute, title }))
    }
  }

  detectBiweeklyPairs(rows)
  return rows
}

async function fileToImageDataUrl(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    return canvas.toDataURL('image/png')
  }
  return URL.createObjectURL(file)
}

// ---------------------------------------------------------------------------
// Exam schedule import — dates instead of days-of-week, otherwise the same
// two-tier strategy: read a native PDF's text layer directly, fall back to
// on-device OCR for photos/scanned PDFs.
// ---------------------------------------------------------------------------

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  janvier: 1, january: 1, jan: 1,
  février: 2, fevrier: 2, february: 2, feb: 2,
  mars: 3, march: 3, mar: 3,
  avril: 4, april: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6, jun: 6,
  juillet: 7, july: 7, jul: 7,
  août: 8, aout: 8, august: 8, aug: 8,
  septembre: 9, september: 9, sep: 9, sept: 9,
  octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11,
  décembre: 12, decembre: 12, december: 12, dec: 12,
}
const MONTH_NAMES_PATTERN = Object.keys(MONTH_NAME_TO_INDEX)
  .sort((a, b) => b.length - a.length)
  .join('|')
const MONTH_NAME_RE_GLOBAL = new RegExp(`\\b(${MONTH_NAMES_PATTERN})\\.?\\b`, 'gi')

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Best-effort date parser covering ISO, DD/MM/YYYY, and "14 September" / "September 14" forms. */
function parseDateFromLine(line: string, referenceDate: Date): string | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(line)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(line)
  if (m) {
    const day = parseInt(m[1], 10)
    const month = parseInt(m[2], 10)
    let year = parseInt(m[3], 10)
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return isoDate(year, month, day)
  }

  const dayMonthRe = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES_PATTERN})\\.?\\s*(\\d{4})?\\b`, 'i')
  m = dayMonthRe.exec(line)
  if (m) {
    const day = parseInt(m[1], 10)
    const month = MONTH_NAME_TO_INDEX[m[2].toLowerCase()]
    const year = m[3] ? parseInt(m[3], 10) : referenceDate.getFullYear()
    return rollForwardIfPast(isoDate(year, month, day), referenceDate, !m[3])
  }

  const monthDayRe = new RegExp(`\\b(${MONTH_NAMES_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i')
  m = monthDayRe.exec(line)
  if (m) {
    const month = MONTH_NAME_TO_INDEX[m[1].toLowerCase()]
    const day = parseInt(m[2], 10)
    return rollForwardIfPast(isoDate(referenceDate.getFullYear(), month, day), referenceDate, true)
  }

  return null
}

/** A year-less date more than ~2 months in the past is almost certainly meant for next year. */
function rollForwardIfPast(candidate: string, referenceDate: Date, allowRoll: boolean): string {
  if (!allowRoll) return candidate
  const diffDays = (new Date(candidate).getTime() - referenceDate.getTime()) / 86_400_000
  if (diffDays < -60) {
    const [y, mo, d] = candidate.split('-').map(Number)
    return isoDate(y + 1, mo, d)
  }
  return candidate
}

export interface ParsedExamRow {
  raw: string
  exam_date: string | null // ISO yyyy-MM-dd
  start_minute: number | null
  end_minute: number | null
  subject_guess: string
}

/** Turns raw text (from a PDF's text layer or OCR) into best-guess exam rows for review. */
export function parseExamScheduleText(text: string, referenceDate: Date = new Date()): ParsedExamRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: ParsedExamRow[] = []
  let currentDate: string | null = null

  for (const line of lines) {
    const date = parseDateFromLine(line, referenceDate)
    if (date) currentDate = date

    const timeMatch = LOOSE_TIME_RE.exec(line)
    if (!timeMatch) continue

    const [, h1, m1, ampm1, h2, m2, ampm2] = timeMatch
    const start_minute = to24hLoose(h1, m1, ampm1, ampm2)
    const end_minute = to24hLoose(h2, m2, ampm2, ampm1)
    if (end_minute <= start_minute) continue

    let subject_guess = line
      .replace(LOOSE_TIME_RE, ' ')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
      .replace(MONTH_NAME_RE_GLOBAL, ' ')
      .replace(/\b\d{1,2}(st|nd|rd|th)\b/gi, ' ')
      .replace(/[|,;:_\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!subject_guess) subject_guess = 'Exam'

    rows.push({ raw: line, exam_date: date ?? currentDate, start_minute, end_minute, subject_guess })
  }

  return rows
}

/** Reads a PDF's text layer as plain reading-order lines (not grid-clustered — exam schedules
 * are usually simple lists/tables, unlike the weekly day/time grid a class timetable uses). */
async function extractPdfPlainText(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const lines: string[] = []
  let totalChars = 0

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: PositionedItem[] = content.items
      .map((it) => {
        const anyIt = it as { str?: string; transform?: number[] }
        return { str: (anyIt.str ?? '').trim(), x: Math.round(anyIt.transform?.[4] ?? 0), y: Math.round(anyIt.transform?.[5] ?? 0) }
      })
      .filter((it) => it.str.length > 0)
    totalChars += items.reduce((sum, it) => sum + it.str.length, 0)

    items.sort((a, b) => b.y - a.y || a.x - b.x)
    let lastY: number | null = null
    let currentLine: string[] = []
    for (const it of items) {
      if (lastY !== null && Math.abs(it.y - lastY) > 4) {
        lines.push(currentLine.join(' '))
        currentLine = []
      }
      currentLine.push(it.str)
      lastY = it.y
    }
    if (currentLine.length) lines.push(currentLine.join(' '))
  }

  if (totalChars < 20) return null // scanned/image-only PDF — fall back to OCR
  return lines.join('\n')
}

export async function extractExamScheduleFromFile(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ text: string; rows: ParsedExamRow[]; method: ExtractionMethod }> {
  if (file.type === 'application/pdf') {
    onProgress?.('reading pdf text', 0.2)
    const text = await extractPdfPlainText(file)
    if (text) {
      onProgress?.('done', 1)
      return { text, rows: parseExamScheduleText(text), method: 'pdf-text' }
    }
  }

  const imageSource = await fileToImageDataUrl(file)
  const worker = await createWorker('eng', undefined, {
    logger: (m) => onProgress?.(m.status, m.progress),
  })

  try {
    const { data } = await worker.recognize(imageSource)
    return { text: data.text, rows: parseExamScheduleText(data.text), method: 'ocr-image' }
  } finally {
    await worker.terminate()
  }
}

// ---------------------------------------------------------------------------
// Assignment/syllabus deadline import — same idea as exams but date-only (no
// time-of-day block), since a deliverable is "due by" a date, not scheduled
// into a slot.
// ---------------------------------------------------------------------------

export interface ParsedAssignmentRow {
  raw: string
  due_date: string | null // ISO yyyy-MM-dd
  title_guess: string
}

/** Turns raw text (from a PDF's text layer or OCR) into best-guess assignment rows for review. */
export function parseAssignmentScheduleText(text: string, referenceDate: Date = new Date()): ParsedAssignmentRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: ParsedAssignmentRow[] = []

  for (const line of lines) {
    const date = parseDateFromLine(line, referenceDate)
    if (!date) continue

    let title_guess = line
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
      .replace(MONTH_NAME_RE_GLOBAL, ' ')
      .replace(/\b\d{1,2}(st|nd|rd|th)\b/gi, ' ')
      .replace(/\bdue\b/gi, ' ')
      .replace(/[|,;:_\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title_guess) title_guess = 'Assignment'

    rows.push({ raw: line, due_date: date, title_guess })
  }

  return rows
}

export async function extractAssignmentScheduleFromFile(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ text: string; rows: ParsedAssignmentRow[]; method: ExtractionMethod }> {
  if (file.type === 'application/pdf') {
    onProgress?.('reading pdf text', 0.2)
    const text = await extractPdfPlainText(file)
    if (text) {
      onProgress?.('done', 1)
      return { text, rows: parseAssignmentScheduleText(text), method: 'pdf-text' }
    }
  }

  const imageSource = await fileToImageDataUrl(file)
  const worker = await createWorker('eng', undefined, {
    logger: (m) => onProgress?.(m.status, m.progress),
  })

  try {
    const { data } = await worker.recognize(imageSource)
    return { text: data.text, rows: parseAssignmentScheduleText(data.text), method: 'ocr-image' }
  } finally {
    await worker.terminate()
  }
}

export type ExtractionMethod = 'pdf-text' | 'ocr-image'

export async function extractTimetableFromFile(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ text: string; rows: ParsedTimetableRow[]; method: ExtractionMethod }> {
  if (file.type === 'application/pdf') {
    onProgress?.('reading pdf text', 0.2)
    const structured = await extractStructuredFromPdf(file)
    if (structured && structured.length > 0) {
      onProgress?.('done', 1)
      return { text: structured.map((r) => r.raw).join('\n'), rows: structured, method: 'pdf-text' }
    }
  }

  const imageSource = await fileToImageDataUrl(file)
  const worker = await createWorker('eng', undefined, {
    logger: (m) => onProgress?.(m.status, m.progress),
  })

  try {
    const { data } = await worker.recognize(imageSource)
    const rows = parseTimetableText(data.text)
    return { text: data.text, rows, method: 'ocr-image' }
  } finally {
    await worker.terminate()
  }
}
