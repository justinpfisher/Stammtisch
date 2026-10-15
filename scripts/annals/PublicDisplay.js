/* Shared pure public display. No source evidence, authentication, I/O or AI. */
var AnnalsPublicDisplay = (function () {
'use strict';
function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
/* Display-only transformations. Never change signed records or private evidence. */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var EDITORIAL_NOTICE = 'The Editorial Committee obscures particularly spirited language with black redaction bars, or [expletive] where the institutional stationery fails. The occasional [POOP] remains on the record. Historical accuracy is otherwise maintained. The Editorial Committee is actually just AI we tried to train.';

function displayDate(label) {
  const match = /^Submitted (\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  return match ? `Submitted ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : label;
}

function editorialHtml(value) {
  // Escape first. Nothing from a source can become an element or attribute.
  return escapeHtml(value).replace(/\[expletive\]/gi,
    '<span class="annal-redaction">[expletive]</span>');
}

var REDACTION_CSS = `.annal-redaction{display:inline-block;vertical-align:-.1em;background:#000;color:transparent!important;text-shadow:none;width:3em;height:1em;line-height:1;overflow:hidden;white-space:nowrap;border-radius:1px;user-select:text}@media(forced-colors:active){.annal-redaction{background:Canvas;color:CanvasText!important;height:auto;width:auto;overflow:visible}}`;

// Retain complete source sentences/clauses only. Never manufacture an intro
// by deleting ingredient phrases from the middle of a source sentence.
function recipeIntroduction(entry) {
  const recipe = entry.recipe;
  if (entry.category !== 'cocktail' || !recipe ||
      ![...recipe.drinkIngredients,...recipe.syrupIngredients,...recipe.steps].length) return entry.summary;
  const normalize = value => value.toLowerCase().replace(/\s+/g,' ').trim().replace(/[.;:]$/,'');
  const recorded = [...recipe.drinkIngredients,...recipe.syrupIngredients,...recipe.steps];
  const exact = recorded.map(normalize);
  const quantity = /(?:\d|[¼½¾])\s*(?:oz|ml|cl|g|cups?|tbsp|tsp|dash|parts?|ounces?)\b/i;
  const method = /^(?:stir|shake|strain|garnish|mix|pour|blend|muddle|simmer|boil|add|combine|chill|serve|heat|steep)\b/i;
  const instructions = recorded.filter(line => quantity.test(line) || method.test(line)).map(normalize);
  return entry.summary.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z0-9¼½¾])|;\s*/).map(part => {
    const original = part.trim().replace(/^(?:ingredients|homemade syrup|syrup|preparation|method|recipe)\s*:\s*/i,'');
    const normal = normalize(original);
    if (!/[A-Za-z]{3}/.test(original) || exact.includes(normal) ||
        /^(?:ingredients|homemade syrup|syrup|preparation|method|recipe|and|then|with|plus|the drink|for the syrup)[\s,.!:]*$/i.test(original) ||
        quantity.test(original) || method.test(original) || instructions.some(line => normal.includes(line))) return '';
    return original;
  }).filter(Boolean).join(' ');
}

function historyPage(document) {
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#193d32"><title>Club History | Stammtisch Social Club</title><link rel="stylesheet" href="styles.css"><style>${REDACTION_CSS}
  .history-reading{max-width:720px;padding-block:40px 60px;overflow-wrap:anywhere}.history-reading h1{font-size:clamp(38px,8vw,64px);margin-block:20px}.history-reading h2{font-size:30px;color:#846329;margin-block:38px 16px}.history-reading p{font-size:17px;line-height:1.85;margin-block:18px}.history-reading .history-meta,.history-reading footer{font-size:13px;color:#64685e}.history-reading a{color:#193d32;display:inline-flex;align-items:center;min-height:44px}.history-reading footer{border-top:1px solid #d4d3c4;padding-top:22px;margin-top:38px}</style></head><body><a class="skip-link" href="#main">Skip to content</a><main id="main" class="shell history-reading" data-history-revision="${document.revision}"><a href="annals.html">← The Annals</a><p class="eyebrow">The living record</p><h1>Club History</h1><p>A story maintained from the recollections and evidence entrusted to the Annals. The record remains open to correction.</p>${document.updatedAt?'<p class="history-meta">'+escapeHtml(displayDate('Submitted '+document.updatedAt.slice(0,7)).replace('Submitted','Updated'))+'</p>':''}${document.chapters.length?document.chapters.map(c=>'<section id="chapter-'+escapeHtml(c.id)+'"><h2>'+escapeHtml(c.heading)+'</h2>'+c.paragraphs.map(p=>'<p>'+editorialHtml(p)+'</p>').join('')+'</section>').join(''):'<p class="history-meta">The record awaits a source-grounded contribution.</p>'}<footer>${escapeHtml(EDITORIAL_NOTICE)}<p><a href="mailto:annals@stammtischbrewery.com">Members: contribute a recollection or correction</a></p></footer></main></body></html>`;
}
return Object.freeze({displayDate:displayDate,editorialHtml:editorialHtml,recipeIntroduction:recipeIntroduction,
  REDACTION_CSS:REDACTION_CSS,EDITORIAL_NOTICE:EDITORIAL_NOTICE,historyPage:historyPage});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsPublicDisplay;
