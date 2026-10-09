# Universal Autonomous Advancement — Execution Mode and Usage Controls v1.3

**Status:** owner-approved verification correction, 9 October 2026. **Base policy:** [v1.2](universal-autonomous-advancement-v1.2.md), retained unchanged; [v1.1](universal-autonomous-advancement-v1.1.md) also remains unchanged for history.

## Scope and precedence

This narrow v1.3 amendment corrects only **Work configuration evidence when Work cannot inspect its own product controls**, and a bounded response to unavailable Work allowance telemetry. For **new launches**, v1.2 continues to govern all other execution-mode choices, model/effort/speed requirements, scheduling, approvals, human review, source/service rights, privacy, quality, budget limits, Codex and end-of-window reporting. Within the two narrow topics explicitly amended here, v1.3 supersedes conflicting stop-on-unverifiable wording in v1.2.

**Required Work configuration remains GPT-6 Luna / High reasoning / Standard speed.** Mode 1 (ChatGPT only) remains the default if the owner has not selected a mode. Mode 2 allows ChatGPT + Work, **never Codex**. Codex stays separate under Mode 3 only; a Work owner-attestation cannot authorize or verify Codex.

## Accept two distinct forms of Work configuration evidence

1. **Direct product readback:** Where a current, accessible product control actually exposes model, effort, speed and payment settings, use that evidence and record `product_ui_verified`. Do not claim visibility of controls which were not shown.
2. **Current owner attestation:** If Work cannot access its own configuration UI, accept a **current, affirmative, first-person statement submitted by the owner in the Work conversation** confirming that the owner has personally selected **GPT-6 Luna High / Standard**, disabled automatic credit reload where that setting is available, prohibited paid-credit use and extra purchases, and requires no auto-escalation or extra workers. A copyable launch prompt submitted by the owner can contain this explicit attestation. Record `owner_attested_not_tool_verified`.

The owner's attestation is evidence of **what the owner reported**, not independent product verification or a machine-enforced spending limit. A statement in repository documentation alone, an assistant-written template never submitted by the owner, a stale prior launch or a generic Mode 2 selection does not establish current attestation.

**Do not repeatedly try to inspect irrelevant browser tabs, account pages or nonexistent Work settings tools** simply to verify settings that are inaccessible from Work. If a current affirmative attestation is present, unavailable tool access **alone** must not cause an immediate stop. If attestation is absent, incomplete or contradicted by observed settings, stop before substantial Work activity and ask for clarification; never assume an alternate model or speed.

## Allowance and credit safety when telemetry is missing

Remaining allowance must be **checked where actually exposed**, and otherwise reported as `allowance_unavailable`, not zero, unlimited or verified. Owner attestation does not prove allowance or pricing.

When the owner has supplied current attestation, no billing or credit conflict is known, and there is no indication that purchased credits will be charged, **allow one initial Work trial of at most 30 minutes**, using serial, small, already-authorized tasks only. Checkpoint each meaningful result and report real elapsed time; the trial may end earlier. It is a bounded test **within** an eight-hour maximum, not approval to execute unattended for eight hours when remaining allowance is unknown. A longer window requires separate explicit owner confirmation after reviewing the first trial.

**Hard stops remain:** do not deliberately consume purchased credits, buy or reload credits, enable automatic reload, change billing, or use external paid services. If the UI or any other reliable signal indicates an exhausted included allowance, credits being drawn, new charges, an uncontrollable paid-credit path, or conflicting model settings, **stop immediately** and seek a product-side hard stop or separate owner review. Do not claim that this policy guarantees zero paid-credit use: without a verified product-side limit, hidden charges cannot be excluded.

If no adequate protection against unapproved spending can be established, do not launch open-ended Work activity; preserve a recoverable handoff rather than bypassing the safety boundary.

## Continuity, reporting and activation

Do not create hourly schedules from this on-demand amendment. Chain eligible tasks within the actual Work runtime; checkpoint at task boundaries and at least hourly **only while an ongoing session really persists**. Do not promise eight-hour uninterrupted background execution or automatic hourly recovery.

End-of-trial reporting must distinguish: selected Mode 2, `owner_attested_not_tool_verified` versus `product_ui_verified`, any unavailable model/billing readbacks, real duration, completed and verified work, allowance known/unknown, any detected credit usage, blockers and whether a longer window is safe.

Publishing this text in a repository **does not change product settings, activate Work, establish a charge limit or supply new authority** for a source, model experiment, cloud provider, LCRS material, Comparative Engine promotion, website release or other governed activity. Each project owns its own v1.3 copy and substantive decisions.
