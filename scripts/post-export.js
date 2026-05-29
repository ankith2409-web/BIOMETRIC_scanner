const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const fontsTargetDir = path.join(distDir, 'assets/fonts');

// Helper to recursively find files matching a pattern
function findFiles(dir, pattern, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, pattern, fileList);
    } else if (pattern.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Find MaterialCommunityIcons ttf file
const sourceFonts = findFiles(
  path.join(distDir, 'assets'),
  /^MaterialCommunityIcons\..*\.ttf$/
);

if (sourceFonts.length > 0) {
  if (!fs.existsSync(fontsTargetDir)) {
    fs.mkdirSync(fontsTargetDir, { recursive: true });
  }
  
  sourceFonts.forEach(sourceFont => {
    const fileName = path.basename(sourceFont);
    const targetPath = path.join(fontsTargetDir, 'MaterialCommunityIcons.ttf');
    fs.copyFileSync(sourceFont, targetPath);
    console.log(`Copied: ${fileName} -> assets/fonts/MaterialCommunityIcons.ttf`);
  });
} else {
  console.log('No MaterialCommunityIcons font file found in dist/assets');
}
