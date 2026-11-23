import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Write via temp file + rename so a crash never leaves half a file. */
export async function writeFileAtomic(path: string, data: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = join(dirname(path), `.${Math.random().toString(36).slice(2)}.tmp`)
  await fs.writeFile(tmp, data, 'utf8')
  await fs.rename(tmp, path)
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, JSON.stringify(value, null, 2))
}

/** Returns undefined when the file is missing or is not valid JSON. */
export async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

export async function readText(path: string): Promise<string | undefined> {
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

export type JsonState = { state: 'missing' } | { state: 'corrupt' } | { state: 'ok'; value: unknown }

/** Like readJson, but tells a missing file from an unreadable one. */
export async function readJsonState(path: string): Promise<JsonState> {
  let raw: string
  try {
    raw = await fs.readFile(path, 'utf8')
  } catch {
    return { state: 'missing' }
  }
  try {
    return { state: 'ok', value: JSON.parse(raw) }
  } catch {
    return { state: 'corrupt' }
  }
}

/** Moves a bad file aside (name.corrupt-<timestamp>) so the next write cannot destroy it. */
export async function quarantine(path: string): Promise<void> {
  try {
    await fs.rename(path, `${path}.corrupt-${Date.now()}`)
  } catch {
    /* nothing to move */
  }
}
