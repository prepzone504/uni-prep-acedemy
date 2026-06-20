const fs = require('fs');

const filesToClean = [
    'c:/myproject/uniprep/public/module/index.html',
    'c:/myproject/uniprep/public/module/auth/login.html',
    'c:/myproject/uniprep/public/module/auth/sign_up.html',
    'c:/myproject/uniprep/public/module/auth/otp.html'
];

for (const file of filesToClean) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Remove the script tag
        content = content.replace(/<script[^>]*src=[\"'].*side_nav_bar\.js[\"'][^>]*><\/script>/g, '');
        fs.writeFileSync(file, content);
        console.log('Cleaned ' + file);
    }
}
