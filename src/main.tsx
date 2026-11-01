import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  HISTORY_KEY,
  SEASON,
  loadFeed,
  moveForward,
  newHistory,
  officialUrl,
  parseHistory,
  shuffled,
  type Feed,
  type History,
} from "./core";
import "./style.css";

const tips = [
  [
    "✦",
    "إيه هي مفاتيح نسك؟",
    "أكواد مشاركة من المجتمع، مش ضمان لفوز أو جائزة.",
  ],
  ["↗", "إزاي تستخدمها؟", "انسخ الكود أو افتح رابطه، وكمل داخل نسك الرسمي."],
  ["◷", "هل الكود بيتكرر؟", "بنفتكر اللي شفته على نفس المتصفح، من غير حساب."],
  [
    "☀",
    "كام فرصة في اليوم؟",
    "راجع شروط تطبيق نسك لمعرفة عدد المفاتيح والفرص اليومية.",
  ],
  ["◇", "هل المفاتيح مضمونة؟", "لا، الأكواد دي مش متحقق من صلاحيتها داخل نسك."],
  ["＋", "شارك كودك", "الإضافة متوقفة لحد تفعيل مراجعة وحماية آمنة."],
];
function initialHistory() {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY) || "");
  } catch {
    return newHistory();
  }
}
function App() {
  const [history, setHistory] = useState<History>(initialHistory);
  const [now] = useState(Date.now);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<string>();
  const [undo, setUndo] = useState<{ history: History; current?: string }>();
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("nusuk:theme") || "system";
    } catch {
      return "system";
    }
  });
  const [reset, setReset] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelReset = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const codeFocus = useRef<HTMLHeadingElement>(null);
  const order = useMemo(
    () => shuffled(feed?.codes || [], history.seed),
    [feed, history.seed],
  );
  async function reload() {
    setLoading(true);
    setError("");
    try {
      setFeed(await loadFeed());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      setStorageWarning(true);
    }
  }, [history]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nusuk:theme", theme);
    } catch {
      /* Theme remains available in memory. */
    }
  }, [theme]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) {
        try {
          setHistory(e.newValue ? parseHistory(e.newValue) : newHistory());
          setUndo(undefined);
          setNotice("اتحدث سجلك من نافذة تانية.");
        } catch {
          setStorageWarning(true);
        }
      }
    };
    const net = () => setOnline(navigator.onLine);
    window.addEventListener("storage", sync);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    if (!current && order.length) {
      const next = order.find((e) => !history.seen.includes(e.code));
      if (next) {
        setCurrent(next.code);
        setHistory((h) => ({
          ...h,
          seen: [...new Set([...h.seen, next.code])],
        }));
      }
    }
  }, [current, order, history.seen]);
  useEffect(() => {
    if (reset) {
      dialog.current?.showModal();
      cancelReset.current?.focus();
    } else dialog.current?.close();
  }, [reset]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const entry = feed?.codes.find((e) => e.code === current);
  const codeSet = useMemo(
    () => new Set(feed?.codes.map((e) => e.code)),
    [feed],
  );
  const count = (items: string[]) => items.filter((c) => codeSet.has(c)).length;
  const remaining = order.filter((e) => !history.seen.includes(e.code)).length;
  function advance(action: "next" | "skipped" | "tried") {
    setUndo({ history, current });
    const next = moveForward(history, current, order, action);
    setHistory(next.history);
    setCurrent(next.current);
    setNotice(
      action === "tried"
        ? "اتسجلت كتجربة محلية، مش تأكيد صلاحية."
        : action === "skipped"
          ? "تم تخطي الكود."
          : "الكود التالي جاهز.",
    );
    requestAnimationFrame(() => codeFocus.current?.focus());
  }
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice("تعذر النسخ التلقائي. حدد النص وانسخه يدويًا.");
    }
  }
  async function share() {
    const url = location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "مفاتيح نسك", url });
      else await copy(url, "تم نسخ رابط الموقع.");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setNotice("تعذرت المشاركة. انسخ رابط الموقع من المتصفح.");
    }
  }
  function exportHistory() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(history, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nusuk-history-${SEASON}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importHistory(f?: File) {
    if (!f) return;
    try {
      if (f.size > 2000000) throw new Error("الملف أكبر من المسموح");
      const h = parseHistory(await f.text());
      setHistory((old) => ({
        ...old,
        seen: [...new Set([...old.seen, ...h.seen])],
        tried: [...new Set([...old.tried, ...h.tried])],
        skipped: [...new Set([...old.skipped, ...h.skipped])],
      }));
      setCurrent(undefined);
      setUndo(undefined);
      setNotice("تم دمج السجل مع بياناتك الحالية.");
    } catch (e) {
      setNotice((e as Error).message);
    }
    if (file.current) file.current.value = "";
  }
  const stale =
    feed && now - Date.parse(feed.manifest.generatedAt) > 7 * 86400000;
  return (
    <>
      <a className="skip-link" href="#browser">
        انتقل للأكواد
      </a>
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-mark">✦</span>
          <span>
            مفاتيح نسك<small>من المجتمع، للمجتمع</small>
          </span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          <a href="#how">إزاي تستخدمه؟</a>
          <a href="#faq">أسئلة شائعة</a>
          <button
            className="icon-button"
            aria-label="تغيير المظهر"
            onClick={() =>
              setTheme(
                theme === "system"
                  ? "dark"
                  : theme === "dark"
                    ? "light"
                    : "system",
              )
            }
          >
            {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
            <span className="theme-label">
              {theme === "system"
                ? "تلقائي"
                : theme === "dark"
                  ? "داكن"
                  : "فاتح"}
            </span>
          </button>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span className="dot" /> مساحة مجتمعية مستقلة{" "}
            <span className="line" /> نوفمبر ٢٠٢٦
          </div>
          <h1>
            مفتاحك الجاي،
            <br />
            <em>يمكن يكون هنا.</em>
          </h1>
          <p>
            مساحة مجتمعية لتبادل أكواد المسابقة.
            <br className="desktop-break" /> انسخ الكود، وكمّل خطواتك في نسك الرسمي.
          </p>
          <div className="trust-note">
            ◇ أكواد مرشحة غير متحقق منها · بدون حساب
          </div>
          <span className="ornament" aria-hidden="true">
            ۞
          </span>
        </section>
        <section aria-label="معلومات تساعدك" className="tips-section">
          <div className="section-overline">
            <span>قبل ما تبدأ</span>
            <div>
              <button
                aria-label="المعلومة السابقة"
                onClick={() =>
                  strip.current?.scrollBy({ left: 280, behavior: "instant" })
                }
              >
                →
              </button>
              <button
                aria-label="المعلومة التالية"
                onClick={() =>
                  strip.current?.scrollBy({ left: -280, behavior: "instant" })
                }
              >
                ←
              </button>
            </div>
          </div>
          <div className="tips" ref={strip} tabIndex={0}>
            {tips.map(([icon, title, text]) => (
              <article className="tip" key={title}>
                <span aria-hidden="true">{icon}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        {(!online || feed?.cached || stale || storageWarning) && (
          <div className="banner" role="status">
            {!online ? "أنت غير متصل. " : ""}
            {feed?.cached
              ? "بنعرض آخر نسخة محفوظة بعد فحص سلامة الملف، وليس صلاحية الأكواد. "
              : ""}
            {stale
              ? "البيانات أقدم من ٧ أيام؛ راجع شروط الموسم داخل نسك. "
              : ""}
            {storageWarning
              ? "التخزين غير متاح؛ تقدمك محفوظ في الجلسة الحالية فقط."
              : ""}
          </div>
        )}
        {feed?.manifest.maintenance && (
          <div className="banner">
            الخدمة تحت الصيانة. التصفح متاح للقراءة فقط.
          </div>
        )}
        <div className="preview-note">
          معاينة المرحلة الأولى · ١٬١٣٢ كود مرشح بانتظار المراجعة، ولا يوجد كود
          مؤكد التفعيل.
        </div>
        <section
          id="browser"
          className="browse-layout"
          aria-label="تصفح الأكواد"
        >
          <div className="code-card">
            <div className="card-top">
              <span>
                <span className="dot" /> أكواد المجتمع
              </span>
              <span className="badge">غير متحقق منها</span>
            </div>
            {loading ? (
              <div className="state" role="status">
                <div className="skeleton" />
                <p>بنجهز لك أكواد المجتمع…</p>
              </div>
            ) : error ? (
              <div className="state">
                <h2>الاتصال محتاج محاولة تانية</h2>
                <p>{error}</p>
                <button className="primary" onClick={() => void reload()}>
                  إعادة المحاولة ↻
                </button>
                <a
                  href="https://services.nusuk.sa/app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  افتح نسك الرسمي ↗
                </a>
              </div>
            ) : !order.length ? (
              <div className="state">
                <h2>لا توجد أكواد مؤكدة للموسم الحالي بعد</h2>
                <p>ولا توجد مرشحات متاحة في هذه النسخة. ارجع لنا لاحقًا.</p>
                <a
                  href="https://services.nusuk.sa/app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  فتح نسك الرسمي ↗
                </a>
              </div>
            ) : !current ? (
              <div className="state">
                <span className="state-symbol">✓</span>
                <h2>شوفت كل الأكواد المتاحة</h2>
                <p>سجلك محفوظ هنا. تقدر ترجع خطوة أو تصفّره وتبدأ من جديد.</p>
                <button className="primary" onClick={() => setReset(true)}>
                  بدء جولة جديدة
                </button>
              </div>
            ) : (
              <>
                <div className="code-area">
                  <p className="mini-label">مفتاح من المجتمع، جرّبه بنفسك</p>
                  <h2 ref={codeFocus} tabIndex={-1} dir="ltr" className="code">
                    {current}
                  </h2>
                  <span className="code-caption">
                    الكود حساس لحالة الحروف · انسخه زي ما هو
                  </span>
                </div>
                <div className="main-actions">
                  <button
                    className="primary"
                    onClick={() =>
                      void copy(current, "تم نسخ الكود. كمل الخطوات داخل نسك.")
                    }
                  >
                    <span aria-hidden="true">▣</span> نسخ الكود
                  </button>
                  <a
                    className="secondary"
                    href={officialUrl(current)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    فتح في نسك <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <p className="external-note">
                  الرابط يفتح موقع / تطبيق نسك الرسمي في نافذة جديدة.
                  <br />
                  فتح الرابط أو نسخ الكود لا يؤكد نجاح التفعيل.
                </p>
                <div className="next-actions">
                  <button className="next" onClick={() => advance("next")}>
                    التالي <span aria-hidden="true">←</span>
                  </button>
                  <button onClick={() => advance("skipped")}>تخطي</button>
                  <button onClick={() => advance("tried")}>
                    جرّبت الكود ✓
                  </button>
                </div>
              </>
            )}
            <div className="card-bottom">
              <span>◷ مفيش تكرار على نفس المتصفح</span>
              <button
                disabled={!undo}
                onClick={() => {
                  if (undo) {
                    setHistory(undo.history);
                    setCurrent(undo.current);
                    setUndo(undefined);
                    setNotice("تم التراجع عن آخر خطوة.");
                  }
                }}
              >
                ↶ تراجع
              </button>
            </div>
          </div>
          <aside className="progress-card">
            <span className="mini-label">خطوة بخطوة</span>
            <h2>رحلتك هنا</h2>
            <p>
              سجلك على جهازك بس.
              <br />
              من غير حساب أو بيانات شخصية.
            </p>
            <div className="stats">
              <div>
                <strong>{remaining.toLocaleString("ar-EG")}</strong>
                <span>كود متبقي</span>
              </div>
              <div>
                <strong>{count(history.seen).toLocaleString("ar-EG")}</strong>
                <span>كود شفته</span>
              </div>
            </div>
            <progress
              aria-label="نسبة الأكواد التي شاهدتها"
              value={count(history.seen)}
              max={order.length || 1}
            />
            <div className="local-counts">
              <span>جرّبت {count(history.tried).toLocaleString("ar-EG")}</span>
              <span>
                تخطّيت {count(history.skipped).toLocaleString("ar-EG")}
              </span>
            </div>
            <details>
              <summary>إدارة سجلك المحلي</summary>
              <div className="history-actions">
                <button onClick={exportHistory}>تصدير السجل ↓</button>
                <button onClick={() => file.current?.click()}>
                  استيراد ودمج ↑
                </button>
                <button onClick={() => setReset(true)}>مسح السجل</button>
              </div>
            </details>
            <input
              ref={file}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(e) => void importHistory(e.target.files?.[0])}
            />
            <div className="privacy-note">
              ◇ لو مسحت بيانات المتصفح أو غيّرت الجهاز، الأكواد ممكن تظهر تاني.
            </div>
          </aside>
        </section>
        <div className="freshness">
          <span>
            ◷ آخر تحديث:{" "}
            {feed
              ? new Date(feed.manifest.generatedAt).toLocaleDateString(
                  "ar-EG",
                  { day: "numeric", month: "long", year: "numeric" },
                )
              : "—"}{" "}
            · {feed?.codes.length.toLocaleString("ar-EG") || "—"} مرشح
          </span>
          <a href="#sources">اعرف مصدر الأكواد ↗</a>
        </div>
        <section id="how" className="how">
          <div className="section-heading">
            <span className="mini-label">ببساطة</span>
            <h2>من هنا، لنسك في ٣ خطوات.</h2>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "اختار مفتاحك",
                "تصفّح الأكواد، وكل ضغطة «التالي» بتوريك كود لسه ما شفتوش.",
              ],
              [
                "02",
                "انسخ أو افتح",
                "انسخ الكود بحروفه الأصلية أو افتح رابطه مباشرة في نسك.",
              ],
              [
                "03",
                "كمّل داخل نسك",
                "راجع شروط التحدي وجرّب الكود داخل التطبيق الرسمي.",
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="sources" className="source-box">
          <span className="source-icon" aria-hidden="true">
            ◇
          </span>
          <div>
            <h2>شفافية من أول مفتاح.</h2>
            <p>
              دي معاينة المرحلة الأولى لبيانات مرشحة، مش قائمة أكواد معتمدة.
              ١٬١٣١ كود من منشور فيسبوك صدّره مساهم، وكود واحد من رابط مشاركة
              قدّمه مستخدم. تاريخ الرصد ١ نوفمبر ٢٠٢٦ لا يثبت تاريخ النشر أو
              أهلية الموسم. عدد الأكواد المؤكد تفعيلها: صفر.
            </p>
            {entry && (
              <p className="source-detail">
                مصدر الكود الحالي: <bdi>{entry.source}</bdi> · رُصد في ١ نوفمبر
                ٢٠٢٦
              </p>
            )}
            <p className="source-detail">
              الإضافة والإبلاغ متوقفان لحين توفير قناة مراجعة محمية. لن نطلب
              حساب نسك أو هاتفك أو كلمة مرور أو رمز OTP.
            </p>
          </div>
        </section>
        <section id="faq" className="faq">
          <h2>أسئلة على بالك</h2>
          {[
            [
              "هل الموقع تابع لنسك؟",
              "لا. مفاتيح نسك مشروع مجتمعي مستقل، غير تابع لنسك أو أي جهة حكومية.",
            ],
            [
              "هل كل كود يضمن مفتاح أو فرصة؟",
              "لا نضمن الصلاحية أو الأهلية أو الجوائز. راجع شروط التحدي وعدد الفرص اليومية داخل تطبيق نسك الرسمي.",
            ],
            [
              "هل بتسجلوا الأكواد اللي جربتها؟",
              "السجل محلي على متصفحك، ومش بيتبعت لخادم. «جرّبت الكود» مجرد ملاحظة منك وليس تأكيد تفعيل. يمكنك تصديره ودمجه يدويًا على جهاز آخر.",
            ],
            [
              "الأكواد جاية منين؟",
              "بيانات مجتمعية مرشحة غير متحقق منها. لا ننشر أسماء المعلقين أو ملفاتهم الشخصية، ولا نستخدم أكواد المواسم القديمة.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="closing">
          <span aria-hidden="true">✦</span>
          <h2>كل الخطوات بتكمل في نسك.</h2>
          <p>راجع الشروط والتفاصيل الأحدث في التطبيق الرسمي.</p>
          <a
            className="primary"
            href="https://services.nusuk.sa/app"
            target="_blank"
            rel="noopener noreferrer"
          >
            افتح نسك الرسمي ↗
          </a>
          <button onClick={() => void share()}>شارك الموقع مع أصحابك ↗</button>
        </section>
      </main>
      <footer>
        <a className="brand" href="#">
          ✦ مفاتيح نسك
        </a>
        <p>
          مساحة مجتمعية مستقلة. لا ضمان لصلاحية الأكواد أو الأهلية.
          <br />
          استخدم الأكواد داخل نسك الرسمي فقط. لا نطلب أي بيانات شخصية.
        </p>
        <span>صُنع بروح المشاركة · ٢٠٢٦</span>
      </footer>
      <div className="toast" role="status" aria-live="polite" key={notice}>
        {notice}
      </div>
      <dialog
        aria-labelledby="reset-heading"
        ref={dialog}
        onCancel={() => setReset(false)}
        onClose={() => setReset(false)}
      >
        <h2 id="reset-heading">تمسح سجلّك وتبدأ من جديد؟</h2>
        <p>
          الأكواد اللي شفتها ممكن تظهر تاني. صدّر السجل أولًا لو محتاج نسخة.
        </p>
        <div className="main-actions">
          <button
            className="primary"
            onClick={() => {
              setHistory(newHistory());
              setCurrent(undefined);
              setUndo(undefined);
              setReset(false);
              setNotice("تم مسح السجل وبدء جولة جديدة.");
            }}
          >
            نعم، امسح السجل
          </button>
          <button
            className="secondary"
            ref={cancelReset}
            onClick={() => setReset(false)}
          >
            إلغاء
          </button>
        </div>
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
