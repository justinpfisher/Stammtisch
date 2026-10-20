# Stammtisch Social Club — Brand and Editorial Style Guide

**Version 1.3 · 19 October 2026 · Owner-selected editorial, history, visual-description and actual cocktail-photography direction**

**Purpose:** The practical reference for AI and human contributors updating the public Stammtisch website, Annals, Club History and Celebration of Life presentation. This establishes a consistent visual identity and editorial voice; it is not a new publication-approval step or a source of club rules.

**Authority:** Follow AGENTS.md and the owner's latest explicit decisions. For verified club facts, consult club-context-and-history.md; for publication, consent, portraits, exact quotations and redactions, consult annals-publication-guidelines.md; for CoL operative meaning and changes, consult adopted rules and the qualified amendment process. The present guide directs presentation **only**. Do not allow style to override evidence, privacy, correctness, accessibility or operational safeguards.

## 1. Editorial north star

> **The proceedings are treated with a gravity entirely disproportionate to the business at hand.**

This is approved homepage copy and the defining standard for voice. Do not manufacture a competing motto that explains the joke or turns the friendship into a slogan.

Six longtime friends take the ordinary act of gathering and present it with the precision, dignity and exaggerated administrative gravity of a venerable institution. The apparent importance is comically inflated; the loyalty and friendships underneath are genuine. Nothing needs to be explained to the visitor.

The Club is an informal social club, **not** a commercial brewery, public association with asserted legal status, drinking contest, or an institution with invented powers and obligations. Beer and cocktails belong to its social and creative history, but do not define every member.

The monthly Stammtisch — the third Friday, **8 p.m. Toronto time**, location arranged privately — is the primary public-facing tradition. The off-site Annual Gentlemen's Assembly is separate. The Annals preserve real submissions. The evolving Club History is its own evidence-grounded narrative. Celebration of Life has independent adopted rules and a respectful commemorative purpose.

### Established principles

**I. Intention** — Make time for the company.

**II. Consistency** — Keep the tradition of showing up.

**III. Ceremony** — Give the occasion its due.

Treat these as values and editorial themes, not a mandate to create further governance, responsibilities or recurring rituals.

## 2. Brand character

- **Personality:** Heritage-minded, cultivated, precise, amused, affectionate, slightly self-important.
- **What the reader should perceive:** A select company treating relatively modest proceedings as matters worthy of a permanent record.
- **What the reader should feel:** There is a real friendship here; the ridiculousness is intentional.
- **Primary comic contrast:** Institutional formality versus ordinary social life.
- **Visual register:** Old social club, polished editorial publication, restrained pub heritage — not a novelty beer label or corporate intranet.
- **Important restraint:** Never pretend an invented ceremonial detail is an actual tradition or adopted club rule.

## 3. Colour and surfaces

Use the **existing live CSS tokens** as the source of truth. The numbers below reflect the current styles.css; they are established colours, not proposed replacements.

| Token or usage | Hex | Role |
| --- | --- | --- |
| Forest, --forest | #193D32 | Primary identity, rich section backgrounds, primary buttons |
| Paper, --paper | #F6F2E9 | Default warm-cream page background |
| Ink, --ink | #203E33 | Primary headings and body text |
| Brass, --brass | #846329 | Short labels, fine rules, borders and controlled accents |
| Gold, --gold | #D5B777 | Warmer decoration and labels on dark sections |
| Paper deep, --paper-deep | #EAE5D8 | Subtle section differentiation |
| Muted, --muted | #64685E | Secondary text and metadata |
| Line, --line | #D4D3C4 | Dividers and low-key borders |
| Existing ivory card surface | #FCF9F0 | Lightweight featured panels and Annals cards |

**Composition:** Primarily cream backgrounds and dark forest/ink typography. Use solid forest-green panels to introduce weight and hierarchy. Use brass sparingly; it should behave like a discreet insignia, not metallic confetti. Use existing gentle cream variations rather than inventing numerous competing colours.

**Contrast:** Maintain WCAG 2.2 AA text contrast and non-colour cues. Brass and gold are not general-purpose small-text colours on light cream; test their contrast and use dark ink or forest instead when necessary. On forest-green backgrounds, prefer cream or sufficiently contrasted gold for accents.

