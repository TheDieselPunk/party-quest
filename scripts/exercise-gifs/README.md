# Exercise GIF pipeline

Maps our curated exercises (`src/data/exercises.ts`) to animated demos from the
open [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset),
bundles the matched GIFs into `public/exercise-gifs/`, and generates
`src/data/gifs.ts` (the `exerciseId → /exercise-gifs/<id>.gif` map).

The result is committed, so you only need to re-run this when you add/rename
exercises or want to re-pick matches.

## Regenerate

```bash
# 1. Get the dataset JSON (~17 MB) into this folder:
curl -L -o exercises.json https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/data/exercises.json

# 2. Auto-match every exercise → dataset entry (writes mapping.json):
node match.mjs .

# 3. Apply manual overrides / drop no-match exercises (writes final-mapping.json + gif-files.txt):
node finalize.mjs .

# 4. Download the matched GIFs (into ./gifs, ~5.4 MB):
node download.mjs .

# 5. Copy into the app + generate src/data/gifs.ts:
node install-gifs.mjs . ../..
```

`final-mapping.json` is the source of truth for which dataset clip each exercise
uses. Edit the `REPICK` / `NOGIF` tables in `finalize.mjs` to change matches.

Exercises with no good match in the dataset (face pull, barbell/Smith hip thrust,
band pull-apart) intentionally have no GIF — their cards still show setup cues.
