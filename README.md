# Bli.ic by Babelii

Internet Package Calculator: web app (Vite + React + TypeScript) yang juga dibungkus menjadi aplikasi Android dengan Capacitor.

## Web

```bash
npm install
npm run dev        # pengembangan
npm run build      # hasil di dist/
npm test
```

Dideploy otomatis ke GitHub Pages oleh `.github/workflows/pages.yml` (domain: https://bliic.diofis.net).

## Android (APK)

Di GitHub: tab **Actions** → **Build Android APK** → **Run workflow**, lalu unduh artifact `bliic-debug-apk` (berisi `app-debug.apk`).
APK debug bisa dipasang langsung di HP (izinkan "install dari sumber tidak dikenal").

Lokal (butuh JDK 21 dan Android SDK):

```bash
npm run android:apk      # hasil: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open     # buka di Android Studio
```

Di aplikasi Android, tombol **Beli** membuka halaman pesan Babelii di dalam aplikasi (Chrome Custom Tabs).
Untuk Google Play diperlukan build release yang ditandatangani (AAB); itu belum disiapkan.
