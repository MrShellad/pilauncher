import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const lucideEntryPath = fileURLToPath(
  new URL('./node_modules/lucide-react/dist/esm/lucide-react.js', import.meta.url)
)

const createLucideExportMap = () => {
  const source = readFileSync(lucideEntryPath, 'utf8')
  const exportsByName = new Map<string, string>()
  const exportPattern = /export\s+\{([^}]+)\}\s+from\s+['"]\.\/icons\/([^'"]+)['"]/g

  for (const match of source.matchAll(exportPattern)) {
    const [, specifiers, iconFile] = match
    for (const specifier of specifiers.split(',')) {
      const exportName = specifier.trim().match(/^default\s+as\s+([A-Za-z0-9_$]+)$/)?.[1]
      if (exportName) {
        exportsByName.set(exportName, `lucide-react/dist/esm/icons/${iconFile}`)
      }
    }
  }

  return exportsByName
}

const lucideDirectImportPlugin = (): Plugin => {
  let exportsByName: Map<string, string> | undefined

  return {
    name: 'pilauncher:lucide-direct-imports',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id) || !code.includes('lucide-react')) {
        return null
      }

      exportsByName ??= createLucideExportMap()
      let changed = false
      const importPattern = /import\s+\{([^;]*?)\}\s+from\s+['"]lucide-react['"];?/g

      const transformed = code.replace(importPattern, (fullImport, specifierBlock: string) => {
        const directImports: string[] = []
        const typeImports: string[] = []
        const fallbackImports: string[] = []

        for (const rawSpecifier of specifierBlock.split(',')) {
          const specifier = rawSpecifier.trim()
          if (!specifier) continue

          if (specifier.startsWith('type ')) {
            typeImports.push(specifier.slice(5).trim())
            continue
          }

          const match = specifier.match(/^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/)
          if (!match) {
            fallbackImports.push(specifier)
            continue
          }

          const [, importedName, localName = importedName] = match
          const directPath = exportsByName?.get(importedName)

          if (directPath) {
            directImports.push(`import ${localName} from '${directPath}';`)
          } else {
            fallbackImports.push(specifier)
          }
        }

        if (directImports.length === 0 && fallbackImports.length === 0) {
          return fullImport
        }

        changed = true

        return [
          typeImports.length > 0 ? `import type { ${typeImports.join(', ')} } from 'lucide-react';` : '',
          fallbackImports.length > 0 ? `import { ${fallbackImports.join(', ')} } from 'lucide-react';` : '',
          ...directImports
        ].filter(Boolean).join('\n')
      })

      return changed ? { code: transformed, map: null } : null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [lucideDirectImportPlugin(), react()],
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom/client',
      'zustand',
      'i18next',
      'react-i18next',
      'framer-motion',
      '@tauri-apps/api/core',
      '@tauri-apps/api/event',
      '@tauri-apps/api/path',
      '@tauri-apps/api/window',
      '@noriginmedia/norigin-spatial-navigation',
      'lucide-react/dist/esm/createLucideIcon.js',
      'lucide-react/dist/esm/Icon.js',
      'lucide-react/dist/esm/defaultAttributes.js'
    ],
    exclude: ['lucide-react']
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          if (normalizedId.includes('/skinview3d')) {
            return 'skinviewer-vendor'
          }

          if (normalizedId.includes('/three/examples/jsm/')) {
            return 'three-examples'
          }

          if (normalizedId.includes('/three/build/') || normalizedId.includes('/three/src/')) {
            return 'three-core'
          }

          if (normalizedId.includes('/framer-motion/')) {
            return 'motion-vendor'
          }

          if (normalizedId.includes('/lucide-react/')) {
            return 'icons-vendor'
          }

          if (normalizedId.includes('/@tauri-apps/')) {
            return 'tauri-vendor'
          }

          if (normalizedId.includes('/react-dom/') || normalizedId.includes('/react-router-dom/')) {
            return 'react-runtime'
          }

          if (
            normalizedId.includes('/react/') ||
            normalizedId.includes('/scheduler/') ||
            normalizedId.includes('/use-sync-external-store/')
          ) {
            return 'react-core'
          }

          if (
            normalizedId.includes('/i18next/') ||
            normalizedId.includes('/react-i18next/') ||
            normalizedId.includes('/zustand/')
          ) {
            return 'app-state-vendor'
          }

          if (normalizedId.includes('/@noriginmedia/norigin-spatial-navigation/')) {
            return 'focus-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    watch: {
      ignored: ['**/flatpak/**']
    }
  }
})