**Avoid:** Pure black corporate panels, saturated emerald green, bright yellow gold, gradients that read as luxury advertising, heavy parchment textures, glossy bevelled cards, and colour-only status indications.

## 4. Typography

**Heading/display:** Georgia, "Times New Roman", serif (existing --serif). Use for major page titles, thoughtful editorial introductions, institutional pull lines, selected quotations and significant numbers. Headlines are substantial but not ostentatious. Restrained italics may introduce contrast within a heading.

**Body and interface:** "Segoe UI", Arial, sans-serif (existing --sans). Use for navigation, explanatory copy, dates, recipes, lists, rules interfaces, filter controls, instructions and data. Prefer legibility over stylistic novelty.

**Micro-labels:** Compact sans-serif uppercase and modest letterspacing work for short section markers — for example, "THE APPOINTED EVENING" or "THE LIVING RECORD". Do not set paragraphs, instructions or longer text in tiny uppercase. Keep responsive text comfortably readable.

**Implementation:** Retain the current font stacks. Do not add Google Fonts, new font services or replacement typefaces without an actual need and owner direction. Use a coherent type scale and line heights; do not recreate a different typographic system on each page. The principal live body baseline is 16px / 1.65; preserve or improve functional readability on small screens.

## 5. Crest, portraits and images

The approved illustrated six-member crest is the **primary identifying artwork**; do not redraw or casually substitute it. Preserve its proportions, ornaments and member arrangement:

- Upper row: Marc, Matt, Ken.
- Lower row: Jamie, Jerome, Justin.

Use approved derivative assets already in the repository; do not republish source/reference portraits or private originals. Existing Home Screen artwork and member illustrations remain authoritative. Use the approved illustrated portrait only in its permitted context: a quotation represents the **actual speaker**, whereas a contribution credit represents the **contributor**, under their different recorded permissions.

Illustrations should have dignified, slightly vintage rendering and match the crest's visual world. Do not introduce unrelated AI clip art, caricatures or gratuitous coats of arms.

Photography is welcome for real drinks, gatherings and artefacts when the established screening and depiction/ownership permissions apply. It should feel documentary, not like generic staged stock photography. Keep originals private, publish approved screened derivatives only, and maintain alt text that describes the image rather than repeating nearby copy.

### Cocktail Register photography — adopted Direction 2: Moody & Atmospheric

The owner selected **Moody & Atmospheric (option 2)** over the lighter, editorial-props and illustrated treatments. It is the **preferred visual treatment for cocktail imagery**, not a command to redraw original member creations or restyle their submitted recipes.

- **Light:** Rich, low-key atmosphere with warm, concentrated highlights that retain the clarity of the drink, rim, garnish and glass.
- **Background:** Dark forest-green, deep warm neutral or understated pub-like surroundings. A dark frame, warm brass detail and soft fall-off create Club character without hiding the subject.
- **Colour:** Authentic drink hues, natural garnish and glass transparency. The existing cream/forest/brass palette should frame the photograph rather than tint its contents green or gold.
- **Composition:** One drink clearly presented, with enough surrounding breathing room for responsive crops. Keep source framing and garnish honest; do not cut off the meaningful part of a glass.
- **Consistency:** Share framing, aspect-ratio behaviour, subtle colour balance and caption placement across Cocktail Register cards and photographic-index previews. Original aspect ratios may differ. Do not enforce a false standard glass or garnish.
- **Restraint:** No imagined bottles, bar interiors, new props, added fruit, additional drinks, alternate recipe ingredients, fabricated smoke or invented venue. A source photograph with a light background need not be replaced or synthetically reconstructed.
- **Accessibility:** The full-size photo remains legible and unfiltered; alt text describes what is actually depicted, and a separate editorial caption may carry dry Stammtisch humour.
- **Authenticity and release:** Keep the source original privately and all approved signed public image bytes unchanged. Any genuinely altered derivative must go through the existing scoped image rights, screening, metadata removal and new exact signed publication/correction route. This preference does **not** authorize silent retroactive replacement or a new automatic generative-image service.

