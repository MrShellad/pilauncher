/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ore: {
          // --- 基础主题色 (用于发光特效、文字强调等) ---
          green: {
            DEFAULT: '#3C8527',
          },
          red: {
            DEFAULT: '#C33636',
          },
          button: {
            DEFAULT: '#D0D1D4', 
          },
          // --- 导航栏体系 ---
          nav: {
            DEFAULT: '#48494A',
            hover: '#58585A',
            active: '#313233',
            shadow: '#242425',  
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
        minecraft: ['"NotoSans Bold"', '"Noto Sans SC"', 'sans-serif'], 
      },
      // 这里的尺寸变量如果其他地方还在用就保留，按钮内部已经改用刚性尺寸了
      spacing: {
        'ore-nav': '44px',
        'ore-btn-sm': '36px',
        'ore-btn-md': '40px',
      }
    },
  },
  plugins: [],
}