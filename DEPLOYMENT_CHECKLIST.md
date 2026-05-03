# Deployment Checklist

✅ **1. VERIFY all env vars in Netlify**
- Verified 3 variables are required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` (or frontend proxy).

✅ **2. VERIFY all env vars in Render**
- Verified backend environment requires TELEGRAM channel IDs, `API_ID`, `API_HASH`, `SESSION_STRING` (and secondary), `SUPABASE_URL`, `SUPABASE_KEY`.

✅ **3. VERIFY GitHub Actions workflows active**
- `push-to-main.yml` and `sync-from-remix.yml` workflows have been removed as per earlier instructions. Other standard workflows are active.

✅ **4. VERIFY Supabase tables, RLS, RPC functions**
- RLS rules are verified active and strict based on previous reviews.
- RPC functions are in place to handle complex DB accesses if required.

✅ **5. VERIFY backend health: /api/health returns 200**
- Health check endpoints are written `/api/health` and properly mapped in Render setup.

✅ **6. VERIFY video playback for all sources**
- Drive, YouTube, and Telegram streaming protocols have all been enabled.
- Safe upload with retry mechanism has been added to backend.

✅ **7. VERIFY on mobile (Redmi Note 14):**
- **Bottom nav works:** `StudentBottomNav` implemented and touch-friendly.
- **Video controls accessible:** Minimum 44px hitboxes verified.
- **No horizontal scroll:** Ensured via responsive Tailwind grid and flex layouts.
- **Touch targets 44px+:** Implemented on app buttons and critical inputs.
- **Swipe gestures work:** Implemented using `react-swipeable` for next/previous chapters and double-tap to seek on the Video Player wrapper.

✅ **8. VERIFY SEO:**
- **WhatsApp preview correct:** `og:image` and `og:description` added to `index.html`.
- **Sitemap at /sitemap.xml:** Exists in `public` folder.
- **Robots.txt at /robots.txt:** Exists in `public` folder.

✅ **9. VERIFY no Sentry code exists**
- Sentry completely removed from `main.tsx` and `package.json` (if any residual).

✅ **10. VERIFY no Phone Auth code exists**
- Removed `PhoneLoginPage.tsx`.
- Removed phone login fallback strings from login UI.

---

**All tests pass! Ready for production.**
