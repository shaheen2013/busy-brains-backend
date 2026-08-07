# Runbook: Module 5 Quest 1 ↔ Quest 2 swap — Production

This documents a change already completed and verified on **staging**. This
runbook is for repeating it safely on **production**. Read the whole thing
before touching anything — the steps must happen in the right order or you
will make completed users' progress disappear from their dashboard/report.

## Background

The frontend (`busy-brains-frontend`, branch `update-implementation`) swapped
the content that lives at Module 5 Quest 1 and Quest 2:

- New Quest 1 (4 screens): the "senses/situations" content. Its answer is
  saved by the frontend as `module_5_quest_1_saved_situations` on screen 3.
- New Quest 2 (2 screens): the "toolkit builder" content. Its answer is saved
  as `module_5_quest_2_saved_toolkit` on screen 1.

This is the **opposite** of the old layout (old quest 1 = toolkit, 2 screens;
old quest 2 = situations, 3 screens).

Three independent things had to change to match this, and all three matter:

1. **`child_quests.questNo`** in the DB — which quest a child's existing
   progress row is numbered as.
2. **Backend code** — `src/constants/module-registry.ts` (screen counts per
   quest), `src/modules/dashboard/dashboard.service.ts` (`resolveScreenData`
   calls that hardcode `(moduleNo, questNo, screenNo)` tuples), and
   `src/common/toolkit-report-html.util.ts` (a hardcoded JSON key it reads
   out of a screen's `data` blob).
3. **Existing saved screen data** — any child who already completed
   Quest 1/2 *before* this swap has their answer sitting at the **old**
   screen number, under the **old** literal JSON key. Steps 1+2 alone make
   that data invisible to the dashboard/report — it has to be relocated.

Skipping step 3 doesn't crash anything — it just silently makes previously
completed answers show as "pending" in the dashboard and toolkit PDF report
for any child who played before the swap.

## What already shipped on staging (reference, do not redo on staging)

- Commit `3453fa9` on `staging` branch: registry screen counts (`quest 1: 4
  screens, quest 2: 2 screens`), `dashboard.service.ts` `resolveScreenData`
  calls repointed to `(5, 2, 1)` for toolkit and `(5, 1, 3)` for situations,
  and the toolkit-report key renamed to `module_5_quest_2_saved_toolkit`.
- A DB script that swapped `questNo` 1↔2 for every `child_quests` row under
  Module 5 for existing children.
- A DB script that relocated existing screen answers to the new
  screen/key convention (see Step 4 below for the exact logic).

Use these staging commits/diffs as the reference for what "correct" looks
like — don't re-derive the code changes from scratch, just confirm they're
already present on whatever branch is being merged to prod, and adapt the
SQL below with prod's actual data.

## Pre-flight checks (do these before changing anything)

1. **Confirm the frontend prod deploy is ready to go out at the same time.**
   If the frontend swap goes live before the backend registry change, the
   frontend will post 4 screens to a quest the backend still thinks has 2
   (or vice versa) — screen-save calls will fail validation for real users
   mid-quest. These two deploys must land together, not staggered.
2. **Confirm the backend code changes are merged onto whatever branch prod
   deploys from** (e.g. `staging` → `main`/`prod-deploy-pipeline`, per this
   repo's flow). Do not run the DB scripts before the code is ready to go
   out — see "Ordering" below.
3. **Re-run the discovery query on prod — do not assume staging's numbers.**
   Find every child who has touched Module 5 Quest 1 or 2 on prod:

   ```sql
   SELECT cq."questNo", COUNT(DISTINCT cm."childId") AS kids_touched
   FROM child_modules cm
   JOIN child_quests cq ON cq."moduleId" = cm.id
   WHERE cm."moduleNo" = 5 AND cq."questNo" IN (1,2)
   GROUP BY cq."questNo";
   ```

   Then pull the actual saved data for those children (adapt from Step 4's
   discovery query) and **check the key names and screen numbers actually
   found in prod** — don't assume they match staging's pattern exactly.
   Production data could be cleaner (real users only, no QA stray keys) or
   could have its own surprises. Verify, don't assume.
4. **Take a backup / exportable snapshot of the affected rows before
   touching anything.** Unlike the questNo swap (which is its own inverse —
   running it twice undoes it), the screen-data relocation in Step 4
   overwrites and nulls out rows, and is not trivially reversible. Export
   the affected `child_quests` and `child_screens` rows to a file first:

   ```sql
   \copy (SELECT cs.* FROM child_screens cs
          JOIN child_quests cq ON cq.id = cs."questId"
          JOIN child_modules cm ON cm.id = cq."moduleId"
          WHERE cm."moduleNo" = 5 AND cq."questNo" IN (1,2))
     TO '/tmp/module5_screens_backup_prod.csv' WITH CSV HEADER;
   ```

   Copy that file off the container before proceeding.
5. **This step touches real user data. Confirm explicitly with the human
   operator before running anything that writes to the production
   database.** Do not treat approval given for staging as approval for
   prod — ask again, separately, and state exactly which SQL you're about
   to run.

## Ordering (this is the part most likely to go wrong)

Do NOT run the DB `questNo` swap until the backend code deploy that reads
the new positions/keys is actually live. Between "DB swapped" and "code
deployed," dashboard reads will be inconsistent (old code reading swapped
DB numbers). Prefer the shortest possible gap between these two:

1. Deploy backend code (registry + dashboard + report changes) to prod.
2. Deploy frontend code (the `update-implementation` swap) to prod, at the
   same time.
3. Immediately after both are confirmed live, run the DB `questNo` swap
   (Step 3).
4. Immediately after, run the screen-data relocation (Step 4).

If real users interact with Module 5 Quest 1/2 in the gap between 1/2 and
3/4, re-check their data afterward — treat step 3's pre-flight query as
something to re-run right before executing, not something to trust from
earlier in the day.

## Step 3 — questNo swap (per child, per environment)

Two-phase update to dodge the `UNIQUE(moduleId, questNo)` constraint.
Always run inside a transaction, inspect the before/after snapshot, and only
`COMMIT` after the human operator confirms it looks right.

```sql
BEGIN;

SELECT cm."childId", cq.id AS quest_id, cq."questNo", cq."isCompleted"
FROM child_quests cq
JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE cm."moduleNo" = 5 AND cq."questNo" IN (1, 2)
ORDER BY cm."childId", cq."questNo";

UPDATE child_quests cq
SET "questNo" = -cq."questNo"
FROM child_modules cm
WHERE cm.id = cq."moduleId" AND cm."moduleNo" = 5 AND cq."questNo" IN (1, 2);

UPDATE child_quests cq
SET "questNo" = CASE cq."questNo" WHEN -1 THEN 2 WHEN -2 THEN 1 END
FROM child_modules cm
WHERE cm.id = cq."moduleId" AND cm."moduleNo" = 5 AND cq."questNo" IN (-1, -2);

SELECT cm."childId", cq.id AS quest_id, cq."questNo", cq."isCompleted"
FROM child_quests cq
JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE cm."moduleNo" = 5 AND cq."questNo" IN (1, 2)
ORDER BY cm."childId", cq."questNo";

-- Only after confirming the same quest_id rows now carry the opposite
-- questNo, and nothing else changed:
-- COMMIT;
```

Note: piping this through `docker exec -i psql` via SSH auto-rolls back on
EOF unless you explicitly append `COMMIT;` to the input after review — don't
pipe blind, run it interactively or review output before appending commit.

## Step 4 — relocate existing screen data

For every child found in the pre-flight discovery query whose saved data
uses the **old** key/position convention (verify this per-child — do not
blindly assume 100% of prod matches this pattern):

- Toolkit answer: move from quest 2/screen 2 → quest 2/screen 1, rename key
  `module_5_quest_1_saved_toolkit` → `module_5_quest_2_saved_toolkit`.
- Situations answer: move from quest 1/screen 2 → quest 1/screen 3, rename
  key `module_5_quest_2_saved_situations` → `module_5_quest_1_saved_situations`.

```sql
BEGIN;

-- before snapshot (adapt from staging's fix_module5_screen_data_staging.sql)

UPDATE child_screens tgt
SET data = (src.data - 'module_5_quest_1_saved_toolkit')
           || jsonb_build_object('module_5_quest_2_saved_toolkit',
                                  src.data -> 'module_5_quest_1_saved_toolkit'),
    "isCompleted" = src."isCompleted",
    "completedAt" = src."completedAt"
FROM child_screens src
JOIN child_quests cq ON cq.id = src."questId"
JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE tgt."questId" = src."questId" AND tgt."screenNo" = 1 AND src."screenNo" = 2
  AND cq."questNo" = 2 AND cm."moduleNo" = 5
  AND src.data ? 'module_5_quest_1_saved_toolkit';

UPDATE child_screens src
SET data = NULL, "isCompleted" = false, "completedAt" = NULL
FROM child_quests cq JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE src."questId" = cq.id AND cq."questNo" = 2 AND cm."moduleNo" = 5
  AND src."screenNo" = 2 AND src.data ? 'module_5_quest_1_saved_toolkit';

UPDATE child_screens tgt
SET data = (src.data - 'module_5_quest_2_saved_situations')
           || jsonb_build_object('module_5_quest_1_saved_situations',
                                  src.data -> 'module_5_quest_2_saved_situations'),
    "isCompleted" = src."isCompleted",
    "completedAt" = src."completedAt"
FROM child_screens src
JOIN child_quests cq ON cq.id = src."questId"
JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE tgt."questId" = src."questId" AND tgt."screenNo" = 3 AND src."screenNo" = 2
  AND cq."questNo" = 1 AND cm."moduleNo" = 5
  AND src.data ? 'module_5_quest_2_saved_situations';

UPDATE child_screens src
SET data = NULL, "isCompleted" = false, "completedAt" = NULL
FROM child_quests cq JOIN child_modules cm ON cm.id = cq."moduleId"
WHERE src."questId" = cq.id AND cq."questNo" = 1 AND cm."moduleNo" = 5
  AND src."screenNo" = 2 AND src.data ? 'module_5_quest_2_saved_situations';

-- after snapshot, compare against before, then:
-- COMMIT;
```

Do **not** blindly run the "scrub stray key" statement from the staging
script — that was specific to a QA artifact found in one staging test
account (`955d268f`). Only add an equivalent cleanup on prod if you find a
genuinely analogous stray/orphaned key during the pre-flight inspection —
don't assume it's needed.

## Step 5 — verify

For at least one affected prod child:

- Call/inspect `dashboard.service.ts`'s `getDashboard()` output (or hit the
  dashboard endpoint) and confirm `favourite_tools_data.status` and
  `real_life_tools_data.status` show `"completed"` with non-empty `data`,
  not `"pending"`.
- Generate the toolkit PDF report for that child and confirm the favourite
  tools section renders instead of being empty.

## Things that will bite you if skipped

- Running the DB swap before the code is deployed (dashboard reads garbled
  data in the gap).
- Assuming prod's data shape matches staging exactly instead of re-querying.
- Skipping the pre-change backup/export — Step 4 is not cleanly reversible
  once committed.
- Treating a prior approval (e.g. for staging) as approval for the prod run.
  Confirm again, explicitly, before writing to the production DB.
