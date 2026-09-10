import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { DayOfWeek } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const DAY_TOKENS: Array<{ re: RegExp; day: DayOfWeek }> = [
  { re: /\bsun(day)?\b/i, day: 0 },
  { re: /\bmon(day)?\b/i, day: 1 },
  { re: /\btue(s|sday)?\b/i, day: 2 },
  { re: /\bwed(nesday)?\b/i, day: 3 },
  { re: /\bthu(rs|rsday)?\b/i, day: 4 },
  { re: /\bfri(day)?\b/i, day: 5 },
  { re: /\bsat(urday)?\b/i, day: 6 },
]

const TIME_RANGE_RE =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

export interface ParsedTimetableRow {
  raw: string
  day: DayOfWeek | null
  start_minute: number | null
  end_minute: number | null
  title: string
}

function to24h(hourStr: string, minStr: string | undefined, meridiem: string | undefined, otherMeridiem?: string): number {
  let hour = parseInt(hourStr, 10)
  const minute = minStr ? parseInt(minStr, 10) : 0
  const m = (meridiem ?? otherMeridiem)?.toLowerCase()
  if (m === 'pm' && hour < 12) hour += 12
  if (m === 'am' && hour === 12) hour = 0
  // Heuristic: a lone hour like "2" with no am/pm in a school timetable is usually the afternoon (2pm) if < 7.
  if (!m && hour >= 1 && hour <= 6) hour += 12
  return hour * 60 + minute
}

/** Turns raw OCR text into best-guess timetable rows for the user to review and correct. */
export function parseTimetableText(text: string): ParsedTimetableRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const rows: ParsedTimetableRow[] = []
  let currentDay: DayOfWeek | null = null

  for (const line of lines) {
    const dayMatch = DAY_TOKENS.find((d) => d.re.test(line))
    if (dayMatch) currentDay = dayMatch.day

    const timeMatch = TIME_RANGE_RE.exec(line)
    if (!timeMatch) continue

    const [, h1, m1, ampm1, h2, m2, ampm2] = timeMatch
    const start_minute = to24h(h1, m1, ampm1, ampm2)
    const end_minute = to24h(h2, m2, ampm2, ampm1)

    let title = line
      .replace(TIME_RANGE_RE, ' ')
      .replace(dayMatch ? dayMatch.re : /$^/, ' ')
      .replace(/[|,;:_\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title) title = 'Class'

    if (end_minute > start_minute) {
      rows.push({ raw: line, day: dayMatch ? dayMatch.day : currentDay, start_minute, end_minute, title })
    }
  }

  return rows
}

async function fileToImageBitmapSource(file: File): Promise<string> {
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

export async function extractTimetableFromFile(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ text: string; rows: ParsedTimetableRow[] }> {
  const imageSource = await fileToImageBitmapSource(file)

  const worker = await createWorker('eng', undefined, {
    logger: (m) => onProgress?.(m.status, m.progress),
  })

  try {
    const { data } = await worker.recognize(imageSource)
    const rows = parseTimetableText(data.text)
    return { text: data.text, rows }
  } finally {
    await worker.terminate()
  }
}
