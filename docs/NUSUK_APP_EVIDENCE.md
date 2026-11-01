# Nusuk November 2026 – user-supplied evidence (2026-11-01)

## Observed app UX
- Arabic title: «مفاتيح تحدي نسك» / «مفاتيحك».
- «مفتاح كل يوم»: «تحصل على مفتاح واحد في بداية كل يوم».
- «شارك التطبيق واجمع المفاتيح»: «شارك رابطك مع أهلك وأصدقائك؛ كل شخص يحمّل التطبيق من خلاله يمنحك مفتاحًا إضافيًا».
- Input: «أدخل الرمز لتفعيل مفتاح جديد», button «تحقق من الرمز».
- User screenshot showed zero current keys; it does not disclose redemption limits or code validity.

## User-supplied referral
- Code: `NG-dX626jFL` (CASE-SENSITIVE; preserve exactly).
- Referral URL: `https://services.nusuk.sa/app?p=27&id=NG-dX626jFL`
- User-provided sharing copy mentions «100 رحلة عمرة مجانية». Treat as user-provided copy, not independently confirmed official event rules.
- Code is **not verified redeemed in the app**.

## Implementation updates for Codex
1. Accept both a standalone code and the official Nusuk sharing link. Parse URLs safely and only recognize `https://services.nusuk.sa/app` with parameter `id`, or pasted `NG-` tokens from plain text. Preserve case; reject unknown hostnames and misleading lookalike links.
2. The prior 8-character regex is provisional only. `NG-dX626jFL` has 8 alphanumeric characters after `NG-`, consistent with it, but do not rely on regex alone as validity proof.
3. Separate `source_verified` from `redemption_verified`. A genuine-looking shared link does not prove that it can be redeemed or that it belongs to the current season.
4. Prefer clear «نسخ الكود» and «التالي» buttons. The site is independent and must not imitate Nusuk’s official identity.
5. Do not impose a daily limit on viewing/copying codes; the official per-user redemption limit is unknown. Apply rate limits only to abuse-prone submissions/admin endpoints.
6. Provide an easy source-post URL field with each submission and optional reporting for invalid/old codes.
7. No automated Facebook scraping that circumvents login/access restrictions. Public links may yield indexed text or a login wall.
