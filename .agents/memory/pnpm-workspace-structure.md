---
name: Estrutura pnpm workspace Finanças Legends
description: Como o workspace pnpm está organizado e como Replit/GitHub Actions encontram o pacote correto
---

# Estrutura pnpm workspace

## Regra
O Replit roda de `album/` (pnpm workspace root). O pacote `@workspace/financas-legends` está em `album/artifacts/package.json`. A vite root deve ser `album/artifacts/` (não `/home/runner/workspace/` root).

**Why:** React e outras deps são instaladas em `album/node_modules/.pnpm/` (pnpm virtual store). Se vite root for ROOT, node_modules traversal não encontra react porque `album/node_modules/react` não é hoisted. Com root = `album/artifacts/`, o pnpm cria `album/artifacts/node_modules/` com symlinks corretos para as deps.

**How to apply:**
- `album/pnpm-workspace.yaml` precisa ter `- artifacts` na lista de packages
- `album/artifacts/vite.config.ts` deve ter `root: path.resolve(import.meta.dirname)` (= album/artifacts/)
- Após adicionar um novo pacote ao workspace: rodar `pnpm install --prefer-offline` de `album/`
- GitHub Actions: `working-directory: album` + `pnpm --filter @workspace/financas-legends run build`
- Build outDir: `album/artifacts/financas-legends/dist/public` (matches artifact.toml)

## Source files
- Source real: `album/artifacts/src/` (tem TODOS os arquivos: pages/, hooks/, lib/, components/, main.tsx)
- ROOT `src/` também existe mas pode ficar desatualizado — sempre editar em `album/artifacts/src/`

## GitHub Actions (deploy.yml)
- Instala deps de `album/`: `working-directory: album && pnpm install`
- Faz build do pacote: `pnpm --filter @workspace/financas-legends run build`
- Upload: `album/artifacts/financas-legends/dist/public`
- Segredo GitHub: `VITE_FIREBASE_API_KEY`
