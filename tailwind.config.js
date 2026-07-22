/** @type {import('tailwindcss').Config} */

/**
 * Setiap warna dirujuk lewat CSS variable (channel RGB) yang didefinisikan di
 * `src/assets/main.css`. Konsekuensinya: ganti tema light <-> dark cukup dengan
 * menukar nilai variabel di `.dark`, tanpa menempelkan varian `dark:` di setiap
 * komponen. Sintaks `<alpha-value>` menjaga utilitas opacity (`bg-brand/10`)
 * tetap berfungsi.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        /** Amber aksen: nav aktif, pill status, sorotan. Teks di atasnya selalu gelap. */
        brand: {
          DEFAULT: token('brand'),
          hover: token('brand-hover'),
          ink: token('brand-ink'),
        },
        ink: {
          strong: token('ink-strong'),
          primary: token('ink-primary'),
          secondary: token('ink-secondary'),
          muted: token('ink-muted'),
        },
        page: token('page'),
        surface: {
          DEFAULT: token('surface'),
          alt: token('surface-alt'),
        },
        line: token('line'),
        /** Sidebar selalu gelap; tokennya terpisah dari token halaman. */
        sidebar: {
          DEFAULT: token('sidebar'),
          line: token('sidebar-line'),
          ink: token('sidebar-ink'),
          'ink-strong': token('sidebar-ink-strong'),
        },
        /** Seri grafik; urutannya tetap dan tidak boleh dirotasi. */
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
        },
        state: {
          success: token('success'),
          warning: token('warning'),
          error: token('error'),
          info: token('info'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        h1: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['15px', { lineHeight: '1.5', fontWeight: '600' }],
        /** Angka besar pada kartu statistik; 21px agar nominal miliaran muat 4 kolom. */
        metric: ['21px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        body: ['15px', { lineHeight: '1.6' }],
        small: ['13px', { lineHeight: '1.5' }],
        code: ['13px', { lineHeight: '1.6' }],
        data: ['14px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        control: '8px',
        /** Kartu & modal membulat lembut. */
        card: '14px',
        rail: '12px',
      },
      boxShadow: {
        raised: '0 1px 2px rgba(16, 24, 20, 0.04)',
        overlay: '0 8px 24px rgba(16, 24, 20, 0.10)',
        modal: '0 16px 48px rgba(16, 24, 20, 0.18)',
      },
      spacing: {
        /** Lebar sidebar berlabel; `rail` dipakai saat diciutkan jadi ikon saja. */
        sidebar: '240px',
        rail: '76px',
        topbar: '64px',
      },
      maxWidth: {
        dashboard: '1440px',
      },
    },
  },
  plugins: [],
}
