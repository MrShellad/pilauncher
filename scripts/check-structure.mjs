import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceRoot = path.join(repositoryRoot, 'src')
const policyPath = path.join(repositoryRoot, 'scripts', 'structure-policy.json')
const policy = JSON.parse(await readFile(policyPath, 'utf8'))

const toRepositoryPath = (absolutePath) =>
  path.relative(repositoryRoot, absolutePath).split(path.sep).join('/')

const exists = async (targetPath) => {
  try {
    await readdir(targetPath)
    return true
  } catch {
    try {
      await readFile(targetPath)
      return true
    } catch {
      return false
    }
  }
}

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const directories = []
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      directories.push(entryPath)
      const nested = await walk(entryPath)
      directories.push(...nested.directories)
      files.push(...nested.files)
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return { directories, files }
}

const countFiles = async (directory) => {
  if (!(await exists(directory))) return 0
  return (await walk(directory)).files.length
}

const { directories, files } = await walk(sourceRoot)
const errors = []
const notes = []
const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const legacyDirectories = new Set(policy.legacyDirectories)
const actualDirectoryPaths = new Set(directories.map(toRepositoryPath))
const forbiddenDirectories = new Set(policy.forbiddenDirectories ?? [])

for (const directory of directories) {
  const repositoryPath = toRepositoryPath(directory)
  if (!kebabCase.test(path.basename(directory)) && !legacyDirectories.has(repositoryPath)) {
    errors.push(`新增的非 kebab-case 目录：${repositoryPath}`)
  }
}

for (const legacyDirectory of legacyDirectories) {
  if (!actualDirectoryPaths.has(legacyDirectory)) {
    errors.push(`结构基线已过期，请从 legacyDirectories 移除：${legacyDirectory}`)
  }
}

for (const forbiddenDirectory of forbiddenDirectories) {
  if (actualDirectoryPaths.has(forbiddenDirectory)) {
    errors.push(`禁止重新创建已淘汰目录：${forbiddenDirectory}`)
  }
}

const pageDirectory = path.join(sourceRoot, 'pages')
const pageFiles = (await readdir(pageDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
  .map((entry) => `src/pages/${entry.name}`)
const legacyPages = new Set(policy.legacyPages)

for (const pageFile of pageFiles) {
  if (!pageFile.endsWith('Page.tsx') && !legacyPages.has(pageFile)) {
    errors.push(`新增页面必须以 Page.tsx 结尾：${pageFile}`)
  }
}

for (const legacyPage of legacyPages) {
  if (!pageFiles.includes(legacyPage)) {
    errors.push(`页面命名基线已过期，请从 legacyPages 移除：${legacyPage}`)
  }
}

for (const [deprecatedRoot, expectedFileCount] of Object.entries(policy.deprecatedRoots)) {
  const actualFileCount = await countFiles(path.join(repositoryRoot, deprecatedRoot))
  if (actualFileCount !== expectedFileCount) {
    errors.push(
      `${deprecatedRoot} 文件数从 ${expectedFileCount} 变为 ${actualFileCount}；` +
        '请迁移文件并同步降低 structure-policy.json 中的基线，禁止继续增加旧结构债务'
    )
  }
}

const sourceExtensions = new Set(['.ts', '.tsx', '.css'])
const sourceFiles = files.filter((file) => sourceExtensions.has(path.extname(file)))
const deepSourcePaths = sourceFiles.filter(
  (file) => toRepositoryPath(file).split('/').length - 1 > policy.ratchets.allowedSourcePathSegments
)

if (deepSourcePaths.length !== policy.ratchets.deepSourcePathCount) {
  errors.push(
    `深层源码路径基线为 ${policy.ratchets.deepSourcePathCount}，当前为 ${deepSourcePaths.length}；` +
      '结构改善时请同步降低基线，结构恶化则必须先调整设计'
  )
}

const moduleSpecifierPattern = /(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g
const crossFeatureImports = []

for (const file of sourceFiles.filter((candidate) => /\.[jt]sx?$/.test(candidate))) {
  const sourcePath = toRepositoryPath(file)
  const sourceSegments = sourcePath.split('/')
  if (sourceSegments[0] !== 'src' || sourceSegments[1] !== 'features') continue

  const sourceFeature = sourceSegments[2]
  const contents = await readFile(file, 'utf8')

  for (const match of contents.matchAll(moduleSpecifierPattern)) {
    const specifier = match[1]
    let targetSegments

    if (specifier.startsWith('.')) {
      targetSegments = toRepositoryPath(path.resolve(path.dirname(file), specifier)).split('/')
    } else if (specifier.startsWith('@/features/')) {
      targetSegments = ['src', ...specifier.slice(2).split('/')]
    } else {
      continue
    }

    if (targetSegments[0] !== 'src' || targetSegments[1] !== 'features') continue
    const targetFeature = targetSegments[2]
    if (!targetFeature || targetFeature === sourceFeature) continue

    const targetRemainder = targetSegments.slice(3)
    const usesPublicEntry =
      targetRemainder.length === 0 ||
      (targetRemainder.length === 1 && targetRemainder[0] === 'index')
    if (usesPublicEntry) continue

    const line = contents.slice(0, match.index).split('\n').length
    crossFeatureImports.push(`${sourcePath}:${line} -> ${specifier}`)
  }
}

if (crossFeatureImports.length !== policy.ratchets.crossFeatureDeepImportCount) {
  errors.push(
    `跨 Feature 深层导入基线为 ${policy.ratchets.crossFeatureDeepImportCount}，` +
      `当前为 ${crossFeatureImports.length}；结构改善时请同步降低基线，禁止新增内部耦合`
  )
}

notes.push(`遗留非 kebab-case 目录：${legacyDirectories.size}`)
notes.push(`遗留未使用 Page 后缀的页面：${legacyPages.size}`)
notes.push(`禁止重新出现的旧目录：${forbiddenDirectories.size}`)
notes.push(`超过 ${policy.ratchets.allowedSourcePathSegments} 段的源码路径：${deepSourcePaths.length}`)
notes.push(`跨 Feature 深层导入：${crossFeatureImports.length}`)

console.log('结构检查摘要')
for (const note of notes) console.log(`- ${note}`)

if (process.argv.includes('--details')) {
  console.log('\n深层源码路径')
  for (const file of deepSourcePaths.map(toRepositoryPath).sort()) console.log(`- ${file}`)
  console.log('\n跨 Feature 深层导入')
  for (const item of crossFeatureImports.sort()) console.log(`- ${item}`)
}

if (errors.length > 0) {
  console.error('\n结构检查失败')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('\n结构检查通过；未新增结构债务。')
}
