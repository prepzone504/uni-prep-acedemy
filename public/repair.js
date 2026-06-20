const fs = require('fs');
const path = require('path');

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('<head>\\n')) {
                // We use global replace or just replace the first instance since we only injected it once
                content = content.replace('<head>\\n', '<head>\n');
                fs.writeFileSync(fullPath, content);
                console.log('Fixed literal backslash-n in ' + fullPath);
            }
        }
    }
}
walk('c:\\\\myproject\\\\uniprep\\\\public');
