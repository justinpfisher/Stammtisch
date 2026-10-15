/* Display-only transformations. Never change signed records or private evidence. */
import { escapeHtml } from './PrivatePreview.mjs';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const EDITORIAL_NOTICE = 'The Editorial Committee obscures particularly spirited language with black redaction bars, or [expletive] where the institutional stationery fails. The occasional [POOP] remains on the record. Historical accuracy is otherwise maintained. The Editorial Committee is actually just AI we tried to train.';

export function displayDate(label) {
  const match = /^Submitted (\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  return match ? `Submitted ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : label;
}

export function editorialHtml(value) {
  // Escape first. Nothing from a source can become an element or attribute.
  return escapeHtml(value).replace(/\[expletive\]/gi,
    '<span class="annal-redaction">[expletive]</span>');
}

export const REDACTION_CSS = `.annal-redaction{display:inline-block;vertical-align:-.1em;background:#000;color:transparent!important;text-shadow:none;width:3em;height:1em;line-height:1;overflow:hidden;white-space:nowrap;border-radius:1px;user-select:text}@media(forced-colors:active){.annal-redaction{background:Canvas;color:CanvasText!important;height:auto;width:auto;overflow:visible}}`;

// Extract only text demonstrably outside the recorded recipe. Work on complete
// sentences/lines before literal subtraction so recipe-only prose cannot leave
// a fabricated generic introduction. Ambiguous remnants are simply omitted.
export function recipeIntroduction(entry) {
  const recipe = entry.recipe;
  if (entry.category !== 'cocktail' || !recipe ||
      ![...recipe.drinkIngredients,...recipe.syrupIngredients,...recipe.steps].length) return entry.summary;
  const normalize = value => value.toLowerCase().replace(/\s+/g,' ').trim().replace(/[.;:]$/,'');
  const recorded = [...recipe.drinkIngredients,...recipe.syrupIngredients,...recipe.steps];
  const exact = recorded.map(normalize);
  return entry.summary.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z0-9¼½¾])/).map(part => {
    const original = part.trim();
    if (!original || exact.includes(normalize(original))) return '';
    let rest = original;
    for (const line of [...recorded].sort((a,b) => b.length-a.length)) {
      const literal = line.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
      rest = rest.replace(new RegExp(literal,'gi'),'');
    }
    rest = rest.replace(/^(?:ingredients|homemade syrup|syrup|preparation|method|recipe)\s*:?\s*/i,'')
      .replace(/^[\s,;:.—–-]+|[\s,;:—–-]+$/g,'').trim();
    if (!/[A-Za-z]{3}/.test(rest) || /^(?:and|then|with|plus|the drink|for the syrup)[\s,.!]*$/i.test(rest)) return '';
    // Remaining measurements or imperative instructions are not an intro.
    if (/(?:\d|[¼½¾])\s*(?:oz|ml|cl|g|cups?|tbsp|tsp|dash|parts?|ounces?)\b/i.test(rest) ||
        /^(?:stir|shake|strain|garnish|mix|pour|blend|muddle|simmer|boil|add|combine|chill|serve|heat|steep)\b/i.test(rest)) return '';
    return rest;
  }).filter(Boolean).join(' ');
}