**Practical implementation:** A *photographic* style cannot be delivered by making the margins green. Once the existing private screening and signed source publication are verified, create a distinct, bounded **editorial display derivative** from those exact approved pixels: actual background separation, dark forest-and-walnut studio treatment and warm drink highlights. Retain the original photograph unchanged, with an explicit **Original photograph** link in the viewer. The editorial variant is marked as a treatment; it is not evidence of a different venue or the unedited scene. The image is never substituted into the signed source record.

The existing GitHub-hosted publication workflow can make the deterministic treatment for eligible future cocktail photos without an additional external AI subscription, new credentials, new app or member step. If the image cannot be isolated confidently, do not fabricate glass, garnish or people: show the approved original and hold only the optional visual derivative. A generated reference image is not proof of a genuinely photographed setting. Avoid a false green surround or CSS-only colour effects. Other photographs, including member portraits and Club History artefacts, remain documentary.

Changing the algorithm or style version requires tested visible results, but **not** reconsent or re-signing of an unchanged original photograph. Publish editorial image assets only after verification of the signed source record and keep their different status plainly available. On withdrawal, remove the current display derivative alongside its original public file, subject to public Git history persistence.

The intended result resembles a well-kept private club's drinks ledger: the lighting shows more ambition than the proceedings require.


## 6. Layout and interaction

The interface should feel like a well-designed heritage journal that happens to be unusually easy to use on a phone.

- A clear hierarchy: next monthly Stammtisch first; the Club and principles; Annual Assembly; Annals and Celebration of Life.
- Generous but controlled whitespace, fine dividing rules, few border treatments, consistent cards and restrained ornament.
- Modest card radii and minimal shadows. No dashboard clutter, gamified decoration, invented official seals or excessive badges.
- On small screens, simplify the columns rather than shrink substantive content. Preserve accessible navigation, visible focus, meaningful headings, reflow at narrow widths and comfortable touch targets (approximately 44px or better for interactive controls).
- Respect reduced-motion settings; don't let decorative movement compete with content.
- Distinguish an actual event date from a reminder, and a genuine live count from a placeholder.
- Reuse existing styles, components and navigation rather than building a new visual language for each addition.

**Annals card exception:** Cocktail recipes and quotations must be **self-contained on the front of their compact cards**. Photo optional; no expansion required to see the original recipe name, original description, complete ingredients, quantities, syrup steps and preparation, or the actual quote, verified speaker and relevant source context. Separate the source-provided recipe description from the structured Preparation section without changing either. The Club History is not a stack of individual recipe cards; it is a continuous, revisable reading page with attribution and revision history.

Only expose category filters/navigation when real eligible content exists. CoL operative amendments appear only on the CoL page.

## 7. The editorial voice — consistently witty, seldom loud

**Adopted tone:** Consistently witty, including homepage, Annual Assembly narrative, **AI-written Club History and generated photograph captions**; predominantly third-person, referring to **"the Club"**, **"the company"**, **"the proceedings"** or **"the Editorial Committee"**. The humour is affectionate institutional satire, directed chiefly at the Club's own excessive formality, never at the genuine bonds or a vulnerable person.

Club History is **not exempt** because it is historical. AI should convert source-grounded recollections into continuous, polished Stammtisch narration, keeping events, chronology, attribution and uncertainty intact. The humour arises from treating modest actual proceedings with unnecessary administrative gravity, never from inventing events, motives, dialogue, importance or traditions.

Likewise, visible AI-written image descriptions and captions must sound like the Club's narrator. Accessible image **alt text remains factual, brief and literal**, not comic; this is a deliberate distinction between narrative copy and assistive description.

Aim for a small but unmistakable comic signature in *each substantive piece of original editorial narrative*, **not** in a member's recipe title, recipe description, ingredient list or preparation. Do **not** force a joke into every sentence, button, recipe measurement, obituary, accessibility instruction or error message. The wit should be part of the narrator's worldview, not a performance interrupted by factual details.

### Editorial formula

1. Begin with the genuine fact or the true user purpose.
2. Express it in measured, disproportionately formal language.
3. Allow one dry incongruity or self-deflating detail.
4. **Stop.** Do not explain why the line is funny.

