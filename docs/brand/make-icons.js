// Renders (run from a folder with @resvg/resvg-js installed) Intro's icon and splash from the brand font (Unbounded Bold) and colours.
// Usage: node make-icons.js <outDir>
const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const out = process.argv[2];
const FONT = "C:/Users/MikeGrady/Mikes_Super_Secret_Work_Area/app/node_modules/@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf";
const NAVY = "#15213B", GREEN = "#12A150", GREEN_DARK_MODE = "#22C063", WHITE = "#FFFFFF", NIGHT = "#0C111B";

function render(svg, width, file) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: "Unbounded" } }).render().asPng();
  fs.writeFileSync(path.join(out, file), png);
  console.log(file, width + "px", png.length + " bytes");
}

// "i." mark: white i, green full stop. size = font size, y = baseline, both in a 1024 box.
const mark = (fill, dot, size = 600, y = 735) =>
  `<text x="512" y="${y}" text-anchor="middle" font-family="Unbounded" font-weight="700" font-size="${size}" letter-spacing="-20"><tspan fill="${fill}">i</tspan><tspan fill="${dot}">.</tspan></text>`;

// iOS icon: full square, no transparency (iOS rounds the corners).
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${NAVY}"/>${mark(WHITE, GREEN)}</svg>`, 1024, "icon.png");

// Android adaptive icon: navy background layer, mark on a transparent foreground kept inside the safe circle (about 61%).
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${NAVY}"/></svg>`, 512, "android-icon-background.png");
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark(WHITE, GREEN, 400, 655)}</svg>`, 512, "android-icon-foreground.png");
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark(WHITE, WHITE, 400, 655)}</svg>`, 432, "android-icon-monochrome.png");

// Splash: the wordmark "intro." on a transparent background, light and dark versions.
const word = (fill, dot) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><text x="512" y="575" text-anchor="middle" font-family="Unbounded" font-weight="700" font-size="200" letter-spacing="-8"><tspan fill="${fill}">intro</tspan><tspan fill="${dot}">.</tspan></text></svg>`;
render(word(NAVY, GREEN), 1024, "splash-icon.png");
render(word(WHITE, GREEN_DARK_MODE), 1024, "splash-icon-dark.png");

// Favicon for the web build.
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="220" fill="${NAVY}"/>${mark(WHITE, GREEN)}</svg>`, 48, "favicon.png");
// A preview sheet for Mike: the icon at home-screen size next to the splash.
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560"><rect width="1400" height="560" fill="#EEF1F5"/>
  <g transform="translate(60,80) scale(0.39)"><rect width="1024" height="1024" rx="230" fill="${NAVY}"/>${mark(WHITE, GREEN)}</g>
  <g transform="translate(520,60)"><rect width="380" height="440" rx="40" fill="${WHITE}"/><g transform="translate(-60,-80) scale(0.49)">${word(NAVY, GREEN).replace(/<\/?svg[^>]*>/g, "")}</g></g>
  <g transform="translate(960,60)"><rect width="380" height="440" rx="40" fill="${NIGHT}"/><g transform="translate(-60,-80) scale(0.49)">${word(WHITE, GREEN_DARK_MODE).replace(/<\/?svg[^>]*>/g, "")}</g></g>
</svg>`, 1400, "preview.png");
