# محلل التداول الذكي 📊

تطبيق PWA لتحليل الأسواق المالية بالذكاء الاصطناعي باستخدام 7 نظريات تداول.

---

## خطوات التشغيل

### المتطلبات
- Node.js 18+ من [nodejs.org](https://nodejs.org)
- حساب على [vercel.com](https://vercel.com)
- مفتاح API من [console.anthropic.com](https://console.anthropic.com/settings/keys)

---

### الخطوة 1 — تثبيت المكتبات

افتح Terminal داخل مجلد المشروع وشغّل:

```bash
npm install
```

---

### الخطوة 2 — إضافة مفتاح API (للتشغيل المحلي)

انسخ ملف المثال وأضف مفتاحك:

```bash
cp .env.local.example .env.local
```

افتح `.env.local` وضع مفتاحك بدلاً من `sk-ant-xxx...`:

```
ANTHROPIC_API_KEY=sk-ant-مفتاحك-هنا
```

---

### الخطوة 3 — تشغيل محلي (اختياري)

```bash
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

---

### الخطوة 4 — النشر على Vercel

**أ) رفع المشروع على GitHub:**

1. اذهب إلى [github.com/new](https://github.com/new) وأنشئ مستودعاً جديداً
2. شغّل هذه الأوامر:

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/اسم-المستخدم/اسم-المستودع.git
git push -u origin main
```

**ب) ربط Vercel بـ GitHub:**

1. اذهب إلى [vercel.com/new](https://vercel.com/new)
2. اختر "Import Git Repository" وحدد مستودعك
3. اضغط **Deploy** — Vercel سيكتشف Next.js تلقائياً

**ج) إضافة مفتاح API في Vercel:**

1. بعد النشر، اذهب إلى **Settings → Environment Variables**
2. أضف:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** مفتاحك من Anthropic
3. اضغط **Save** ثم أعد النشر من **Deployments → Redeploy**

---

### الخطوة 5 — تثبيت التطبيق على الهاتف (PWA)

**على الآيفون (Safari):**
اذهب إلى رابط التطبيق ← اضغط زر المشاركة ⬆️ ← اختر "إضافة إلى الشاشة الرئيسية"

**على أندرويد (Chrome):**
اذهب إلى رابط التطبيق ← ستظهر رسالة "تثبيت التطبيق" ← اضغط تثبيت

---

## ملاحظة أمنية

لا تشارك ملف `.env.local` ولا تضع مفتاح API في أي ملف مرفوع على GitHub.
المفتاح يُستخدم فقط من جهة الخادم عبر `/api/analyze` ولا يظهر للمستخدمين أبداً.
