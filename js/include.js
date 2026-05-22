/* ============================================================
   include.js — 加载共享 nav/footer + 用 content/{lang}/*.json 填充页面
   团队提示：这个文件一般不需要改。
   ============================================================ */
(function () {
  'use strict';

  var path = location.pathname;
  var m = path.match(/\/(zh|en)\//);
  var lang = m ? m[1] : 'en';
  var otherLang = lang === 'zh' ? 'en' : 'zh';
  var page = path.split('/').pop();
  if (!page) page = 'index.html';
  var pageKey = page.replace(/\.html$/, '') || 'index';

  // ---------- mini-markdown: **x** → <em>x</em>, \n → <br> ----------
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderHTML(text) {
    if (text == null) return '';
    return escapeHTML(text)
      .replace(/\*\*([\s\S]+?)\*\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
  function setText(el, val, asHTML) {
    if (val == null) return;
    if (asHTML || el.hasAttribute('data-html')) el.innerHTML = renderHTML(val);
    else el.textContent = val;
  }
  function getPath(obj, p) {
    if (!obj || !p) return undefined;
    return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, obj);
  }
  function loadJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  // ---------- partial loader ----------
  function loadPartial(host) {
    var kind = host.getAttribute('data-include'); // "nav" | "footer"
    return fetch('../partials/' + kind + '-' + lang + '.html', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var parent = host.parentNode;
        while (tmp.firstChild) parent.insertBefore(tmp.firstChild, host);
        parent.removeChild(host);
      })
      .catch(function (err) { console.error('partial failed:', kind, err); });
  }

  // ---------- list rendering ----------
  function renderList(container, arr, settings) {
    var tmpl = container.querySelector(':scope > template');
    if (!tmpl || !Array.isArray(arr)) return;
    // remove previously rendered nodes (anything that isn't the template)
    Array.from(container.childNodes).forEach(function (n) {
      if (n !== tmpl) container.removeChild(n);
    });
    arr.forEach(function (item) {
      var first = tmpl.content.firstElementChild;
      if (!first) return;
      var node = first.cloneNode(true);
      applyItem(node, item, settings);
      container.insertBefore(node, tmpl);
    });
  }

  function applyItem(node, item, settings) {
    var isString = typeof item === 'string';
    // data-field on descendants
    node.querySelectorAll('[data-field]').forEach(function (el) {
      var f = el.getAttribute('data-field');
      var v = isString ? null : item[f];
      if (v != null) setText(el, v);
    });
    // data-field on root
    if (node.hasAttribute && node.hasAttribute('data-field') && !isString) {
      var f = node.getAttribute('data-field');
      var v = item[f];
      if (v != null) setText(node, v);
    }
    // data-field-self: 整项作为值（item 是字符串，或者是 {text: ...} 单字段对象）
    function applySelf(el) {
      var v = null;
      if (typeof item === 'string') v = item;
      else if (item && typeof item.text === 'string') v = item.text;
      if (v != null) setText(el, v);
    }
    node.querySelectorAll('[data-field-self]').forEach(applySelf);
    if (node.hasAttribute && node.hasAttribute('data-field-self')) applySelf(node);
    // data-field-src (img src from prefix + field)
    node.querySelectorAll('[data-field-src]').forEach(function (el) {
      var f = el.getAttribute('data-field-src');
      var prefix = el.getAttribute('data-src-prefix') || '';
      var v = isString ? null : item[f];
      if (v) el.setAttribute('src', prefix + v);
    });
    // data-channel-email (channel.email_key → settings.emails[key])
    node.querySelectorAll('[data-channel-email]').forEach(function (el) {
      if (isString) return;
      var key = item.email_key;
      if (!key) return;
      var email = getPath(settings, 'emails.' + key);
      if (email) {
        el.setAttribute('href', 'mailto:' + email);
        el.textContent = email + ' →';
      }
    });
  }

  // ---------- content application ----------
  function applyContent(root, content, settings) {
    // <title data-key=...>
    if (document.title && document.querySelector('title[data-key]')) {
      var titleEl = document.querySelector('title[data-key]');
      var v = getPath(content, titleEl.getAttribute('data-key'));
      if (v) document.title = v;
    }
    // data-key (from page content)
    root.querySelectorAll('[data-key]').forEach(function (el) {
      if (el.tagName === 'TITLE') return;
      var v = getPath(content, el.getAttribute('data-key'));
      if (v != null) setText(el, v);
    });
    // data-settings-key (from settings)
    root.querySelectorAll('[data-settings-key]').forEach(function (el) {
      var v = getPath(settings, el.getAttribute('data-settings-key'));
      if (v != null) setText(el, v);
    });
    // data-show-if-settings (hide if falsy/empty)
    root.querySelectorAll('[data-show-if-settings]').forEach(function (el) {
      var v = getPath(settings, el.getAttribute('data-show-if-settings'));
      var show = !!v && v !== '0' && v !== 'false';
      el.style.display = show ? '' : 'none';
    });
    // data-placeholder-key
    root.querySelectorAll('[data-placeholder-key]').forEach(function (el) {
      var v = getPath(content, el.getAttribute('data-placeholder-key'));
      if (v != null) el.setAttribute('placeholder', v);
    });
    // data-options-key (select options)
    root.querySelectorAll('[data-options-key]').forEach(function (el) {
      var arr = getPath(content, el.getAttribute('data-options-key'));
      if (Array.isArray(arr)) {
        el.innerHTML = arr.map(function (o) {
          var v = (typeof o === 'string') ? o : (o && o.text) || '';
          return '<option>' + escapeHTML(v) + '</option>';
        }).join('');
      }
    });
    // data-list (from content)
    root.querySelectorAll('[data-list]').forEach(function (c) {
      renderList(c, getPath(content, c.getAttribute('data-list')), settings);
    });
    // data-list-settings (from settings)
    root.querySelectorAll('[data-list-settings]').forEach(function (c) {
      renderList(c, getPath(settings, c.getAttribute('data-list-settings')), settings);
    });
  }

  function postProcess() {
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (href === page) a.classList.add('active');
    });
    var swap = document.querySelector('[data-lang-switch]');
    if (swap) swap.setAttribute('href', '../' + otherLang + '/' + page);
  }

  function bindContactForm(settings) {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var fields = form.elements;
      var name = fields[0] ? fields[0].value.trim() : '';
      var company = fields[1] ? fields[1].value.trim() : '';
      var email = fields[2] ? fields[2].value.trim() : '';
      var type = fields[3] ? fields[3].value : '';
      var message = fields[4] ? fields[4].value.trim() : '';
      var recipient = getPath(settings, 'emails.business') || 'michelleh@amigoglobal.com';
      var subject = '[Amigo Global] ' + (type || 'Website inquiry');
      var body = [
        'Name: ' + name,
        'Company: ' + company,
        'Email: ' + email,
        'Request type: ' + type,
        '',
        message
      ].join('\n');
      location.href = 'mailto:' + encodeURIComponent(recipient) +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }

  // ---------- main ----------
  var hosts = document.querySelectorAll('[data-include]');
  var partialPromise = Promise.all(Array.from(hosts).map(loadPartial));

  Promise.all([
    loadJSON('../content/' + lang + '/settings.json'),
    loadJSON('../content/' + lang + '/' + pageKey + '.json'),
    partialPromise
  ]).then(function (results) {
    var settings = results[0];
    var content = results[1];
    applyContent(document.body, content, settings);
    postProcess();
    bindContactForm(settings);
    document.body.classList.add('ready');
  }).catch(function (err) {
    console.error('content load failed:', err);
    document.body.classList.add('ready');
  });

  // Hot reload: listen for SSE from start.sh (lite-server / live-server style not used here).
  // We poll content files on focus to pick up CMS saves without manual refresh.
  var lastEtags = {};
  function checkForUpdate() {
    if (document.hidden) return;
    ['settings.json', pageKey + '.json'].forEach(function (name) {
      var url = '../content/' + lang + '/' + name;
      fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        var tag = r.headers.get('etag') || r.headers.get('last-modified') || '';
        if (lastEtags[name] && lastEtags[name] !== tag) {
          location.reload();
        }
        lastEtags[name] = tag;
      }).catch(function () {});
    });
  }
  setInterval(checkForUpdate, 2000);
  window.addEventListener('focus', checkForUpdate);
})();
