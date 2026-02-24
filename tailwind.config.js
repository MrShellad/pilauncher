/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ore: {
          // --- 绿色按钮体系 ---
          green: {
            DEFAULT: '#3C8527',
            hover: '#2A641C',
            active: '#1D4D13',
            shadow: '#1D4D13', // 被 theme('colors.ore.green.shadow') 调用
          },
          // --- 红色按钮体系 ---
          red: {
            DEFAULT: '#C33636',
            hover: '#C02D2D',
            active: '#AD1D1D',
            shadow: '#AD1D1D', // 被 theme('colors.ore.red.shadow') 调用
          },
          // --- 灰色实体按钮体系 ---
          button: {
            DEFAULT: '#D0D1D4', 
            hover: '#B1B2B5',   // 被 theme('colors.ore.button.hover') 调用
            shadow: '#58585A',  // 被 theme('colors.ore.button.shadow') 调用
          },
          // --- 导航栏体系 ---
          nav: {
            DEFAULT: '#48494A',
            hover: '#58585A',
            active: '#313233',
            shadow: '#242425',  // 被 theme('colors.ore.nav.shadow') 调用
          },
          // --- 基础边框与轨道 ---
          gray: {
            border: '#1E1E1F',  
            track: '#8C8D90',   
          },
          // --- 文本颜色 ---
          text: {
            DEFAULT: '#FFFFFF',
            muted: '#D0D1D4',
            dark: '#000000',
          }
        }
      },
      fontFamily: {
        minecraft: ['"Minecraft Ten"', '"NotoSans Bold"', '"Noto Sans SC"', 'sans-serif'], 
      },
      spacing: {
        'ore-nav': '44px',
        'ore-btn-sm': '36px',
        'ore-btn-md': '40px',
      }
    },
  },
  plugins: [],
}