For a history section, apply that rhythm to the **paragraph or transition**, not every sentence. Establish and substantiate the account first, then add one restrained observation where warranted; do not overwrite chronology with wit.

For a photograph, distinguish the visible **editorial caption** (may be witty, brief, and grounded in approved subject matter) from the screen-reader **alt text** (what can actually be seen, without inference or comedy).

Prefer the contrast to be implicit. The voice can sound certain about matters that plainly require no ceremony, without falsely inventing ceremonies.

### Humour techniques that fit

- **Disproportionate gravity:** Mundane arrangements written as significant proceedings.
- **Administrative understatement:** Formally noting what an ordinary person would barely mention.
- **Earnest self-deflation:** The record or Committee quietly admits its limitations.
- **Polite irony:** An excessively dignified observation that does not announce itself as a joke.
- **Ceremonial naming:** Appointed evening, proceedings, register, particulars, committee, deliberation — used only where they clarify or amuse.
- **Historical framing:** Present a documented recollection as a modest archival finding without promoting it into a grand turning point.
- **Visual understatement:** Give an ordinary image the air of photographic evidence while describing only what is supported.

### What to avoid

- Explaining the premise: "We're just six buddies and we take hanging out way too seriously!"
- Generic inspiration: "Friendship, memories and laughter that last forever."
- Beer puns, frat-house language, laddish clichés, fake aristocratic superiority or novelty merchandise slogans.
- Shouty punchlines, excessive exclamation marks, emojis, memes, sarcasm aimed at members, or a stack of jokes in one paragraph.
- Affected nineteenth-century English throughout: no constant "hereby", "henceforth", "whereas" or "shall" when ordinary English works.
- Repeating the same "disproportionate" gag on every page. Vary the mechanism of the joke.
- Making up officer titles, sanctions, minutes, votes, honorary awards, traditions or procedures as if adopted.
- Real insulting member banter invented by AI. Genuine banter may be used only if accurately sourced and publishable.
- Treating each historical anecdote as a milestone, inventing institutional acts or suppressing meaningful uncertainty.
- AI captions that infer who is pictured, where the picture was taken, what somebody felt, or when an event happened from appearance alone.
- Copying the photo caption into alt text, or replacing a recipe description with a string of visual jokes.

### Speaking about the Club

**Default:** "The Club maintains...", "The proceedings...", "The company...", "The record..."

**Occasional:** "our" or "we" where an authentic direct Club invitation reads more naturally. Do not make first-person prose the default.

**Tone:** Intelligent without being obscure; formal without being stiff; amused without self-congratulation. Prefer short, clear sentences to inflated paragraphs. A well-placed ceremonious phrase usually does more work than three extra jokes.

## 8. Approved anchor copy and editorial examples

### Approved exact homepage line

> **The proceedings are treated with a gravity entirely disproportionate to the business at hand.**

This is the strongest benchmark for rhythm and understatement. Preserve it unless the owner later replaces it. Its effectiveness comes from what it leaves unsaid.

**Previously rejected direction — do not restore:**

> Six friends. One standing date. The tradition is simply making time for the company.

The rejected version spells out the central joke instead of allowing it to emerge.

**Currently established short-form lines:**

- "Informality. With ceremony."
- "A select company. A standing commitment."
- "A tradition of gathering."
- "The art of showing up."

These illustrate concise heritage editorial copy; they are not instructions to duplicate the exact phrases on every page.

### Before-and-after examples — illustrative, not historical evidence

**Homepage / monthly Stammtisch**

*Flat:* "Join us for our monthly meetup."

*Stammtisch:* "The third Friday is marked. The Club regards this as sufficient cause for a formal notice."

**Annual Gentlemen's Assembly**

*Flat:* "Information about the annual cottage trip."

*Stammtisch:* "The Annual Gentlemen's Assembly. A change of premises, with no corresponding reduction in ceremony."

**Annals**

*Flat:* "See posts and recipes shared by members."

*Stammtisch:* "Recipes, recollections and other matters deemed sufficiently important to enter the record."

**Club History, empty state**

