/*
 * demo.httpcheck —— 接口可用性自查。
 * 能力：net.fetch + storage + ui.toast。
 *
 * 注意这里的网络写法：请求**不**由本页面直接 fetch（宿主 CSP 的 connect-src 'none'
 * 会让它失败），而是走 teamssh.net.fetch，由主程序代发并过域名白名单与出网策略。
 * 所以本插件能访问的地址，就是它清单里 netHosts 声明的那几个，没有例外。
 */
(function () {
  'use strict';

  var root = teamssh.platform.root();
  var HISTORY = 'hist';
  var TARGETS = [
    { label: 'GitHub API 根', url: 'https://api.github.com/' },
    { label: 'TeamSSH 插件索引', url: 'https://raw.githubusercontent.com/jiuri9527/teamssh-plugins/main/index.json' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function card() {
    var html = '<div class="ts-card"><div class="ts-title">接口可用性自查</div>' +
      '<div class="ts-sub">请求由主程序代发，只允许清单声明的域名；响应体最多取回 256KB。</div></div>' +
      '<div class="ts-card">';
    for (var i = 0; i < TARGETS.length; i++) {
      html += '<div class="ts-row"><span>' + esc(TARGETS[i].label) + '</span>' +
        '<button class="ts-btn" data-i="' + i + '">检查</button></div>' +
        '<div class="ts-mono" id="r' + i + '" style="word-break:break-all;color:var(--ts-text3)"></div>';
    }
    html += '</div><div class="ts-card"><div class="ts-title">最近结果</div>' +
      '<div id="hist" class="ts-sub">暂无</div></div>';
    root.innerHTML = html;

    var btns = root.querySelectorAll('[data-i]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].onclick = function (ev) {
        check(Number(ev.target.getAttribute('data-i')));
      };
    }
    paintHistory();
  }

  function paintHistory() {
    teamssh.storage.get(HISTORY).then(function (raw) {
      var list = [];
      try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
      var el = document.getElementById('hist');
      // 响应内容来自外部服务器，一律按文本写入，绝不拼进 innerHTML
      el.textContent = list.length === 0 ? '暂无' : list.slice(-6).reverse().join('\n');
      el.style.whiteSpace = 'pre-wrap';
    });
  }

  function check(i) {
    var t = TARGETS[i];
    var slot = document.getElementById('r' + i);
    slot.textContent = '检查中…';
    teamssh.net.fetch(t.url, { method: 'GET' }).then(function (res) {
      var ok = res.status >= 200 && res.status < 300;
      slot.textContent = (ok ? '正常 ' : '异常 ') + res.status +
        (res.truncated ? '（响应体已截断）' : '') + ' · ' + res.body.length + ' 字节';
      return teamssh.storage.get(HISTORY).then(function (raw) {
        var list = [];
        try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
        list.push(new Date().toLocaleTimeString() + ' ' + t.label + ' → ' + res.status);
        return teamssh.storage.set(HISTORY, JSON.stringify(list.slice(-50)));
      });
    }).then(function () {
      paintHistory();
      teamssh.ui.toast('检查完成');
    }).catch(function (e) {
      slot.textContent = '失败：' + e.message;
    });
  }

  teamssh.info().then(card).catch(function (e) {
    root.innerHTML = '<div class="ts-empty">' + esc(e.message) + '</div>';
  });
})();
