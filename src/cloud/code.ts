// ---------------------------------------------------------------------------
// Secret codes: each person's key to their cloud backup + the Party view. No
// accounts or passwords — the code is generated once, saved on the phone, and
// typed in only when setting up a new phone. Format: three fantasy words + four
// digits, e.g. "ember-griffin-lantern-4271" (256³ × 10⁴ ≈ 37 bits — far beyond
// guessing). Matching is case/spacing/punctuation-insensitive.
// ---------------------------------------------------------------------------

export const CODE_WORDS = `amber anvil arrow ash aspen aurora axe badger banner bard basil beacon bear birch
blade blaze bloom boar bolt bone bow bramble brass breeze brook cairn candle canyon cape castle cedar
chalice charm cinder clover cobalt comet copper coral crane crest crow crown crystal dagger dawn deer
delta dove dragon drake drum dune dusk eagle echo elder elm ember falcon fang feather fern fig flame
flint forge fox frost gale garnet gem ghost glade glen goblet gold granite griffin grove gull hammer
harbor harp hawk hazel heron hearth helm hollow honey horn hound ice iris iron isle ivory ivy jade
jasper jay jewel juniper kestrel kettle key king kite knight lake lance lantern lark laurel leaf legend
lily lion lotus lute lynx mace maple marsh meadow mesa mint mist moon moss moth nectar nest night north
nova oak oasis ocean onyx opal orchid otter owl panther pearl pebble pepper petal phoenix pine plume
pony prism quail quartz queen quest quill rain raven reed ridge river robin rook rose ruby rune rust
saber sage salmon sapphire scroll seal shadow shield shore silver sky slate sparrow spark spear spire
spruce squire star steel stone storm summit sun swan sword talon thistle thorn thunder tide tiger timber
topaz torch tower trail trout tulip tundra valley vault velvet viper violet wand warden wave whale
willow wind wing winter wizard wolf wren yarrow yew zephyr acorn badge bison cobra cliff dew dusty elk
ermine fable fjord gecko geyser hilt ink jasmine koi lagoon lemur llama magpie mango marble meteor
mirth nimbus`.split(/\s+/)

/** Canonical form: lowercase words joined by single dashes ("Ember Griffin…" → "ember-griffin…"). */
export function normalizeCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Shortest code the server accepts — anything shorter is a typo, not a code. */
export const MIN_CODE_LENGTH = 16

export function looksLikeCode(raw: string): boolean {
  return normalizeCode(raw).length >= MIN_CODE_LENGTH
}

function randomInt(maxExclusive: number): number {
  // Rejection sampling over crypto-random bytes — no modulo bias.
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % maxExclusive
}

/** A fresh secret code, e.g. "ember-griffin-lantern-4271". */
export function generateCode(): string {
  const words = [0, 1, 2].map(() => CODE_WORDS[randomInt(CODE_WORDS.length)])
  const digits = String(randomInt(10_000)).padStart(4, '0')
  return [...words, digits].join('-')
}