*Flat:* "No history entries yet."

*Stammtisch:* "The Club has a history. The formal account is, for the moment, less forthcoming."

**Club History — narrated account (hypothetical style demonstration only)**

*Flat:* "The members kept meeting and eventually settled on a regular date."

*Stammtisch:* "The gatherings acquired a regular place on the calendar. In a development entirely consistent with the Club's character, a simple date was soon treated as a matter of some consequence."

This is a writing illustration, **not** evidence that the asserted sequence of events occurred. AI must first confirm every historical fact and its order from source material.

**Club History — factual uncertainty**

*Flat:* "The exact date of the first meeting is unknown."

*Stammtisch:* "The date of the first gathering is not established in the surviving record. The Club will resist the temptation to improve its origins through administrative invention."

Uncertainty should remain explicit and should never acquire more authority merely because the prose is polished.

**Photograph — editorial caption for an illustrated, fictional example**

*Flat:* "A photo of a cocktail on a table."

*Stammtisch:* "An amber drink, a coupe and sufficient garnish to warrant an entry in the photographic record."

Use this only if those details are genuinely visible in an approved image. Do not use it for Kingston Windfall or any other real submission without comparing the actual screened image and evidence.

**Photograph — accessibility alt text for the same illustrative example**

*Preferred:* "Amber-coloured drink in a coupe glass, with a garnish on the rim."

Alt text describes the visible subject without witty embellishment. Do not infer ingredients, venue, people or occasion from the pixels alone.

**Celebration of Life — competition overview, not a person's memorial**

*Flat:* "See the current scores and official rules."

*Stammtisch:* "The standings, the rules and the inevitable accounting of consequences."

**Practical error state**

*Poor:* "By solemn decree, the electronic archives have fallen into disorder!"

*Better:* "The archive could not be loaded. Please try again."

**Buttons and actions stay plain:** "Read the Annals", "View the rules", "Add to calendar", "Contribute by email", "View the particulars". A ceremonial label may frame them, but never obscure the action.

The proposed lines in this subsection demonstrate *style*, not a request to replace existing website copy. They must not be published as records of events, actual meetings or member statements.

## 9. Writing by content type

### Homepage and the Club

The monthly Stammtisch is the principal reason to return. Put the verified next date, 8 p.m. Toronto start and honest calendar behaviour ahead of secondary material. Use concise institutional wit in hero and introduction. Keep the three principles intact. Do not publish private venues or assert attendance.

### Annual Assembly

It may be ceremonially grander than the monthly gathering, with a recognizably absurd sense of importance. Actual travel particulars, dates, addresses cleared for public use and calendar descriptions must remain direct and precise. Do not invent an agenda, attendance, itinerary, departure time or ritual.

### Cocktails and recipes — source wording takes precedence

**Do not rewrite the recipe name, recipe description, ingredient list or preparation instructions into the Stammtisch voice.** These four elements are the contributor's work and retain their submitted language and meaning, including stylistic choices. Only ordinary spelling and grammar corrections are permissible, and only when they are unambiguous and change neither substance nor attribution. There is no requirement to alter them, even for stylistic consistency. **Already signed and published recipe records remain unchanged** unless the established explicit correction and signing route is used.

Maintain exact quantities, units, ratios, ingredient names, garnishes, step sequence and all homemade syrup methods. No invented amounts, substitutions, techniques or historical provenance. Do not "improve" technical directions under cover of grammar; if a step is materially unclear, hold that component for clarification rather than guess.

A recipe card may have an independent *category label, section heading or photo caption* written in the Club's voice, but it must be visually and semantically distinct from the original recipe name and description. A witty photograph caption is **not** a replacement recipe description. Preserve the structured Preparation section and avoid repeating its instructions in the description. Distinct, clearly labelled suggestions for missing information remain editorial suggestions, never part of the claimed original.

### AI-generated image captions and visual descriptions

**Separate, visible captions describing photographs on cards, galleries and photo entries belong to the Stammtisch voice; the recipe's own name and description do not.** Treat the photograph as an unusually formal piece of evidence, with a touch of dry humour. The joke is about the seriousness of recording the object, never a claim about what happened behind the camera. Keep captions brief, varied, warm and specific to what can be safely confirmed.

