const fs = require('fs');
const path = require('path');

const scriptToInject = `
  <script>
    (function(){
      if(window._initialLoaderAdded)return;window._initialLoaderAdded=true;
      document.documentElement.style.backgroundColor='#060d1f';
      var l=document.createElement('div');
      l.id='global-initial-loader';
      l.style.cssText='position:fixed;inset:0;background:#060d1f;z-index:9999999;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.5s ease;';
      l.innerHTML='<style>@keyframes spa-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes spa-glow-pulse{0%,100%{box-shadow:0 0 15px rgba(6,182,212,0.4),inset 0 0 10px rgba(37,99,235,0.4)}50%{box-shadow:0 0 30px rgba(6,182,212,0.8),inset 0 0 20px rgba(37,99,235,0.8)}}.spa-spinner{width:70px;height:70px;border:4px solid rgba(255,255,255,0.1);border-top-color:#06b6d4;border-right-color:#3b82f6;border-radius:50%;animation:spa-spin 1s linear infinite,spa-glow-pulse 2s ease-in-out infinite;margin-bottom:24px;position:relative}.spa-spinner::after{content:"";position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border-radius:50%;border:4px solid transparent;border-bottom-color:rgba(6,182,212,0.5);animation:spa-spin 1.5s cubic-bezier(0.68,-0.55,0.265,1.55) infinite reverse}.spa-loading-text{font-family:"Outfit",sans-serif;font-size:15px;font-weight:700;letter-spacing:4px;text-transform:uppercase;background:linear-gradient(135deg,#fff,#93c5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:spa-pulse-text 1.5s ease-in-out infinite}@keyframes spa-pulse-text{0%,100%{opacity:0.6;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}</style><div class="spa-spinner"></div><div class="spa-loading-text">Loading</div>';
      document.documentElement.appendChild(l);
      window.addEventListener('load',function(){
        l.style.opacity='0';
        setTimeout(function(){if(l.parentNode)l.remove();},500);
      });
    })();
  </script>
`;

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes('global-initial-loader') && content.includes('<head>')) {
                content = content.replace('<head>', '<head>\\n' + scriptToInject);
                fs.writeFileSync(fullPath, content);
                console.log('Injected into ' + fullPath);
            }
        }
    }
}

walk('c:\\\\myproject\\\\uniprep\\\\public');
