// router.js — Advanced SPA Router for UniPrep
(function () {
    // Avoid double initialization
    if (window._routerInitialized) return;
    window._routerInitialized = true;

    const pageCache = new Map();

    document.addEventListener("DOMContentLoaded", () => {
        // Dynamically load the dedicated side nav bar script
        let modulePath = "../..";
        const scripts = document.getElementsByTagName("script");
        for (let s of scripts) {
            const src = s.getAttribute("src");
            if (src && src.includes("router.js")) {
                const publicPath = src.replace("js/router.js", "");
                modulePath = publicPath + "module";
                break;
            }
        }

        // Prevent multiple injections and exclude specific pages
        const excludedPages = ['index.html', 'login.html', 'sign_up.html', 'otp.html'];
        const isExcluded = excludedPages.some(page => window.location.pathname.includes(page));

        if (!isExcluded && !document.querySelector('script[src*="side_nav_bar.js"]')) {
            const navScript = document.createElement("script");
            navScript.src = `${modulePath}/side_nav_bar/side_nav_bar.js`;
            document.head.appendChild(navScript);
        }

        // Intercept all link clicks
        document.body.addEventListener("click", e => {
            const link = e.target.closest("a");
            if (!link) return;

            const href = link.getAttribute("href");

            // Ignore external links, mailto, empty links, or explicit target="_blank"
            if (!href || href === "#" || href.startsWith("http") || href.startsWith("mailto:") || link.getAttribute("target") === "_blank") {
                return;
            }

            e.preventDefault();
            navigateTo(href);
        });

        // Hover prefetching for instant navigation
        document.body.addEventListener("mouseover", e => {
            const link = e.target.closest("a");
            if (!link) return;

            const href = link.getAttribute("href");
            if (!href || href === "#" || href.startsWith("http") || href.startsWith("mailto:") || link.getAttribute("target") === "_blank") {
                return;
            }

            try {
                const absoluteUrl = new URL(href, window.location.href).href;
                if (!pageCache.has(absoluteUrl)) {
                    pageCache.set(absoluteUrl, fetch(absoluteUrl).then(r => r.ok ? r.text() : null).catch(() => null));
                }
            } catch (err) { }
        });

        // Handle back/forward buttons
        window.addEventListener("popstate", () => {
            navigateTo(location.pathname + location.search + location.hash, true);
        });
    });

    async function navigateTo(url, isPopState = false) {
        try {
            showLoader();

            // Simple and forceful algorithm: If running directly from file://, bypass fetch and navigate forcefully.
            if (window.location.protocol === "file:") {
                window.location.assign(url);
                return;
            }

            // Resolve the absolute URL of the target page
            const targetUrl = new URL(url, window.location.href).href;

            let html;
            if (pageCache.has(targetUrl)) {
                html = await pageCache.get(targetUrl);
            } else {
                const fetchPromise = fetch(url).then(r => r.ok ? r.text() : null).catch(() => null);
                pageCache.set(targetUrl, fetchPromise);
                html = await fetchPromise;
            }

            if (!html) {
                throw new Error(`Page not found or failed to fetch`);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Fix all relative URLs in the parsed document before injecting
            const fixUrl = (el, attr) => {
                const val = el.getAttribute(attr);
                if (val && !val.startsWith("http") && !val.startsWith("data:") && !val.startsWith("#") && !val.startsWith("mailto:")) {
                    el.setAttribute(attr, new URL(val, targetUrl).href);
                }
            };

            doc.querySelectorAll("link[href]").forEach(el => fixUrl(el, "href"));
            doc.querySelectorAll("script[src]").forEach(el => fixUrl(el, "src"));
            doc.querySelectorAll("img[src]").forEach(el => fixUrl(el, "src"));
            doc.querySelectorAll("a[href]").forEach(el => fixUrl(el, "href"));

            // 5. Update History First
            if (!isPopState) {
                window.history.pushState(null, "", url);
            }

            // 1. Update Title
            if (doc.title) {
                document.title = doc.title;
            }

            // 2. Merge Styles and WAIT for CSS to load (prevents white screen flash)
            await mergeStyles(doc.head);

            // Trigger global page cleanup before replacing the body
            if (typeof window._pageCleanup === 'function') {
                try { window._pageCleanup(); } 
                catch (e) { console.error("SPA Cleanup Error:", e); }
                window._pageCleanup = null;
            }

            // 3. Replace Body Content
            document.body.innerHTML = doc.body.innerHTML;
            document.body.className = doc.body.className;
            
            // Re-render Side Nav since we wiped the body
            if (typeof window.renderSideNav === 'function') {
                window.renderSideNav();
            }

            // 4. Re-execute Scripts carefully to maintain logic but avoid duplications
            await executeScripts(doc.body);

            // 6. Scroll to top
            window.scrollTo(0, 0);

            // Close mobile sidebar if open
            if (typeof closeSidebar === 'function') {
                closeSidebar();
            }

        } catch (error) {
            console.error("SPA Navigation Error:", error);
            window.location.assign(url);
        } finally {
            hideLoader();
        }
    }

    async function mergeStyles(newHead) {
        // Find existing styles to avoid duplicates
        const currentLinks = Array.from(document.head.querySelectorAll("link[rel='stylesheet']")).map(l => l.href);
        const newLinks = Array.from(newHead.querySelectorAll("link[rel='stylesheet']"));

        const promises = [];

        newLinks.forEach(link => {
            if (link.href && !currentLinks.includes(link.href)) {
                const newLink = document.createElement("link");
                newLink.rel = "stylesheet";
                newLink.href = link.href;

                // Wait for the stylesheet to load before resolving
                promises.push(new Promise(resolve => {
                    newLink.onload = resolve;
                    newLink.onerror = resolve; // resolve on error to avoid getting stuck
                }));

                document.head.appendChild(newLink);
            }
        });

        // Merge inline styles
        const currentStyles = Array.from(document.head.querySelectorAll("style")).map(s => s.innerHTML);
        const newStyles = Array.from(newHead.querySelectorAll("style"));

        newStyles.forEach(style => {
            if (!currentStyles.includes(style.innerHTML)) {
                const newStyle = document.createElement("style");
                newStyle.innerHTML = style.innerHTML;
                document.head.appendChild(newStyle);
            }
        });

        // Block navigation until all new CSS files have loaded
        await Promise.all(promises);
    }

    async function executeScripts(newBody) {
        // Collect all scripts from the fetched body
        const scripts = Array.from(newBody.querySelectorAll("script"));

        for (const script of scripts) {
            // Avoid reloading the router itself
            if (script.src && script.src.includes("router.js")) continue;

            await new Promise(resolve => {
                const newScript = document.createElement("script");
                Array.from(script.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.innerHTML = script.innerHTML;
                
                if (script.src) {
                    newScript.onload = resolve;
                    newScript.onerror = resolve;
                }
                
                document.body.appendChild(newScript);
                
                if (!script.src) {
                    resolve();
                }
            });
        }
    }

    function showLoader() {
        if (!document.getElementById("spa-loader")) {
            const loader = document.createElement("div");
            loader.id = "spa-loader";

            // Full-screen overlay styling
            loader.style.position = "fixed";
            loader.style.inset = "0";
            loader.style.backgroundColor = "#060d1f";
            loader.style.backdropFilter = "blur(12px)";
            loader.style.WebkitBackdropFilter = "blur(12px)";
            loader.style.zIndex = "999999";
            loader.style.display = "flex";
            loader.style.flexDirection = "column";
            loader.style.alignItems = "center";
            loader.style.justifyContent = "center";
            loader.style.opacity = "0";
            loader.style.transition = "opacity 0.15s ease";

            // Inject beautiful circular spinner and text
            loader.innerHTML = `
                <style>
                    @keyframes spa-spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes spa-glow-pulse {
                        0%, 100% { box-shadow: 0 0 15px rgba(6, 182, 212, 0.4), inset 0 0 10px rgba(37, 99, 235, 0.4); }
                        50% { box-shadow: 0 0 30px rgba(6, 182, 212, 0.8), inset 0 0 20px rgba(37, 99, 235, 0.8); }
                    }
                    .spa-spinner {
                        width: 70px;
                        height: 70px;
                        border: 4px solid rgba(255, 255, 255, 0.1);
                        border-top-color: #06b6d4; /* accent cyan */
                        border-right-color: #3b82f6; /* blue */
                        border-radius: 50%;
                        animation: spa-spin 1s linear infinite, spa-glow-pulse 2s ease-in-out infinite;
                        margin-bottom: 24px;
                        position: relative;
                    }
                    .spa-spinner::after {
                        content: '';
                        position: absolute;
                        top: -4px; left: -4px; right: -4px; bottom: -4px;
                        border-radius: 50%;
                        border: 4px solid transparent;
                        border-bottom-color: rgba(6, 182, 212, 0.5);
                        animation: spa-spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite reverse;
                    }
                    .spa-loading-text {
                        font-family: 'Outfit', sans-serif;
                        font-size: 15px;
                        font-weight: 700;
                        letter-spacing: 4px;
                        text-transform: uppercase;
                        background: linear-gradient(135deg, #fff, #93c5fd);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        animation: spa-pulse-text 1.5s ease-in-out infinite;
                    }
                    @keyframes spa-pulse-text {
                        0%, 100% { opacity: 0.6; transform: translateY(0); }
                        50% { opacity: 1; transform: translateY(-3px); }
                    }
                </style>
                <div class="spa-spinner"></div>
                <div class="spa-loading-text">Loading</div>
            `;

            document.documentElement.appendChild(loader);

            // Trigger fade in
            requestAnimationFrame(() => {
                loader.style.opacity = "1";
            });
        }
    }

    function hideLoader() {
        const loader = document.getElementById("spa-loader");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => {
                if (loader.parentNode) loader.remove();
            }, 150);
        }
    }

    function showErrorToast(msg) {
        // Simple elegant error toast
        let toast = document.getElementById("spa-error-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "spa-error-toast";
            toast.style.position = "fixed";
            toast.style.bottom = "20px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
            toast.style.color = "#fff";
            toast.style.padding = "12px 24px";
            toast.style.borderRadius = "8px";
            toast.style.fontFamily = "'Inter', sans-serif";
            toast.style.fontSize = "14px";
            toast.style.fontWeight = "500";
            toast.style.zIndex = "100000";
            toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
            toast.style.backdropFilter = "blur(4px)";
            toast.style.transition = "opacity 0.3s ease";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        toast.style.display = "block";

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.style.display = "none";
            }, 300);
        }, 3000);
    }
})();