For example, a screened image showing a drink in a coupe might permit: *"The photographic record now includes a coupe of considerable confidence."* This is an **illustration only**, not a caption for a specific approved entry.

No invented ingredients, recipes, dates, photographer, attendance, speaker, location, emotional reaction or provenance. A glass of amber liquid does not prove it contains rum. The approved source can establish ingredients; the image can establish only visible details. Avoid repetitive generic captions, hype ("delicious", "everyone loved it") and unsupported adjectives ("legendary", "historic", "award-winning").

**Accessibility alt text is different:** state what is visibly present, succinctly and neutrally. No institutional humour, speculation or promotional language. Do not add names or identifiable details to alt text based on face recognition. Meaningful captions and screen-reader descriptions may coexist without duplicating entire paragraphs.

**Publication distinction:** New eligible automatically generated **photo captions** must be source- and image-screened under existing private permissions and signed with their entry. They must never be applied to the recipe title, original description, ingredients or preparation. Do not mutate existing signed content to retrofit the style. If a proposed caption cannot be grounded, omit it rather than inventing particulars.

### The Register of Remarks

A quotation is the actual speaker's words, subject only to established permitted redaction. Do not "improve" a real quotation for style. Display the verified speaker and approved speaker portrait where permitted, and keep surrounding contextual prose brief and wry. Never fabricate member speech to fill a layout.

### Club History

Club History should read as a **continuous AI-written historical narrative in the Stammtisch voice**: slightly grandiose in telling, modest and faithful in factual substance. It must not become a neutral database export, a string of "A member recalls" fragments, a mock-constitution, a sequence of unrelated cards or a parody that overwhelms its subject.

Draw from actual, permission-qualified member recollections and documented evidence. Preserve dates, ordering, exact sourced words, attribution, contradiction, correction and revision records. AI may reorganise, integrate overlapping accounts and provide carefully limited narrative transitions, but must not invent motives, agreement, attendance, places, ceremonial proceedings, titles, rules or connective events.

Prefer seamless paragraphs in chronological order, with headings only when they genuinely help navigation. Do not elevate every anecdote into a "milestone", "chapter", "turning point" or "landmark". A period of uncertainty remains uncertain even when the narrator writes beautifully.

For each meaningful section:

1. State what actually happened, when it happened, and the provenance or uncertainty.
2. Let the third-person institutional narrator impart a measured sense of significance.
3. Use **one** quiet comic observation at most where the material lends itself to it.
4. Return to the account and continue; let genuine poignant material remain poignant.

A poignant or private recollection may be written with the Club's characteristic composure without a punchline. Avoid jokes at a member's vulnerability. AI-generated connections do not become evidence; when distinct memories conflict, acknowledge the uncertainty instead of selecting the tidiest story.

**Implementation boundary:** A style instruction does not by itself make an existing source-excerpt assembler into an AI narrator. Future narrative-generation logic must retain the separate evidence/consent/signing and one-shot limits; until that capability is implemented and qualified, describe the public output truthfully as source-assembled rather than AI-written.

### Celebration of Life

The game, lists, awards and procedural sections may employ dry formality and affectionate absurdity. **Actual deaths, factual notices, verification status and individual commemorations require dignity, accuracy and care.** Avoid joking about a person's death or inventing an obituary.

Keep operational rules precise and separate non-operative ceremonial commentary or Matters for Club Deliberation from executable scoring provisions. Use the adopted rules and qualified prospective amendment process, not this style guide, for legal-like meaning, points and notifications. The CoL page is the sole home for operative amendments.

### Editorial Committee and disclosures

The Editorial Committee can be a recurring source of limited self-deprecating humour, but do not let this undermine actual accuracy or rights safeguards. Preserve the established public notice exactly where required:

> The Editorial Committee reserves the right to replace particularly spirited language with conspicuous euphemisms. Historical accuracy is otherwise maintained. The Editorial Committee is actually just AI we tried to train.

