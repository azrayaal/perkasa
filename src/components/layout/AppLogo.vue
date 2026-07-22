<script setup lang="ts">
/**
 * Lambang Perkasa: profil baja "H" (simbol usaha material konstruksi) di dalam
 * perisai. Digambar sebagai SVG inline — tidak ada file gambar yang perlu
 * dimuat, dan warnanya otomatis ikut token tema.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 40 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 40 40"
    fill="none"
    role="img"
    aria-label="Logo Perkasa ERP"
    class="shrink-0"
  >
    <path
      d="M20 2.5 34.5 7v13.4c0 8.2-5.6 14.4-14.5 17.1C11.1 34.8 5.5 28.6 5.5 20.4V7L20 2.5Z"
      fill="rgb(var(--ink-strong))"
      stroke="rgb(var(--brand))"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <!-- Penampang baja profil H -->
    <path
      d="M13 12h4v5.6h6V12h4v16h-4v-5.6h-6V28h-4V12Z"
      fill="rgb(var(--brand))"
    />
  </svg>
</template>
