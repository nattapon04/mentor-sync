const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix broken template literals from previous run:
      // `${process.env.NEXT_PUBLIC_API_URL}/auth/login",
      content = content.replace(/`\$\{process\.env\.NEXT_PUBLIC_API_URL\}([^`"]*)",/g, '`${process.env.NEXT_PUBLIC_API_URL}$1`,');
      content = content.replace(/`\$\{process\.env\.NEXT_PUBLIC_API_URL\}([^`"]*)"\)/g, '`${process.env.NEXT_PUBLIC_API_URL}$1`)');
      
      fs.writeFileSync(fullPath, content);
    }
  }
}

replaceInDir('C:/Users/nattapon.nap/Desktop/Repository/my-repo/MentorSync/frontend/src');
