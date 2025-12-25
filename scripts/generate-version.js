import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    // Get latest commit info
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%cd --date=format:%Y-%m-%d').toString().trim();
    const time = execSync('git log -1 --format=%cd --date=format:%H:%M').toString().trim();

    const versionInfo = {
        hash,
        date,
        time,
        fullDate: `${date} ${time}`,
        displayShort: hash,
        displayFull: `${hash} • ${date}`,
        displayWithTime: `${hash} • ${date} ${time}`
    };

    // Write to version.json in project root
    const versionJsonPath = path.join(__dirname, '../version.json');
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2));

    // Update sw.js with version comment to trigger browser update
    const swPath = path.join(__dirname, '../sw.js');
    let swContent = fs.readFileSync(swPath, 'utf8');
    const versionComment = `// Version: ${versionInfo.displayWithTime}`;

    // Replace first line or prepend if not present
    const lines = swContent.split('\n');
    if (lines[0].startsWith('// Version:')) {
        lines[0] = versionComment;
    } else {
        lines.unshift(versionComment);
    }
    swContent = lines.join('\n');
    fs.writeFileSync(swPath, swContent);

    console.log(`✓ Version generated: ${versionInfo.displayFull}`);
    console.log(`✓ Service Worker updated with version comment`);
} catch (error) {
    // Fallback if not in a git repo (e.g., deployed without .git)
    const fallbackVersion = {
        hash: 'unknown',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        displayShort: 'dev',
        displayFull: 'dev build',
        displayWithTime: 'dev build'
    };

    const outputPath = path.join(__dirname, '../version.json');
    fs.writeFileSync(outputPath, JSON.stringify(fallbackVersion, null, 2));

    console.log('⚠ Not a git repo, using fallback version');
}
