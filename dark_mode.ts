import fs from 'fs';
import path from 'path';

const directory = path.join(process.cwd(), 'src');

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Backgrounds
  content = content.replace(/bg-slate-50/g, 'bg-zinc-950');
  content = content.replace(/bg-white/g, 'bg-zinc-900');
  content = content.replace(/bg-slate-100/g, 'bg-zinc-800');
  content = content.replace(/bg-slate-200/g, 'bg-zinc-800');
  
  // Text
  content = content.replace(/text-slate-900/g, 'text-zinc-50');
  content = content.replace(/text-slate-600/g, 'text-zinc-300');
  content = content.replace(/text-slate-500/g, 'text-zinc-400');
  content = content.replace(/text-slate-400/g, 'text-zinc-500');
  
  // Borders
  content = content.replace(/border-slate-200/g, 'border-zinc-800');
  content = content.replace(/border-slate-100/g, 'border-zinc-800/50');
  
  // Emerald adjustments for dark mode
  content = content.replace(/bg-emerald-50/g, 'bg-emerald-950/30');
  content = content.replace(/bg-emerald-100/g, 'bg-emerald-900/40');
  content = content.replace(/border-emerald-200/g, 'border-emerald-500/30');
  content = content.replace(/text-emerald-600/g, 'text-emerald-400');
  content = content.replace(/text-emerald-700/g, 'text-emerald-300');
  
  // Other color adjustments for dark mode
  content = content.replace(/bg-red-50/g, 'bg-red-950/30');
  content = content.replace(/border-red-200/g, 'border-red-500/30');
  content = content.replace(/text-red-600/g, 'text-red-400');
  
  content = content.replace(/bg-amber-50/g, 'bg-amber-950/30');
  content = content.replace(/border-amber-200/g, 'border-amber-500/30');
  content = content.replace(/text-amber-600/g, 'text-amber-400');
  
  content = content.replace(/bg-purple-50/g, 'bg-purple-950/30');
  content = content.replace(/bg-purple-100/g, 'bg-purple-900/40');
  content = content.replace(/border-purple-200/g, 'border-purple-500/30');
  content = content.replace(/border-purple-100/g, 'border-purple-500/20');
  content = content.replace(/text-purple-600/g, 'text-purple-400');
  content = content.replace(/text-purple-700/g, 'text-purple-300');

  // Specific fixes for index.css
  if (filePath.endsWith('index.css')) {
    content = content.replace(/--color-bg-light: #f8fafc;/g, '--color-bg-light: #09090b;'); // zinc-950
    content = content.replace(/color: #0f172a;/g, 'color: #fafafa;');
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
console.log('Done replacing to dark mode.');
