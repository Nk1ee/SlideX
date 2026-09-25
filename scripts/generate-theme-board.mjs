import { mkdir, writeFile } from 'node:fs/promises';
import { PRESENTATION_THEMES } from '../dist/src/presentation/themes.js';

const order = [
  'deep_blue', 'business_slate', 'business_emerald', 'minimal_light',
  'minimal_graphite', 'dynamic_violet', 'dynamic_coral', 'minimal_sand',
];
const labels = { business: 'Деловой', minimal: 'Минималистичный', dynamic: 'Динамичный' };
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (ch) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);

function tile(id, index) {
  const theme = PRESENTATION_THEMES[id];
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  const x = 40 + (index % 4) * 380;
  const y = 160 + Math.floor(index / 4) * 340;
  const { colors, geometry } = theme;
  const motif = geometry.titleMotif === 'none' ? '' : geometry.titleMotif === 'energetic'
    ? `<polygon points="255,0 315,0 265,197 205,197" fill="#${colors.accent}" opacity=".35"/>
       <polygon points="326,0 350,0 300,197 276,197" fill="#${colors.accent}" opacity=".9"/>`
    : `<polygon points="275,0 329,0 279,197 225,197" fill="#${colors.accent}" opacity=".18"/>
       <polygon points="333,0 350,0 300,197 283,197" fill="#${colors.accent}" opacity=".88"/>`;
  const ruleWidth = geometry.titleMotif === 'none' ? 105 : geometry.titleMotif === 'energetic' ? 145 : 92;
  const ruleHeight = geometry.titleMotif === 'none' ? 2 : geometry.titleMotif === 'energetic' ? 9 : 4;
  return `<g transform="translate(${x} ${y})">
    <text x="0" y="-18" font-family="Arial, sans-serif" font-size="19" fill="#17223A">${escapeXml(id + ' · ' + labels[theme.family])}</text>
    <rect width="350" height="197" fill="#${colors.background}" stroke="#CCD4DF"/>
    <svg width="350" height="197" viewBox="0 0 350 197">
${motif ? `      ${motif}\n` : ''}      <text x="26" y="72" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#${colors.title}">
        <tspan x="26">Искусственный</tspan><tspan x="26" dy="29">интеллект</tspan><tspan x="26" dy="29">в образовании</tspan>
      </text>
      <rect x="26" y="156" width="${ruleWidth}" height="${ruleHeight}" fill="#${colors.accent}"/>
      <text x="26" y="182" font-family="Arial, sans-serif" font-size="10" fill="#${colors.subtitle}">Информатика · Иван Иванов · группа 24138</text>
    </svg>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="850" viewBox="0 0 1600 850">
  <rect width="1600" height="850" fill="#F5F7FB"/>
  <text x="800" y="70" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#17223A">Первые 8 визуальных тем SlideX</text>
  ${order.map(tile).join('\n')}
</svg>`;
await mkdir('docs/themes', { recursive: true });
await writeFile('docs/themes/first-eight.svg', svg, 'utf8');
console.log('Generated docs/themes/first-eight.svg');
