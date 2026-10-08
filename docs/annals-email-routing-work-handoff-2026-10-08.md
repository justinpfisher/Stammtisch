# Annals: free custom-domain email routing — Work handoff

**Date:** 8 October 2026  
**Status:** Implementation handoff, **not** a record that the address or live automation has been activated.

## Practical objective

Create and verify a **free, receiving-only** address `annals@stammtischbrewery.com` forwarding to a **dedicated, private club Gmail mailbox**. Members should only see the branded address. This first step does **not** authorize a paid mailbox, an AI API bill, a production AI processor, public Annals entries, altered Celebration of Life/OneSignal behaviour or a scheduled email-intake trigger.

The user's existing domain was **previously associated with Porkbun** (historical registration context), but the current registrar, authoritative DNS, MX records, existing domain email use and account permissions must be confirmed **live** before writing any records. Do not assume that registrar = authoritative DNS operator or that root-domain MX is unused.

### Provider finding

Porkbun offers **up to 20 free email forwarding aliases per domain**; the service receives mail but does **not** send outbound as the custom-domain address. If domain email uses Porkbun-compatible MX, prefer creating the alias directly in Porkbun rather than adding Cloudflare, ImprovMX or another routing vendor. The proposed destination is a new, dedicated Gmail address whose exact value should remain in private account settings.

Official source references (checked 8 October 2026):
- https://porkbun.com/products/email_forwarding/
- https://kb.porkbun.com/article/10-how-to-set-up-email-forwarding-service
- https://kb.porkbun.com/article/47-how-to-use-porkbun-email-when-your-dns-is-hosted-elsewhere
- https://support.google.com/mail/answer/17101213?hl=en-3 (Google's January 2027 third-party `Send as` retirement; do not rely on a Gmail custom-domain send-as alias)

**Critical MX caveat:** Porkbun's forwarding requires domain MX records pointing to Porkbun's receiving servers. If the domain already receives email via another provider, switching MX records could break that mailbox. Do not change MX, SPF, DKIM, DMARC, nameservers, registrar, existing GitHub Pages A/CNAME records or other domain service without inventory, a rollback plan and specific owner confirmation. Do not use a "Fix DNS" action blindly: it may replace MX/SPF.

## Recommended execution split

**ChatGPT Work (cloud browser, with human sign-in):** Read-only inspection; confirm the account/zone and existing mail; navigate the existing registrar dashboard; assist the owner in setting up a dedicated Gmail mailbox, security and recovery; create the forwarding alias only when safe and approved; verify actual delivery from a separate sender; report results and any blocker. The secure sign-in/MFA process is done by the owner. Do not request passwords in chat or store them in GitHub. Work may stop if the provider blocks the automated browser.

**Codex (GMKtec/verified repository):** Implement and test the private Gmail/Apps Script intake, image/handwriting interpretation, authenticated exact-content approval and approved-only publisher **after separate explicit authorisation**. Read `AGENTS.md`, `docs/annals-email-publishing-proposal-2026-10-08.md`, `docs/annals-pilot-runbook.md`, and `docs/annals-publication-guidelines.md`. Keep the existing GitHub-hosted monitoring, Pages and push pipelines unchanged. Never enrol the GMKtec as a public GitHub runner.

**User actions:** Securely sign in to Porkbun (or the current registrar/DNS provider), sign up/sign in to the dedicated Gmail account and complete verification/2FA, review any proposed DNS/MX change, and test from a non-destination email account. The user need not manually edit website files or Google Apps Script source.

## Work acceptance steps

1. **Read-only inventory.** Confirm current Porkbun relationship, nameservers, DNS host, MX records, SPF/DKIM/DMARC, current forwarding/hosted mailbox usage, and GitHub Pages website health before doing anything. Preserve a concise non-secret before-state and identify any conflict.
2. **Destination mailbox.** Help create and secure a **new dedicated Gmail account**, not the user's personal or work account. Do not advertise the address publicly. Owner completes any security challenges.
3. **Free alias.** If the current mail-routing arrangement permits, add `annals@stammtischbrewery.com` as a **free Porkbun forward** to that dedicated destination. If MX records need changes, show the exact old/new changes and pause for explicit approval; never disable another mailbox as an accidental side effect.
4. **Test actual delivery.** Send a clearly synthetic test from an account **different from the forwarding destination**; confirm the destination receives its subject/body and a safe, tiny attachment. Test a second message and ensure replies are understood to come from the underlying Gmail identity, not the custom-domain alias.
5. **Check for regressions.** Recheck domain website home and `celebration.html`, any known existing inbound email path, DNS authentication and the forward after changes. Do not manipulate CoL scoring, notifications, or repo credentials.
6. **Report exactly what happened.** State whether the new address is live, what was verified, current provider/MX, forwarding destination **redacted** in public logs, whether charges were incurred, remaining blockers and how to reverse any authorised configuration.

**Stop rather than improvise** if: current domain email uses another provider; existing MX/DNS unknown; provider asks for a paid plan; the user must pass a security check; a domain transfer or DNS migration is required; a service attempts to make broad changes; or a provider cannot be reached through Work. Give a narrowly described requested next action.

## Explicitly out of scope for this setup

- No purchase or subscription (not even a free trial that renews for money).
- No forwarding to the user's personal/college inbox.
- No adding the alias to the live website until delivery works and member guidance is approved.
- No attaching the public GitHub repo or GitHub Actions to private mail/photos.
- No enabling `ANNALS_INTAKE_ENABLED`, `ANNALS_ALLOW_PRODUCTION_MAIL`, AI calls, publisher credentials or automated public publication.
- No expansion of OneSignal to Annals.
- No changes to CoL scoring or the January 2027 draft logic.

## Next Codex handoff, once routing is verified

Open GitHub issue #24 and the existing `scripts/annals/` source and tests. Continue with the smallest **private-only** integration: stage a consented synthetic message in the dedicated account, validate safe access and idempotency, support iPhone HEIC and actual handwritten syrup measurements without guessing, and create a fully private exact-content preview. Secure email-based approvals and public publication must remain separately gated.

**Completion of this Work handoff means:** `annals@stammtischbrewery.com` **receives** real mail free of charge and without breaking existing services. It does *not* yet mean the Annals updates itself.
