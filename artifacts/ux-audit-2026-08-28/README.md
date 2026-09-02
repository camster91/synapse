# Synapse UX audit evidence — 2026-08-28

Current-run browser evidence from the isolated local PostgreSQL environment.
Viewport evidence covers the default desktop viewport and 390 x 844 mobile.

## Findings and disposition

| Severity | Evidence | Finding | Disposition |
|---|---|---|---|
| P1 | `01-landing.png`, `02-landing-mobile.png` | Generic "second brain" positioning and a feature inventory obscured the goals-to-today wedge; emoji icons weakened product consistency. | Fixed in `04-landing-mobile-revised.png` and `05-landing-desktop-revised.png` with a concrete daily-plan promise, data-control proof, and Lucide icons. |
| P1 | `03-register-mobile.png` plus DOM inspection | Visible registration labels were not programmatically associated with their fields; auth errors were not announced as alerts. | Fixed in registration and login with IDs, `htmlFor`, names, autocomplete intent, input mode, and live alert semantics. Browser locators now resolve all three registration fields by label. |
| P2 | `02-landing-mobile.png` | The public experience communicated breadth before explaining why a target user should switch. | Fixed by ordering the page around goal-linked planning, a focused daily loop, and inspectable data control. |
| Blocked verification | Authenticated journey | Browser completion of registration, onboarding, Today, export, and account deletion requires action-time approval before submitting disposable credentials or deletion. | Pending; automated contracts and production build pass but are not treated as runtime proof. |

## Captures

1. `01-landing.png` — original desktop landing page.
2. `02-landing-mobile.png` — original mobile landing page.
3. `03-register-mobile.png` — original mobile registration page.
4. `04-landing-mobile-revised.png` — revised mobile landing page.
5. `05-landing-desktop-revised.png` — revised desktop landing page.
