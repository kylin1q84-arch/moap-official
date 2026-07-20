import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(projectRoot, 'src')
const outputDir = join(projectRoot, 'dist')

try {
  const sourceStat = await stat(sourceDir)
  if (!sourceStat.isDirectory()) throw new Error('src is not a directory')
} catch {
  throw new Error(`MOAP build failed: missing source folder at ${sourceDir}. The src folder must be beside package.json and build.mjs.`)
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

for (const file of await readdir(sourceDir)) {
  const sourceFile = join(sourceDir, file)
  const fileStat = await stat(sourceFile)
  if (fileStat.isFile()) await copyFile(sourceFile, join(outputDir, file))
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

await writeFile(
  join(outputDir, 'config.js'),
  `export const MOAP_CONFIG=${JSON.stringify({ supabaseUrl, supabaseKey })};\n`,
  'utf8',
)

console.log(`MOAP Cloud v2.1 build ready. Supabase URL: ${supabaseUrl ? 'configured' : 'MISSING'}; Key: ${supabaseKey ? 'configured' : 'MISSING'}`)
