# 🚀 ReyadBuilder | Free Drag & Drop HTML Visual Page Builder & Editor
### محرر صفحات ويب مرئي من تطوير Mohamed Reyad مع السحب والإفلات وتصدير HTML & PDF

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_Online-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://reyad-dev.github.io/html-visual-builder/)
[![Build Status](https://img.shields.io/badge/Build-Passing-10b981?style=for-the-badge&logo=github-actions)](https://github.com/reyad-dev/html-visual-builder)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.3-06b6d4?style=for-the-badge&logo=react)](https://react.dev/)
[![GrapesJS](https://img.shields.io/badge/GrapesJS-0.23-6366f1?style=for-the-badge)](https://grapesjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6.3-9333ea?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Vitest-144%20Passed-10b981?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> 🌐 **Live Demo (جرّب المحرر أونلاين فوراً):**  
> **[https://reyad-dev.github.io/html-visual-builder/](https://reyad-dev.github.io/html-visual-builder/)**

> **ReyadBuilder**, created by **Mohamed Reyad (@reyad-dev)**, is an enterprise-grade, high-fidelity visual HTML page builder designed for developers, designers, and marketers. Build modern responsive layouts with drag-and-drop ease, inspect and style CSS properties with millimeter precision, preview across multiple device viewports, and export clean, standalone HTML5 documents or vector-grade PDFs with first-class Arabic typography support.

---

## 🌟 Highlights & Key Features | أبرز المميزات

- 🎯 **Intuitive Drag & Drop Canvas (محرر سحب وإفلات مرئي):**
  Drag sections, containers, multi-column grids, typography, buttons, media, and dividers directly onto the visual artboard with realtime snap and drop feedback.

- 🌐 **First-Class Arabic RTL & Natural Flow (الأولوية الكاملة للغة العربية والـ RTL الطبيعي):**
  Native, non-destructive RTL layout engine that preserves author column arrangements, flexbox rows, and custom alignments without reversing or mirroring your designs. Includes a one-click top toolbar switcher `[ ⇄ RTL (عربي) ]` / `[ ⇄ LTR ]` to toggle live canvas direction on the fly.

- 🔤 **Intelligent Font Detection & Local Font Uploader (محرك التعرف على الخطوط وتحميل الخطوط محلياً):**
  Automatically detects all fonts declared in imported HTML/CSS. Expanded pre-integrated Arabic Google Fonts (**Alexandria, Cairo, Tajawal, Almarai, Amiri, Changa, Noto Sans Arabic, Rubik, El Messiri, Readex Pro, IBM Plex Arabic**). For missing or proprietary fonts, upload local font files (`.woff2`, `.woff`, `.ttf`, `.otf`) directly; the engine automatically converts them to `@font-face` data URIs, injects them into the canvas, and preserves them in your exported files.

- 🎛️ **Card-Based Style Inspector (مفتش الخصائص وتصميم البطاقات المريح):**
  Enhanced accordion panels with 44px comfortable touch targets, zero vertical font clipping, clear spacing, and generous scroll room across all 7 styling sectors (Layout, Spacing, Size, Typography, Background, Border, Effects).

- 📥 **Streamlined HTML File Import (استيراد مباشر لملفات HTML):**
  Dedicated dropzone prioritized as the primary import tab supporting `.html` and `.htm` files up to 5 MB, with real-time font detection and custom direction controls.

- 🖨️ **Print & Export to PDF (طباعة وتصدير عالي الدقة كـ PDF):**
  Export your designs directly to standalone vector PDF documents using native `@media print` rules and browser print dialogs (`Ctrl + P`), preserving exact layout fidelity, background colors, and web fonts.

- ⚡ **Zero-Dependency Standalone Export (تصدير كود HTML5 & CSS نظيف ومستقل):**
  Generate deterministic, production-ready HTML5 files with scoped CSS. Completely self-contained, offline-compatible, and free of vendor lock-in.

- ✨ **Pre-built Starter Templates Gallery (مكتبة قوالب وأمثلة جاهزة):**
  Instant access to curated, responsive templates including SaaS Landing Pages, Personal Portfolios, Business & Agency Showcases, and starter canvas examples.

- 📱 **Multi-Device Responsive Previews (معاينة متعددة الأجهزة):**
  One-click responsive toggles between **Desktop**, **Tablet (768px)**, and **Mobile (375px)** viewports with synchronized canvas scaling.

- 💾 **Local Offline Persistence (حفظ تلقائي وإدارة المشاريع):**
  IndexedDB and LocalStorage persistence engine with automatic state restoration, project duplicate/rename/delete capabilities, and dirty state tracking.

- 🛡️ **Enterprise-Grade Security & Sanitization (أمان وحماية متقدمة):**
  Strict XSS sanitization powered by DOMPurify, CSS AST parsing, external remote resource detection, and safe iframe isolation.

---

## 📂 Pre-built Example Templates | القوالب الجاهزة

| Template | Category | Description | Arabic Title |
| :--- | :--- | :--- | :--- |
| **SaaS Product Landing** | `Landing Page` | Modern conversion-focused landing page with hero, 3-column features grid, and CTA | صفحة هبوط تطبيق ومنتجات رقمية |
| **Personal Portfolio & Bio** | `Portfolio` | Clean personal website showcase featuring bio, skills pills, project cards, and social links | معرض أعمال وسيرة ذاتية شخصية |
| **Business Agency Showcase** | `Business` | High-impact corporate agency layout with metrics counters and contact sections | صفحة شركة وخدمات أعمال |
| **Starter Visual Canvas** | `Starter` | Clean centered starter layout with section, heading, button, and responsive columns | المثال الأساسي المنسق |

---

## 🛠️ Tech Stack & Architecture | البنية التقنية

- **Core Framework:** [React 19](https://react.dev/) + [TypeScript 5.9](https://www.typescriptlang.org/)
- **Visual Builder Engine:** [GrapesJS Core 0.23](https://grapesjs.com/) (Headless adapter pattern)
- **State Management:** [Zustand 5](https://github.com/pmndrs/zustand)
- **Security & Sanitization:** [DOMPurify 3.4](https://github.com/cure53/DOMPurify)
- **Build Tool:** [Vite 6](https://vitejs.dev/)
- **Testing Suite:** [Vitest 5](https://vitest.dev/) (144 unit & integration tests across 19 suites)
- **Typography:** Alexandria, Cairo, Tajawal, Almarai, Amiri, Changa, Noto Sans Arabic, Rubik, El Messiri, Readex Pro, IBM Plex Arabic, Inter, JetBrains Mono

---

## 🚀 Quick Start | البدء السريع

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- npm or yarn or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/reyad-dev/html-visual-builder.git

# Navigate into the project directory
cd html-visual-builder

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open your browser at `http://localhost:5173` to start designing!

---

## ⌨️ Keyboard Shortcuts | اختصارات لوحة المفاتيح

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | **Save Project** | Saves current canvas state to browser storage |
| `Ctrl + P` / `Cmd + P` | **Print / Export PDF** | Opens print dialog to print or save vector PDF |
| `Ctrl + Z` / `Cmd + Z` | **Undo** | Reverts the last editor action |
| `Ctrl + Shift + Z` / `Ctrl + Y` | **Redo** | Re-applies the previously undone action |
| `Ctrl + D` / `Cmd + D` | **Duplicate** | Duplicates currently selected element |
| `Delete` / `Backspace` | **Delete Element** | Removes currently selected element from canvas |

---

## 🧪 Testing & Verification | الاختبارات والتحقق

The project maintains 100% test pass rate across 19 test suites covering core editor logic, DOM sanitization, export generators, persistence, and UI components.

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript typecheck
npm run typecheck

# Run ESLint validation
npm run lint
```

---

## 📦 Project Scripts | أوامر المشروع

- `npm run dev` - Launches Vite local dev server with HMR.
- `npm run build` - Compiles TypeScript and creates optimized production bundle.
- `npm run test` - Executes all Vitest suites.
- `npm run typecheck` - Typechecks codebase with strict TypeScript compiler.
- `npm run lint` - Lints project files with ESLint.
- `npm run format` - Formats codebase using Prettier.

---

## 👤 Author & Maintainer | المطور

**Mohamed Reyad (@reyad-dev)** | Creator of **ReyadBuilder**  
- **GitHub:** [@reyad-dev](https://github.com/reyad-dev)  
- **Focus:** Web Design, AI-Assisted Development & Architecture  

---

## 📄 License | الترخيص

This project is open-source and licensed under the [MIT License](LICENSE).
