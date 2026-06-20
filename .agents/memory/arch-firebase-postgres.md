---
name: Arquitetura Firebase vs PostgreSQL
description: O frontend lê/escreve diretamente no Firestore. O Express API usa PostgreSQL separadamente. Nunca confundir as duas camadas de dados.
---

## Regra
O frontend (`financas-legends`) usa **Firebase/Firestore** para todos os dados:
- missions → coleção `"missions"` no Firestore
- userMissions → coleção `"userMissions"` no Firestore  
- collaborators, users → Firestore

O Express API (`api-server`) tem tabelas PostgreSQL **separadas** (via Drizzle ORM) usadas para algumas rotas backend (aprovações, logs de eventos, cálculo de progresso).

## Por que isso importa
Qualquer "seed" ou criação de dados que o **frontend precisa ver** DEVE ir para o Firestore (via `lib/db.ts` do frontend, ou diretamente pela Firebase Admin SDK). Escrever no PostgreSQL via `@workspace/db` NÃO aparece no frontend.

**Why:** `seedAlbumPercentMissions` em `mission-utils.ts` falhava com "relation missions does not exist" porque tentava escrever no PostgreSQL, mas as missões exibidas no admin são do Firestore. A solução correta é criar missões via `createMission` (Firestore) no frontend admin.

## Como aplicar
- Para criar dados que o frontend vê: use Firestore (coleções via Firebase SDK)
- Para processar eventos no backend: Express API + PostgreSQL está ok
- `tickAutoMissions` no `lib/db.ts` do frontend já gerencia `album_percent` no Firestore automaticamente
- O botão "Missões padrão" em admin.tsx cria as missões de 80% e 100% no Firestore via `createMission`
