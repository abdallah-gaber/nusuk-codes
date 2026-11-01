# الخطوات اللي هتعملها بنفسك

## دلوقتي
1. من https://github.com/new اعمل public repo اسمه `nusuk-codes`، من غير أي ملف مبدئي، وبعدين ارفع فيه `PROJECT_INSTRUCTIONS.md` وملفات data أو ادّيهم لـCodex يعمل ده.
2. افتح https://console.firebase.google.com/ واعمل مشروع باسم `nusuk-codes`. سيبه **Spark** من غير Billing. لسه مش لازم تنشئ Service Account ولا تسجل Web App لحد ما Codex يخلص Phase 1.
3. في Firestore اختار Standard edition وProduction mode، وحدد Location مناسب وخد بالك إن تغيير الموقع لاحقًا مش سهل. خليك على database الافتراضية.

## بعد ما Codex يعمل أول build
4. افتح https://vercel.com/new واربط الـGitHub repository (غالبًا لازم توافق على صلاحيات Vercel GitHub). اختار Vite: build `npm run build` وOutput `dist`.
5. من Vercel Project Settings → Domains أضف `nusuk.abdallahgaber.dev`.
6. افتح DNS provider الخاص بـ`abdallahgaber.dev`، وأضف record حسب التعليمات الفعلية اللي Vercel هيعرضها؛ غالبًا CNAME للاسم `nusuk`. ما تغيّرش الـA/CNAME بتاع الموقع الأساسي أو www.
7. انتظر verification والـSSL، وافتح الموقع من متصفح موبايل برا شبكة الواي فاي للتجربة.

## بعد Phase 2 فقط
8. لو التطبيق محتاج Firebase Web SDK: Firebase Project Settings → Your Apps → Add Web App، وانقل Firebase Web Config لبيئة Vercel؛ مش secret إداري، لكن لازم Firestore Rules محكمة.
9. لو هنفعّل automated admin job: خلّي Codex يشرح بالضبط أقل IAM permissions وطريقة GitHub OIDC federation أو secret مناسب. **متشاركش Service Account JSON في الشات أو GitHub أو frontend.**
10. راجع Security Rules من Firebase Console واختبر الـEmulator. خليك على Spark بلا Billing؛ ممنوع أي تفعيل Blaze من غير قرار صريح منك.

## تشغيل وصيانة
- GitHub Actions: تأكد الجدول كل 48 ساعة وworkflow_dispatch شغالين، وعملية discovery بتضيف بيانات للمراجعة لا للنشر المباشر.
- Firebase Usage: تابع reads/writes/egress في Firebase Console.
- Vercel Usage: تابع الـbandwidth وCDN requests. Hobby مجاني للاستخدام الشخصي غير التجاري، ومش uptime SLA.
- في حالة أزمة: عطّل submissions، استخدم last-good snapshot، وقف collection workflow.
