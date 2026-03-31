const fs = require('fs');
let code = fs.readFileSync('src/style/ui/primitives/OreToggleButton.css', 'utf8');
const lines = code.split('\n');
lines.splice(102, 45, 
  /* --- 未选中状态 --- */
  .ore-toggle-btn-item:not(.is-active) {
    background-color: #D0D1D4;
    color: #000000;
    box-shadow: inset 0 -4px #58585A, inset 3px 3px rgba(255, 255, 255, 0.6), inset -3px -7px rgba(255, 255, 255, 0.4);
    padding-bottom: 6px;
  }

  .ore-toggle-btn-item:not(.is-active):hover {
    background-color: #B1B2B5;
    box-shadow: inset 0 -4px #58585A, inset 3px 3px rgba(255, 255, 255, 0.8), inset -3px -7px rgba(255, 255, 255, 0.6);
  }

  .ore-toggle-btn-item:not(.is-active):active {
    background-color: #B1B2B5;
    box-shadow: inset 3px 3px rgba(255, 255, 255, 0.8), inset -3px -3px rgba(255, 255, 255, 0.6);
    padding-bottom: 2px;
    padding-top: 4px;
  }

  /* --- 选中状态 --- */
  .ore-toggle-btn-item.is-active {
    background-color: #3C8527;
    color: #FFFFFF;
    box-shadow: inset 0 -4px #1D4D13, inset 3px 3px rgba(255, 255, 255, 0.2), inset -3px -7px rgba(255, 255, 255, 0.1);
    padding-bottom: 6px;
    cursor: default;
  });
fs.writeFileSync('src/style/ui/primitives/OreToggleButton.css', lines.join('\n'), 'utf8');
