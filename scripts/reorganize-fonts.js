#!/usr/bin/env node

/**
 * Script to reorganize fonts into public/fonts directory
 * Run with: node scripts/reorganize-fonts.js
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const fontsDir = path.join(publicDir, 'fonts');

// Ensure fonts directory exists
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
  console.log('✓ Created public/fonts directory');
}

// Move Elms_Sans
const elmsSansSrc = path.join(publicDir, 'Elms_Sans');
const elmsSansDest = path.join(fontsDir, 'Elms_Sans');
if (fs.existsSync(elmsSansSrc)) {
  fs.renameSync(elmsSansSrc, elmsSansDest);
  console.log('✓ Moved Elms_Sans to public/fonts/Elms_Sans');
}

// Move mulish
const mulishSrc = path.join(publicDir, 'mulish');
const mulishDest = path.join(fontsDir, 'mulish');
if (fs.existsSync(mulishSrc)) {
  fs.renameSync(mulishSrc, mulishDest);
  console.log('✓ Moved mulish to public/fonts/mulish');
}

// Move Zen_Maru_Gothic
const zenSrc = path.join(publicDir, 'Zen_Maru_Gothic');
const zenDest = path.join(fontsDir, 'Zen_Maru_Gothic');
if (fs.existsSync(zenSrc)) {
  fs.renameSync(zenSrc, zenDest);
  console.log('✓ Moved Zen_Maru_Gothic to public/fonts/Zen_Maru_Gothic');
}

// Move Playwrite_HU from the combined folder
const playwriteCombinedSrc = path.join(publicDir, 'Elms_Sans,Playwrite_HU', 'Playwrite_HU');
const playwriteDest = path.join(fontsDir, 'Playwrite_HU');
if (fs.existsSync(playwriteCombinedSrc)) {
  // Create destination directory
  if (!fs.existsSync(playwriteDest)) {
    fs.mkdirSync(playwriteDest, { recursive: true });
  }
  
  // Copy all files and subdirectories
  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }
  
  copyDir(playwriteCombinedSrc, playwriteDest);
  console.log('✓ Moved Playwrite_HU to public/fonts/Playwrite_HU');
  
  // Remove the combined folder
  const combinedFolder = path.join(publicDir, 'Elms_Sans,Playwrite_HU');
  if (fs.existsSync(combinedFolder)) {
    fs.rmSync(combinedFolder, { recursive: true, force: true });
    console.log('✓ Removed Elms_Sans,Playwrite_HU folder');
  }
}

console.log('\n✅ Font reorganization complete!');
console.log('All fonts are now in public/fonts/');
console.log('\nNote: The CSS file (src/styles/fonts.css) has already been updated with the new paths.');

