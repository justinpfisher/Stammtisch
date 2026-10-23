# Stammtisch Social Club

The six-person clubhouse at [stammtischbrewery.com](https://stammtischbrewery.com/): gatherings, Celebration of Life, and the living Annals. Heritage cream/forest/brass styling, approved illustrations and dry institutional humour stay part of its identity.

## Start here

- [Current operating state and remaining work](docs/current-state.md) — the single maintained production reference, with dated evidence.
- [Working instructions](AGENTS.md) — authority, safeguards and the ordinary release workflow.
- [Club context](docs/club-context-and-history.md), [publication guidelines](docs/annals-publication-guidelines.md) and [official CoL baseline](docs/celebration-of-life-rules.md) — read the relevant source before changing club narrative, consent or rules.

## Ordinary updates

Owner request → implement → appropriate automated checks → review/merge → existing Pages deployment → verify the affected live result → concise report. No separate routine permission to merge or go live. Optional History work and private installation do not block unrelated site changes.

The static site publishes from **`main` / root** through the existing branch-based GitHub Pages service. There is no application build or public server to maintain. Automated publishers using `GITHUB_TOKEN` must explicitly request a Pages build; a bot commit alone does not start one. Private Annals reconciliation separately checks real hosted content before recording publication success.

Use the GMKtec checkout for ordinary implementation and affected checks **first**, followed by the public repository's independent GitHub-hosted PR CI (do not connect a personal self-hosted runner). For the full offline Python/Node suite:

```sh
node scripts/local-dev.mjs check
```

`doctor` checks prerequisites; `preview` serves only `127.0.0.1:8765`. Node 22+ and Python 3.12+ are required. [GMKtec setup](docs/gmktec-local-development.md) is optional workstation guidance, not a prerequisite to cloud work. Browser fixtures use pinned test-only Playwright dependencies and fictional loopback content; emulation does not establish physical-device acceptance.

## Operations and source map

| Area | Source and operational guide |
| --- | --- |
| Homepage/monthly | `index.html`, `monthly.mjs`, `stammtisch-monthly.ics`; third Friday, **8 p.m. America/Toronto**, advances at Toronto midnight after meeting day. Calendar remains an all-day date reminder |
| Annual Gentlemen's Assembly | `location.html`, `assembly.mjs`, `assembly-2027.ics`; separate off-site event. Published start **5 February 2027, 9 a.m. Toronto**, not cottage check-in. No invented departure time or programme |
| Annals, quotes, photos, History | `scripts/annals/`, `annals.html`, `history.html`, `photos.html`; [production runbook](docs/annals-production-runbook.md). Private Gmail/Drive/Apps Script, signed public derivatives, separate History authority |
| CoL register/awards | `celebration*.mjs`, `data/celebration*.json`; [Sheet monitor](docs/celebration-sheet-monitor.md), [award notes](docs/celebration-awards.md). Existing Sheet credentials are read-only |
| CoL amendments | [Qualified staged protocol](docs/col-two-stage-release.md), `data/col-rules-release-state.json`, immutable `data/col-releases/`; operative readers include qualified amendments beyond the dated baseline |
| Public notifications | [Push operations](docs/col-push-rollout.md), `scripts/col-push-delivery.py`, Issue #18 machine checkpoint; confirmed new passings only |
| Approved artwork | `assets/`, `assets/members/annals/`, [portrait scope](docs/annals-member-portraits.md); private reference originals stay private |

The adopted prospective year runs between the third Fridays of January at 8 p.m. Toronto. Unknown actual death times on handover Friday default to the previous season. Existing signed allocations remain operative until the protected numerical implementation is released; see [the calculation candidate](docs/col-prospective-engine.md). Preserve actual death dates separately from group report dates.

The public repository includes operational source and historical evidence. Dated proposals, launch reports and pilot notes are labelled historical; consult them for provenance or a specific repair, never as a routine checklist. Production, CI, Pages and push run on GitHub-hosted infrastructure and do not depend on the GMKtec being on. Keep Comparative/LCRS separate.

## External Project instructions

ChatGPT Project settings are maintained outside GitHub. The [current-state record](docs/current-state.md) includes the precise correction for their superseded “not live”, individual-approval and model-router paragraphs. Do not copy dated status or launch checklists into those settings again.
