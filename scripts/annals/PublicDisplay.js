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
  // A contributed email may include full Ingredients / Instructions sections
  // verbatim. Those are already rendered from the separately signed recipe
  // arrays below the introductory paragraph. Do not repeat them as prose.
  // Recognise only a full-line section heading; never cut a sentence merely
  // because it mentions the words "ingredients" or "instructions".
  const sectionHeading = /(?:^|\r?\n)[ \t]*(?:ingredients|instructions|preparation|method|homemade syrup)[ \t]*:?[ \t]*(?=\r?\n|$)/gi;
  const firstHeading = sectionHeading.exec(entry.summary);
  if (firstHeading) {
    const intro = entry.summary.slice(0,firstHeading.index).trim();
    if (intro) return intro.replace(/\*([^*\n]+)\*/g,'$1').replace(/\s+/g,' ').trim();
  }
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

/* The same static chrome serves every public page and publisher-generated page.
 * Accessible without JavaScript; active state is display-only, not an authority.
 */
const SITE_LINKS = Object.freeze([
  ['monthly', 'index.html#monthly-stammtisch', 'Monthly Stammtisch'],
  ['club', 'index.html#the-club', 'The Club'],
  ['annals', 'annals.html', 'The Annals'],
  ['col', 'celebration.html', 'Celebration of Life'],
  ['assembly', 'location.html', 'Annual Assembly']
]);
function siteNav(section, name, nested) {
  const active = section === 'home' ? 'monthly' :
    section === 'annals-sub' ? 'annals' :
    section === 'col-sub' ? 'col' : section;
  const current = nested ? 'location' : 'page';
  return '<nav class="site-nav" aria-label="' + name + '">' +
    SITE_LINKS.map(([id, href, label]) =>
      '<a href="' + href + '"' +
      (id === active && id !== 'club' ? ' aria-current="' + current + '"' : '') +
      '>' + label + '</a>').join('') + '</nav>';
}
function siteHeader(section) {
  const nested = section === 'annals-sub' || section === 'col-sub';
  return '<header class="site-header"><div class="shell header-inner">' +
    '<a class="wordmark" href="index.html" aria-label="Stammtisch Social Club home">' +
    '<img src="assets/crest-small.webp" width="56" height="56" alt="">' +
    '<span>Stammtisch<small>Social Club</small></span></a>' +
    siteNav(section, 'Main navigation', nested) +
    '<details class="mobile-site-navigation"><summary>Menu <span aria-hidden="true">+</span></summary>' +
    siteNav(section, 'Mobile navigation', nested) + '</details>' +
    '</div></header>';
}
function siteFooter(section) {
  const nested = section === 'annals-sub' || section === 'col-sub';
  const active = section === 'home' ? 'monthly' :
    section === 'annals-sub' ? 'annals' :
    section === 'col-sub' ? 'col' : section;
  return '<footer class="site-footer"><div class="shell footer-inner">' +
    '<p>The Stammtisch Social Club<span>A tradition of gathering.</span></p>' +
    '<nav aria-label="Footer navigation">' +
    SITE_LINKS.map(([id,href,label]) =>
      '<a href="' + href + '"' +
      (id === active && id !== 'club' ? ' aria-current="' +
        (nested ? 'location' : 'page') + '"' : '') + '>' + label + '</a>').join('') +
    '</nav></div></footer>';
}

function historyPage(document) {
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#193d32"><title>Club History | Stammtisch Social Club</title><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="history.css"><style>${REDACTION_CSS}</style></head><body><a class="skip-link" href="#main">Skip to content</a>${siteHeader('annals-sub')}<main id="main" class="shell history-reading" data-history-revision="${document.revision}"><a class="history-back" href="annals.html">← The Annals</a><header class="history-masthead"><p class="eyebrow">The living record</p><h1>Club History</h1><p class="history-lead">A continuous history built from source-grounded recollections and evidence. The record remains open to correction.</p>${document.updatedAt?'<p class="history-meta">'+escapeHtml(displayDate('Submitted '+document.updatedAt.slice(0,7)).replace('Submitted','Updated'))+'</p>':''}<p class="history-meta history-revisions">Revision ${document.revision} · <a href="https://github.com/justinpfisher/Stammtisch/commits/main/history.html">Public revision history ↗</a></p></header>${document.chapters.length?document.chapters.map(c=>'<section class="history-chapter" id="chapter-'+escapeHtml(c.id)+'"><h2>'+escapeHtml(c.heading)+'</h2>'+c.paragraphs.map(p=>'<p>'+editorialHtml(p)+'</p>').join('')+'</section>').join(''):'<p class="history-pending">The record awaits a source-grounded contribution.</p>'}<footer>${escapeHtml(EDITORIAL_NOTICE)}<p><a href="mailto:annals@stammtischbrewery.com">Members: contribute a recollection or correction</a></p></footer></main>${siteFooter('annals-sub')}</body></html>`;
}
return Object.freeze({displayDate:displayDate,editorialHtml:editorialHtml,recipeIntroduction:recipeIntroduction,
  REDACTION_CSS:REDACTION_CSS,EDITORIAL_NOTICE:EDITORIAL_NOTICE,historyPage:historyPage,
  siteHeader:siteHeader,siteFooter:siteFooter});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AnnalsPublicDisplay;
