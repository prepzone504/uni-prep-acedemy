const fs = require('fs');
const path = require('path');

function fixDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixDir(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            if (content.includes('src="../../side_nav_bar/side_nav_bar.js"')) {
                content = content.replace('src="../../side_nav_bar/side_nav_bar.js"', 'src="../side_nav_bar/side_nav_bar.js"');
                modified = true;
            }
            if (content.includes('src="../../../side_nav_bar/side_nav_bar.js"')) {
                content = content.replace('src="../../../side_nav_bar/side_nav_bar.js"', 'src="../../side_nav_bar/side_nav_bar.js"');
                modified = true;
            }
            if (fullPath.replace(/\\/g, '/').endsWith('module/index.html') && content.includes('src="../side_nav_bar/side_nav_bar.js"')) {
                content = content.replace('src="../side_nav_bar/side_nav_bar.js"', 'src="./side_nav_bar/side_nav_bar.js"');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

fixDir('c:/myproject/uniprep/public/module');
