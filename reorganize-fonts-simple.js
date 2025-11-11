const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const fontsDir = path.join(publicDir, 'fonts');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Move Elms_Sans
if (fs.existsSync(path.join(publicDir, 'Elms_Sans'))) {
  fs.renameSync(path.join(publicDir, 'Elms_Sans'), path.join(fontsDir, 'Elms_Sans'));
  console.log('Moved Elms_Sans');
}

// Move mulish
if (fs.existsSync(path.join(publicDir, 'mulish'))) {
  fs.renameSync(path.join(publicDir, 'mulish'), path.join(fontsDir, 'mulish'));
  console.log('Moved mulish');
}

// Move Zen_Maru_Gothic
if (fs.existsSync(path.join(publicDir, 'Zen_Maru_Gothic'))) {
  fs.renameSync(path.join(publicDir, 'Zen_Maru_Gothic'), path.join(fontsDir, 'Zen_Maru_Gothic'));
  console.log('Moved Zen_Maru_Gothic');
}

// Move Playwrite_HU
const playwriteSrc = path.join(publicDir, 'Elms_Sans,Playwrite_HU', 'Playwrite_HU');
const playwriteDest = path.join(fontsDir, 'Playwrite_HU');
if (fs.existsSync(playwriteSrc)) {
  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }
  copyDir(playwriteSrc, playwriteDest);
  console.log('Moved Playwrite_HU');
  fs.rmSync(path.join(publicDir, 'Elms_Sans,Playwrite_HU'), { recursive: true, force: true });
}

console.log('Done!');

