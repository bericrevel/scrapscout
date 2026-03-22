import fs from 'fs';
import path from 'path';

const directory = path.join(process.cwd(), 'src');

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Replace tailwind classes
  content = content.replace(/indigo-/g, 'emerald-');
  content = content.replace(/blue-/g, 'emerald-');
  content = content.replace(/cyan-/g, 'emerald-');

  // Replace specific hex/rgba in index.css
  if (filePath.endsWith('index.css')) {
    content = content.replace(/#4f46e5/ig, '#10b981'); // Indigo 600 -> Emerald 500
    content = content.replace(/79,\s*70,\s*229/g, '16, 185, 129'); // rgba(79, 70, 229) -> rgba(16, 185, 129)
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(directory);
console.log('Done replacing colors.');
