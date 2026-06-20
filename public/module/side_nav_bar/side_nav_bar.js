// side_nav_bar.js - Single Source of Truth for UniPrep Side Navigation
// This file generates the sidebar, overlay, all styles, and toggle logic.
// No other file should define sidebar HTML, CSS, or toggleSidebar().
(function () {

    // ── INJECT STYLES (ID selectors = highest specificity, always wins) ──────
    function injectStyles() {
        if (document.getElementById('snb-styles')) return;
        const style = document.createElement('style');
        style.id = 'snb-styles';
        style.textContent = `
            /* Reset any conflicting sidebar styles from page CSS */
            #sidebar {
                position: fixed !important;
                top: 0 !important;
                left: -280px !important;
                bottom: 0 !important;
                width: 280px !important;
                z-index: 10000 !important;
                background: #081030 !important;
                border-right: 1px solid rgba(96,165,250,0.15) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                visibility: hidden !important;
                opacity: 0 !important;
                transform: none !important;
                transition: left 0.35s cubic-bezier(0.4,0,0.2,1),
                            opacity 0.25s ease,
                            visibility 0s linear 0.35s !important;
            }
            #sidebar.open {
                left: 0 !important;
                visibility: visible !important;
                opacity: 1 !important;
                transform: none !important;
                box-shadow: 8px 0 60px rgba(0,0,0,0.7) !important;
                transition: left 0.35s cubic-bezier(0.34,1.2,0.64,1),
                            opacity 0.25s ease,
                            visibility 0s linear 0s !important;
            }
            #sidebar-overlay {
                position: fixed !important;
                inset: 0 !important;
                background: rgba(0,0,0,0.6) !important;
                z-index: 9999 !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: opacity 0.3s ease, visibility 0s linear 0.3s !important;
            }
            #sidebar-overlay.open {
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                transition: opacity 0.3s ease, visibility 0s linear 0s !important;
            }

            /* ── Inner sidebar layout ── */
            .snb-header {
                height: 88px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 24px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                flex-shrink: 0;
            }
            .snb-brand {
                display: flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
            }
            .snb-brand-icon {
                width: 36px; height: 36px;
                border-radius: 10px;
                background: linear-gradient(135deg, #2563eb, #06b6d4);
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
                box-shadow: 0 0 16px rgba(37,99,235,0.6);
            }
            .snb-brand-name {
                font-family: 'Outfit', sans-serif;
                font-size: 22px; font-weight: 900;
                background: linear-gradient(135deg, #fff, #93c5fd);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .snb-close-btn {
                background: none; border: none;
                color: rgba(191,219,254,0.7);
                cursor: pointer; padding: 6px;
                border-radius: 8px;
                transition: background 0.2s;
                display: flex; align-items: center; justify-content: center;
            }
            .snb-close-btn:hover { background: rgba(255,255,255,0.07); }
            .snb-close-btn svg { width: 20px; height: 20px; }

            .snb-nav {
                flex: 1;
                padding: 24px 16px;
                overflow-y: auto;
                display: flex; flex-direction: column; gap: 4px;
            }
            .snb-item {
                display: flex; align-items: center; gap: 14px;
                padding: 13px 16px; border-radius: 14px;
                color: rgba(191,219,254,0.7);
                text-decoration: none;
                font-size: 14.5px; font-weight: 500;
                transition: all 0.2s;
                border: 1px solid transparent;
            }
            .snb-item:hover {
                color: #fff;
                background: rgba(255,255,255,0.05);
            }
            .snb-item.active {
                color: #fff;
                background: rgba(37,99,235,0.18);
                border-color: rgba(96,165,250,0.3);
                font-weight: 600;
            }
            .snb-icon {
                width: 20px; height: 20px;
                flex-shrink: 0;
                transition: transform 0.2s;
            }
            .snb-item:hover .snb-icon { transform: scale(1.1); }
            .snb-item.active .snb-icon { color: #60a5fa; }
            .snb-badge {
                margin-left: auto;
                font-size: 10.5px; font-weight: 700;
                background: rgba(37,99,235,0.25);
                color: #93c5fd;
                padding: 3px 8px; border-radius: 999px;
            }
            .snb-submenu {
                display: none;
                flex-direction: column;
                padding-left: 34px;
                gap: 2px;
                margin-top: 2px;
                margin-bottom: 4px;
            }
            .snb-submenu.open {
                display: flex;
            }
            .snb-subitem {
                display: flex; align-items: center; gap: 10px;
                padding: 10px 16px; border-radius: 12px;
                color: rgba(191,219,254,0.6);
                text-decoration: none;
                font-size: 13.5px; font-weight: 400;
                transition: all 0.2s;
            }
            .snb-subitem:hover {
                color: #fff;
                background: rgba(255,255,255,0.05);
            }
            .snb-subitem.active {
                color: #60a5fa;
                font-weight: 500;
            }
            .snb-chevron {
                margin-left: auto;
                width: 16px; height: 16px;
                transition: transform 0.2s;
            }
            .snb-item.expanded .snb-chevron {
                transform: rotate(180deg);
            }
            .snb-footer {
                padding: 20px 16px;
                border-top: 1px solid rgba(255,255,255,0.06);
                flex-shrink: 0;
            }
            .snb-user-card {
                display: flex; align-items: center; gap: 12px;
                margin-top: 12px; padding: 12px 14px;
                border-radius: 14px;
                background: rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.04);
                cursor: pointer;
                transition: background 0.2s;
            }
            .snb-user-card:hover { background: rgba(255,255,255,0.05); }
            .snb-avatar {
                width: 36px; height: 36px;
                border-radius: 10px;
                background: linear-gradient(135deg, #2563eb, #06b6d4);
                display: flex; align-items: center; justify-content: center;
                font-weight: 700; font-size: 13px; color: #fff;
                flex-shrink: 0;
            }
            .snb-u-name {
                font-size: 14px; font-weight: 600; color: #fff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .snb-u-role { font-size: 11.5px; color: #06b6d4; margin-top: 2px; }

            .snb-gold-item {
                background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.2)) !important;
                border: 1px solid rgba(251,191,36,0.3) !important;
                color: #fbbf24 !important;
            }
            .snb-gold-item:hover {
                background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.3)) !important;
                border-color: rgba(251,191,36,0.5) !important;
                color: #fcd34d !important;
                box-shadow: 0 4px 20px rgba(245,158,11,0.2) !important;
            }
            .snb-gold-item.active {
                background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.25)) !important;
                border-color: rgba(251,191,36,0.6) !important;
            }
            .snb-gold-item .snb-icon {
                color: #fbbf24 !important;
            }

            /* Desktop: sidebar always visible */
            @media (min-width: 1024px) {
                #sidebar {
                    left: 0 !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    transform: none !important;
                    box-shadow: none !important;
                    transition: none !important;
                }
                #sidebar-overlay {
                    display: none !important;
                }
                .snb-close-btn { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    // ── PATH RESOLUTION ─────────────────────────────────────────────────────
    function getModulePath() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src');
            if (src && src.indexOf('side_nav_bar.js') !== -1) {
                // Convert relative src to absolute URL
                var a = document.createElement('a');
                a.href = src;
                var absUrl = a.href; // browser resolves to absolute
                // Remove "side_nav_bar/side_nav_bar.js" from the end
                var idx = absUrl.indexOf('side_nav_bar/side_nav_bar.js');
                if (idx !== -1) {
                    var moduleRoot = absUrl.substring(0, idx);
                    // Remove trailing slash
                    if (moduleRoot.charAt(moduleRoot.length - 1) === '/') {
                        moduleRoot = moduleRoot.substring(0, moduleRoot.length - 1);
                    }
                    return moduleRoot;
                }
            }
        }
        // Fallback: compute from current URL
        var loc = window.location;
        var parts = loc.pathname.split('/');
        var moduleIdx = -1;
        for (var j = 0; j < parts.length; j++) {
            if (parts[j] === 'module') { moduleIdx = j; break; }
        }
        if (moduleIdx !== -1) {
            return loc.origin + parts.slice(0, moduleIdx + 1).join('/');
        }
        return loc.origin + '/public/module';
    }

    // ── TOGGLE LOGIC ────────────────────────────────────────────────────────
    function openSidebar() {
        var s = document.getElementById('sidebar');
        var o = document.getElementById('sidebar-overlay');
        if (s) s.classList.add('open');
        if (o) o.classList.add('open');
    }

    function closeSidebar() {
        var s = document.getElementById('sidebar');
        var o = document.getElementById('sidebar-overlay');
        if (s) s.classList.remove('open');
        if (o) o.classList.remove('open');
    }

    function toggleSidebar() {
        var s = document.getElementById('sidebar');
        if (s && s.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    function toggleSubmenu(id) {
        var el = document.getElementById(id);
        var btn = el.previousElementSibling;
        if(el.classList.contains('open')) {
            el.classList.remove('open');
            if(btn) btn.classList.remove('expanded');
        } else {
            el.classList.add('open');
            if(btn) btn.classList.add('expanded');
        }
    }

    // Expose globally so onclick="toggleSidebar()" works everywhere
    window.toggleSidebar = toggleSidebar;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.toggleSubmenu = toggleSubmenu;

    // ── BUILD SIDEBAR HTML ──────────────────────────────────────────────────
    function generateSideNav() {
        injectStyles();

        // Create overlay
        var overlay = document.getElementById('sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            overlay.onclick = closeSidebar;
            document.body.insertBefore(overlay, document.body.firstChild);
        }

        // Create sidebar
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            sidebar = document.createElement('aside');
            sidebar.id = 'sidebar';
            document.body.insertBefore(sidebar, document.body.firstChild);
        }
        // Clear ALL classes except 'open' state to avoid page CSS conflicts
        var wasOpen = sidebar.classList.contains('open');
        sidebar.className = wasOpen ? 'open' : '';

        var base = getModulePath();
        var path = window.location.pathname;

        function isActive(keyword) {
            return path.indexOf(keyword) !== -1 ? 'active' : '';
        }

        var examActiveStr = (isActive('exam_prep') || isActive('exam_trival') || isActive('exam_discussion') || isActive('exam_flashcard')) ? 'active ' : '';
        var examExpanded = examActiveStr ? 'expanded' : '';
        var examSubmenuOpen = examActiveStr ? 'open' : '';

        var tutorialActiveStr = (isActive('tutorial_exam') || isActive('tutor_dashboard')) ? 'active ' : '';
        var tutorialExpanded = tutorialActiveStr ? 'expanded' : '';
        var tutorialSubmenuOpen = tutorialActiveStr ? 'open' : '';

        sidebar.innerHTML =
            '<div class="snb-header">' +
            '<a href="' + base + '/index.html" class="snb-brand">' +
            '<div class="snb-brand-icon">\uD83C\uDF93</div>' +
            '<span class="snb-brand-name">UniPrep</span>' +
            '</a>' +
            '<button class="snb-close-btn" onclick="closeSidebar()" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
            '</button>' +
            '</div>' +
            '<nav class="snb-nav">' +
            '<a href="' + base + '/dashboard/dashboard.html" class="snb-item ' + isActive('dashboard') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
            'Home' +
            '</a>' +
            '<div class="snb-item ' + examActiveStr + examExpanded + '" onclick="toggleSubmenu(\'exams-submenu\')" style="cursor: pointer;">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' +
            'Exams' +
            '<svg class="snb-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
            '</div>' +
            '<div id="exams-submenu" class="snb-submenu ' + examSubmenuOpen + '">' +
            '<a href="' + base + '/exam_prep/exam_list/exam_list.html" class="snb-subitem ' + isActive('exam_prep') + '">Exam Prep <span class="snb-badge">100L</span></a>' +
            '<a href="' + base + '/exam_discussion/exam_discussion.html" class="snb-subitem ' + isActive('exam_discussion') + '">Exam Discussion</a>' +
            '<a href="' + base + '/exam_trival/exam_trival.html" class="snb-subitem ' + isActive('exam_trival') + '">Exam Trivia</a>' +
            '<a href="' + base + '/exam_flashcard/list_of_flashcard.html" class="snb-subitem ' + isActive('exam_flashcard') + '">Exam Flashcard</a>' +
            '</div>' +

            '<a href="' + base + '/leaderboard/leaderboard.html" class="snb-item ' + isActive('leaderboard') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 20 12 10 16 14 22 8"/><polyline points="15 8 22 8 22 15"/></svg>' +
            'Leaderboard' +
            '</a>' +
            '<a href="' + base + '/blog/blog.html" class="snb-item ' + isActive('blog') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
            'Blog' +
            '</a>' +
            '<a href="' + base + '/history/history.html" class="snb-item ' + isActive('history') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            'History' +
            '</a>' +
            '<a href="' + base + '/admin_dashboard/admin_dashboard.html" class="snb-item snb-gold-item ' + isActive('admin_dashboard') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' +
            'Admin Panel' +
            '</a>' +
            '</nav>' +
            '<div class="snb-footer">' +
            '<a href="' + base + '/settings/settings.html" class="snb-item ' + isActive('settings') + '">' +
            '<svg class="snb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
            'Settings' +
            '</a>' +
            '<div class="snb-user-card">' +
            '<div class="snb-avatar">AO</div>' +
            '<div>' +
            '<div class="snb-u-name">Adaeze Okonkwo</div>' +
            '<div class="snb-u-role">Premium Plan</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    window.renderSideNav = generateSideNav;

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', generateSideNav);
    } else {
        generateSideNav();
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });

})();
