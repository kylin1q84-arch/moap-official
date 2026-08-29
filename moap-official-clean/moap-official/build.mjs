import { copyFile, cp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const outputDir = join(projectRoot, 'dist')
const sourceFiles = [
  'index.html',
  'app.js',
  'animations.js',
  'style.css',
  'certified-data.js',
  'honor-details.js',
  'analytics-engine.js',
  'records-engine.js',
  'goat-engine.js',
  'data-validation.js',
]

await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

for (const filename of sourceFiles) {
  const sourcePath = join(projectRoot, filename)
  const outputPath = join(outputDir, filename)
  try {
    const info = await stat(sourcePath)
    if (!info.isFile()) throw new Error(`${filename} is not a file`)
  } catch {
    throw new Error(`MOAP build failed: missing required file ${sourcePath}`)
  }
  await copyFile(sourcePath, outputPath)
}

try {
  const assetsPath = join(projectRoot, 'assets')
  const info = await stat(assetsPath)
  if (info.isDirectory()) await cp(assetsPath, join(outputDir, 'assets'), { recursive: true })
} catch {
  // 头像资源尚未提供时允许正常构建；后续只需添加 assets/players/*.png。
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

if (!supabaseUrl) throw new Error('MOAP build failed: NEXT_PUBLIC_SUPABASE_URL is missing in Vercel Environment Variables.')
if (!supabaseKey) throw new Error('MOAP build failed: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing in Vercel Environment Variables.')

await writeFile(
  join(outputDir, 'config.js'),
  `export const MOAP_CONFIG = ${JSON.stringify({ supabaseUrl, supabaseKey })};\n`,
  'utf8'
)

console.log('MOAP v2.3.0 Matchup & Honor Detail Upgrade build completed successfully.')
console.log('Supabase URL: configured')
console.log('Supabase key: configured')
console.log('Honor details: included')
console.log('Directional precise matchup matrix: included')
console.log('Unique honor engine: included')
console.log('MSL form center and S1-current career evaluation: included')
console.log('Single/continuous record center and expanded data leaderboard: included')
console.log('Fixed GOAT model and data validation: included')

console.log('Monthly report, immersive ambient background, centered record tables, season personal data, matchup detail page and current-season OVR: included')
