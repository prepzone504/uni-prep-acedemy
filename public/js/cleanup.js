const fs = require('fs');
const path = require('path');

function processDir(dir, depth) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath, depth + 1);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Remove sidebar block entirely
            const sidebarRegex = /<!-- SIDEBAR.*?-->\s*<aside[^>]*id=[\"']sidebar[\"'][^>]*>[\s\S]*?<\/aside>/gi;
            const sidebarRegexAlt = /<aside[^>]*id=[\"']sidebar[\"'][^>]*>[\s\S]*?<\/aside>/gi;
            
            if (sidebarRegex.test(content)) {
                content = content.replace(sidebarRegex, '');
                modified = true;
            } else if (sidebarRegexAlt.test(content)) {
                content = content.replace(sidebarRegexAlt, '');
                modified = true;
            }

            // Remove mobile overlay
            const overlayRegex = /<!-- Mobile Overlay -->\s*<div class="sidebar-overlay".*?><\/div>/gi;
            const overlayRegexAlt = /<div class="sidebar-overlay".*?><\/div>/gi;
            if (overlayRegex.test(content)) {
                content = content.replace(overlayRegex, '');
                modified = true;
            } else if (overlayRegexAlt.test(content)) {
                content = content.replace(overlayRegexAlt, '');
                modified = true;
            }

            // Inject script into <head> if not present
            if (!content.includes('side_nav_bar.js')) {
                let relativePrefix = '../'.repeat(depth);
                if (depth === 0) relativePrefix = './'; 
                const scriptTag = `<script src="${relativePrefix}side_nav_bar/side_nav_bar.js"></script>`;
                content = content.replace('</head>', `  ${scriptTag}\n</head>`);
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Processed:', fullPath);
            }
        }
    }
}

processDir('c:/myproject/uniprep/public/module', 1);
