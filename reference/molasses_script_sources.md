# Slow as molasses — script, facts and sources

**Format:** 720×1280 vertical, 24 fps, 56.6 s, stereo→mono 48 kHz. Rendered with Babylon.js 8.33.3 in
headless Chrome (SwiftShader WebGL2), one posed frame at a time, no render loop. Narration from an edge-TTS
neural voice (en-US-GuyNeural, +8%), cut to the word timings that voice returns. Score and effects synthesised
in numpy (strings, footsteps, a tank groan, the burst, a cold bell).

## Narration (as recorded, with the beat it serves)

| # | line | beat |
|---|------|------|
| 1 | On January 15th, 1919, Boston was hit by a wave of molasses. It moved at 35 miles an hour. | hook |
| 2 | The tank held 2.3 million gallons. Enough to fill three and a half swimming pools. | setting |
| 3 | It leaked from day one. So the company painted it brown, to hide the stains. | the tell |
| 4 | Then, just after lunch, the steel tore. Twelve thousand tonnes of syrup became a wall eight metres high. | the snap |
| 5 | Luckily, molasses is slow. Unluckily, this one wasn't. | deadpan |
| 6 | It is one and a half times denser than water, so gravity alone gives it speed, like a mudslide. For thirty seconds it was a tsunami. Then it cooled, thickened, and stopped being a wave. | the learning |
| 7 | Twenty one people died. Boston's reply was a rule: engineers must sign and seal their plans. | consequence |
| 8 | The tank had been painted brown so nobody would notice it was already failing. | callback |

## Facts used, and where each comes from

- **Date and time:** 15 January 1919, around 12:30–12:40 pm, North End, Boston; tank at 529 Commercial Street.
  (City of Boston; Wikipedia)
- **Tank:** built December 1915, 50 ft tall, 90 ft in diameter, at the Purity Distilling Company facility.
  (City of Boston; Wikipedia)
- **Volume:** 2.3 million US gallons ≈ 8,700 m³ ≈ 3.5 Olympic swimming pools; about 13,000 short tons
  (~12,000 t) of molasses. (Wikipedia; HISTORY)
- **Wave:** reported at 25 ft (≈8 m) peak, about 160 ft wide, moving at an estimated 35 mph (56 km/h) for
  roughly two blocks. Modern gravity-current modelling (Sharp et al., APS DFD 2016) reproduces that order of
  speed; the "35 mph" figure is the widely reported estimate rather than a measurement.
- **Casualties:** 21 killed, about 150 injured. (City of Boston; Wikipedia)
- **The leaks:** the tank leaked from its first fill, was never hydro-tested, and was painted brown-red to
  disguise the seeping molasses. (City of Boston; TIME; APS News)
- **Cause:** steel plates too thin for the load (0.31–0.67 in), low-manganese brittle steel, unreinforced rivet
  holes (Mayville, 2014); the last top-off came two days before, after a warm shipment. (HISTORY; CSMonitor)
- **Physics:** molasses ≈1.5× the density of water and several thousand times more viscous; when released from
  height it moves as a *gravity current* — dense fluid spreading into a lighter one — like a mudslide or
  avalanche. Viscosity rises steeply as it cools, so the same fluid that arrived as a wave became a trap.
  (Scientific American; New Scientist; The Guardian)
- **Aftermath:** a court-appointed auditor found the owners negligent in 1925; Boston's response included
  requiring engineers to sign and seal plans and inspectors to examine projects. (City of Boston, citing
  Stephen Puleo, *Dark Tide*)

## Sources

1. City of Boston — "100 years ago today: Molasses crashes through Boston's North End"
2. Wikipedia — "Great Molasses Flood"
3. Boston.com — "5 questions you may have about Boston's deadly Great Molasses Flood, answered" (Nicole Sharp)
4. Scientific American — "The Science of the Great Molasses Flood"
5. HISTORY — "Why the Great Molasses Flood Was So Deadly"
6. New Scientist — "Incredible physics behind the deadly 1919 Boston Molasses Flood"
7. The Guardian — "Study reveals why so many met a sticky end in Boston's Great Molasses Flood"
8. APS News — "This Month in Physics History" (January 2017)

## Build notes

- Story, characters and voice are original; no reference video, script or channel was reused.
- Every shot boundary is derived from a word in the narration (`timeline.json`), so the picture and the voice
  cannot drift: the tear lands on the word "tore", the slump on "cooled".
- QA on the frame sequence: no black frames, no blown frames, no frozen spans longer than 5 frames,
  luma 62–245 across the piece.
