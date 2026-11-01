# UX requirements — approved MVP additions

## Main hero card
- Arabic RTL with bold LTR `NG-XXXXXXXX` in selectable text and accessible Copy button.
- Adjacent button **«فتح في نسك»** opens `https://services.nusuk.sa/app?p=27&id=<encodeURIComponent(code)>` in a new tab with `noopener,noreferrer` for web; on mobile default browser/app deep-link behavior. Never embed Nusuk via iframe. Make visible that it opens an **official third-party site/app** and cannot confirm claim success.
- Separate **«التالي»** button explicitly moves to next unseen code; keep **«تخطي»** and optional **«جرّبت الكود»** local states (tried vs merely viewed), undo last action, remaining count, exhausted state. Copying/opening must NOT irreversibly mark as redeemed, and should not auto-advance without user setting.
- Choose a deterministic per-install shuffled order to distribute community exposure fairly; never privilege owner's/referrer code. Respect reduced motion and keyboard controls.

## Lightweight horizontal awareness strip / tip carousel
- Compact accessible responsive horizontally scrollable chips/cards just below header, auto-rotate optionally only with user pause and prefers-reduced-motion honored; keyboard and touch scrolling. No incessant animation.
- Suggested Arabic tip categories (editable admin config):
  1. «إيه هي مفاتيح نسك؟» — community referral codes participating in app challenge; not prize guarantees.
  2. «إزاي تستخدمها؟» — انسخ الكود أو افتح رابطه، وكمل الخطوات داخل تطبيق نسك الرسمي.
  3. «هل الكود بيتكرر؟» — الموقع بيخفي الأكواد اللي انت عدّيتها على نفس المتصفح؛ ممكن تظهر تاني لو مسحت بياناته أو فتحت جهاز تاني.
  4. «كام فرصة في اليوم؟» — **limits not independently confirmed**; show «راجع الشروط داخل تطبيق نسك لمعرفة عدد المفاتيح والفرص اليومية» unless current official in-app text provides explicit verified terms.
  5. «هل المفاتيح مضمونة؟» — لا، دي أكواد منشورة من المجتمع ومش متحقق منها داخل نسك.
  6. «شارك كودك» — safely submit a new code or full official referral URL; enters moderation queue.
- Label facts with evidence date/source; avoid saying one code = one chance, 'once a day', '100 trips' etc as unconditional rules without current official policy.

## Extra MVP enhancements
- Smart share: Web Share API where supported and copy URL fallback; share site URL **not automatically a specific contributor code**.
- Small nonintrusive toast for copy with live region, optional haptic if browser supports.
- Local-only progress recap (seen, tried, skipped, remaining), import/export history JSON for manual cross-device move, clear with confirmation; no account required.
- Search within local loaded codes is optional and should not leak personal data.
- 'بلّغ عن كود' behind protected moderation mechanism; if unavailable, link to safe contact workflow; no open anonymous write path.
- Trust footer: Independent community project, no Nusuk affiliation, no logins/OTP, links only to official services.nusuk.sa and documented sources.
- Seasonal banner and freshness label (`آخر تحديث` + snapshot age), visible fallback state if feed stale.
- Optional installable PWA with cache versioning after core flow stable. No heavy stock photography, distracting confetti, tracking, or autoplay media.

## Resilience & costs
- Vercel static asset CDN is the only normal-user read path; browse, next, copy, open require 0 Firestore reads and 0 Vercel Function calls. Cache manifest briefly, immutable snapshot strongly; stage snapshot and manifest atomically via deployment. Handle snapshot 404, broken hash, stale season, and offline gracefully.
- Avoid arbitrary per-user limits for **reading codes** (stateless and cheap); rate-limit only user submissions and abuse-sensitive operations on trusted backend or keep those disabled.
- Preserve a last-good cached snapshot for offline use, make updates safe and rollbackable.
- On Spark quota exhausted submissions/admin writes fail closed but static browsing continues until hosting limits. Vercel Hobby is not guaranteed unlimited bandwidth/uptime. No card/billing upgrade by default.
