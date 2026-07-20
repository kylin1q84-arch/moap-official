import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const outputDir = join(projectRoot, 'dist')

// 这些网页文件目前直接位于项目根目录，
// 不再要求额外存在 src 文件夹。
const sourceFiles = [
  'index.html',
  'app.js',
  'style.css',
  'certified-data.js',
]

// 清空并重新创建输出目录
await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

// 检查并复制正式网页文件
for (const filename of sourceFiles) {
  const sourcePath = join(projectRoot, filename)
  const outputPath = join(outputDir, filename)

  try {
    const fileInfo = await stat(sourcePath)

    if (!fileInfo.isFile()) {
      throw new Error(`${filename} is not a file`)
    }
  } catch {
    throw new Error(
      `MOAP build failed: missing required file ${sourcePath}`
    )
  }

  await copyFile(sourcePath, outputPath)
}

// 从 Vercel 环境变量生成浏览器端 Supabase 配置
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''

if (!supabaseUrl) {
  throw new Error(
    'MOAP build failed: NEXT_PUBLIC_SUPABASE_URL is missing in Vercel Environment Variables.'
  )
}

if (!supabaseKey) {
  throw new Error(
    'MOAP build failed: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing in Vercel Environment Variables.'
  )
}

await writeFile(
  join(outputDir, 'config.js'),
  `export const MOAP_CONFIG = ${JSON.stringify({
    supabaseUrl,
    supabaseKey,
  })};\n`,
  'utf8'
)

console.log('MOAP Cloud build completed successfully.')
console.log(`Output directory: ${outputDir}`)
console.log('Supabase URL: configured')
console.log('Supabase key: configured')
