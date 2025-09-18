// vuetify.config.ts
import { fa } from 'vuetify/locale'
import type { ExternalVuetifyOptions } from 'vuetify-nuxt-module'

export default {
  locale: {
    locale: 'fa',
    messages: { fa },
    rtl: { fa: true }
  },
   theme: {
    themes: {
      light: {
        colors: {
          primarymain: '#6d5842',
        },
      },
    },
  },
} satisfies ExternalVuetifyOptions
