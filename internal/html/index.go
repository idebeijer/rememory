package html

import (
	"strings"

	"github.com/eljojo/rememory/internal/translations"
)

// GenerateIndexHTML creates the landing page HTML with embedded CSS.
func GenerateIndexHTML(selfhosted bool) string {
	content := aboutHTMLTemplate

	// Embed language picker options
	content = strings.Replace(content, "{{LANG_OPTIONS}}", translations.LangSelectOptions(), 1)

	result := applyLayout(LayoutOptions{
		Title:      "ReMemory - Protect your files with people you trust",
		BodyClass:  "landing",
		Selfhosted: selfhosted,
		HeadMeta: `<meta name="generator" content="ReMemory {{VERSION}}">
  <meta name="description" content="Protect your files by splitting a key among people you trust. No accounts, no servers. Recovery works offline, forever.">
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="ReMemory - Protect your files with people you trust">
  <meta property="og:description" content="Protect your files by splitting a key among people you trust. No accounts, no servers. Recovery works offline, forever.">
  <meta property="og:image" content="{{GITHUB_PAGES}}/screenshots/recovery-1.png">
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="ReMemory - Protect your files with people you trust">
  <meta name="twitter:description" content="Protect your files by splitting a key among people you trust. No accounts, no servers. Recovery works offline, forever.">
  <meta name="twitter:image" content="{{GITHUB_PAGES}}/screenshots/recovery-1.png">`,
		PageStyles: indexCSS,
		Content:    content,
		FooterContent: `<p style="font-size: 0.8125rem; color: #8A8480;" data-i18n-html="footer_timelock">* <a href="docs.html#timelock" style="color: #8A8480;">Time-locked</a> archives need a brief internet connection at recovery time.</p>
    <p>
      <a href="{{GITHUB_REPO}}" target="_blank" data-i18n="footer_source">Source Code</a> &#xB7;
      <a href="{{GITHUB_URL}}" target="_blank" data-i18n="footer_download">Download</a> &#xB7;
      <a href="docs.html" data-i18n="footer_docs">Documentation</a>
    </p>
    <p class="version"><a href="{{GITHUB_REPO}}/blob/main/CHANGELOG.md" target="_blank" style="color: var(--text-muted); text-decoration: none;">{{VERSION}}</a></p>`,
		Scripts: `<script>document.querySelector('#nav-links-main a[href="about.html"]')?.remove();</script>

  <script>` + dataflowJS + `</script>

  <!-- Translations -->
  <script>
    const translations = ` + translations.GetTranslationsJS("index") + `;
    const docsLangs = ` + DocsLanguagesJS() + `;

    let currentLang = 'en';

    function t(key) {
      return (translations[currentLang] && translations[currentLang][key])
        || (translations['en'] && translations['en'][key])
        || key;
    }

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem('rememory-lang', lang);

      // Update select
      var sel = document.getElementById('lang-select');
      if (sel) sel.value = lang;

      // Update text-only elements
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        el.textContent = t(key);
      });

      // Update elements with inline HTML
      document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
      });

      // Update docs links to point to the correct language variant
      // Only rewrite if a translated guide exists for this language
      var docsFile = (lang !== 'en' && docsLangs.indexOf(lang) !== -1)
        ? 'docs.' + lang + '.html' : 'docs.html';
      document.querySelectorAll('a[href^="docs."]').forEach(function(a) {
        var h = a.getAttribute('href');
        a.setAttribute('href', h.replace(/docs(?:\.[a-z]{2})?\.html/, docsFile));
      });

      // Update dataflow animation labels
      if (window.setDataflowLabels) {
        window.setDataflowLabels({
          yourFile: t('anim_your_file'),
          encrypt: t('anim_encrypt'),
          split: t('anim_split'),
          combine: t('anim_combine'),
          recovered: t('anim_recovered'),
          later: t('anim_later')
        });
      }
    }

    // Set initial language
    (function() {
      var saved = localStorage.getItem('rememory-lang');
      var langs = ` + translations.LangDetectJS() + `;
      var detected = navigator.languages.find(function(l) { return langs.indexOf(l) !== -1; })
        || navigator.languages.map(function(l) { return l.split('-')[0]; }).find(function(l) { return langs.indexOf(l) !== -1; });
      currentLang = saved || detected || 'en';
    })();

    document.addEventListener('DOMContentLoaded', function() {
      setLanguage(currentLang);

      document.getElementById('lang-select').addEventListener('change', function(e) {
        setLanguage(e.target.value);
      });
    });
  </script>`,
	})

	return result
}