The operative publication policy currently permits conspicuous **[EXPLETIVE]** and context-specific **[POOP]** in place of strong profanity; censored quotations must be labelled **not verbatim**. Do not add censorship, claims of review or institutional authority that the system does not actually provide.

### Emails, notifications and status

Clarity outranks comedy. A contribution's acknowledgement is not proof of publication; release links follow verified publication. CoL push notifications are for newly confirmed, reconciled passings only. Avoid jokes in failures, permission issues, safety notices and sensitive member communications.

## 10. Editorial mechanics

- **Language:** Canadian English; e.g., colour, centre, favour, honour, neighbourhood. Use familiar Canadian forms; do not force archaic spellings.
- **Naming:** "Stammtisch Social Club", "the Club", "Monthly Stammtisch", "Annual Gentlemen's Assembly", "the Annals", "Club History", "Celebration of Life" and "the Register of Remarks". Preserve actual established names and titles; don't rename a feature merely for a punchline.
- **Capitalization:** Capitalize proper feature/club names; otherwise use sentence case for prose and headings. Use uppercase sparingly for small labels.
- **Punctuation:** Conventional punctuation; curly quotes in editorial copy where convenient, straight quotes accepted in code and structured data. Avoid exclamation marks and serial ellipses for atmosphere.
- **Time:** State the known Toronto-local time when helpful. Distinguish the monthly 8 p.m. start from any separate annual Assembly schedule. Do not infer a meeting end time.
- **Dates:** Use verified source dates. Do not label submission month as an event date, or infer a person's death/discovery time from a record timestamp.
- **People:** Use only approved first names and verified nicknames in permitted contexts; "Fish" for Justin is established. Do not invent nicknames or speaker identities.
- **Links:** Visible descriptive action labels. Avoid "Click here".
- **Length:** Prefer one memorable sentence over a paragraph of explanation, but provide all genuinely necessary details.
- **AI history narration:** Make genuine history read as Stammtisch without inventing any of it; humour lives in phrasing, not the facts.
- **Recipe fidelity:** Original recipe names, descriptions, ingredients and preparation are preserved; only unambiguous spelling or grammar corrections that leave meaning unchanged are allowed. No stylistic rewriting.
- **AI visual descriptions:** Separate visible photo captions may be wry and grounded; alt text is literal and accessible. Neither may rewrite recipe content.

## 11. AI application instructions

For an authorized public-facing content or interface change:

1. Read AGENTS.md and docs/current-state.md, then this guide and the specific facts/publication/CoL guidance relevant to the task. Latest explicit owner decisions supersede older stylistic examples.
2. Establish what is documented as fact, what is approved copy, what is a proposed stylistic treatment, and what remains uncertain. Never present creative example text as historical evidence.
3. Preserve approved art and current CSS tokens/font stacks. Use existing shared layout/navigation and responsive conventions before introducing new ones.
4. Write concise, consistently witty **original editorial narrative** with a largely third-person institutional narrator. Apply this voice to AI-written Club History and *separate, visible photo captions* as well as ordinary page copy, while retaining chronology, source grounding, image rights and uncertainty. Preserve a member's recipe name, description, ingredients and preparation in their original wording, save unambiguous meaning-preserving spelling/grammar corrections; do not restyle them. Keep alt text literal and accessible, and actions, technical status and exact quotes clear.
5. Confirm that the result is truthful, privacy-safe, readable on phones, keyboard-accessible and consistent across pages. Check relevant exact wording, quotation, attribution and recipe fields before shipping.
6. Implement and verify the authorized change under AGENTS.md without inventing a new editorial approval gate. Distinguish source edits, merged changes, deployed public pages and independently verified live results.

**Final editorial test:** Would this read like a polished, slightly grandiose historical institution covering genuinely modest social proceedings — while keeping a straight face, protecting the six friends and saying nothing untrue? If yes, the tone is probably right. If it reads like an inspirational friendship poster, a stand-up routine, a novelty beer advertisement, a neutral history dump, or a parody constitution that creates new rules, revise it.

---

**Maintenance:** Revise this guide only for an actual owner direction or meaningful visual/editorial change. The current deployed CSS remains definitive for implementation details until a later approved change; do not use this document to reset live content or re-open settled permissions.