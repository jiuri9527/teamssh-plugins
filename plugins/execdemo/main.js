/*
 * demo.execdemo —— 远程命令能力演示（高危能力的用法样板）。
 * 能力：data.hosts.read + exec.command + ui.toast。
 *
 * 这个插件存在的意义是证明一件事：**exec 的确认权在人手里，不在插件手里**。
 * 每一次 teamssh.exec() 都会弹出确认框，显示"哪台机 + 完整命令"，
 * 且没有"记住这次选择"的通道——插件连一次都代替用户批准不了。
 * 命令只在**已连接**的主机上执行；插件无法借它擅自去连一台没连着的机器。
 */
(function () {
  'use strict';

  var root = teamssh.platform.root();
  // 只读命令。写这个插件的人如果给它换成 rm -rf，用户在确认框里会直接看见。
  var PRESETS = [
    { label: '系统负载', cmd: 'uptime' },
    { label: '内存使用', cmd: 'free -h' },
    { label: '磁盘占用', cmd: 'df -h /' },
    { label: '当前登录', cmd: 'who' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(hosts) {
    var html = '<div class="ts-card"><div class="ts-title">远程命令（每次确认）</div>' +
      '<div class="ts-sub">下面每一条命令在执行前都会要求你单独批准一次，批准不累积。</div></div>';
    if (hosts.length === 0) {
      root.innerHTML = html + '<div class="ts-empty">没有可见主机。</div>';
      return;
    }
    html += '<div class="ts-card"><div class="ts-row"><span>主机</span><select id="h" class="ts-btn">';
    for (var i = 0; i < hosts.length; i++) {
      html += '<option value="' + hosts[i].id + '">' + esc(hosts[i].name) + '</option>';
    }
    html += '</select></div>';
    for (var j = 0; j < PRESETS.length; j++) {
      html += '<div class="ts-row"><span class="ts-mono">' + esc(PRESETS[j].cmd) + '</span>' +
        '<button class="ts-btn" data-c="' + j + '">' + esc(PRESETS[j].label) + '</button></div>';
    }
    html += '<pre id="out" class="ts-mono" style="white-space:pre-wrap;word-break:break-all;margin:8px 0 0;min-height:80px"></pre></div>';
    root.innerHTML = html;

    var btns = root.querySelectorAll('[data-c]');
    for (var k = 0; k < btns.length; k++) {
      btns[k].onclick = function (ev) {
        run(Number(ev.target.getAttribute('data-c')));
      };
    }
  }

  function run(i) {
    var hostId = Number(document.getElementById('h').value);
    var out = document.getElementById('out');
    out.textContent = '等待你的确认…';
    teamssh.exec({ hostId: hostId, command: PRESETS[i].cmd }).then(function (r) {
      out.textContent = '退出码 ' + r.exit + '\n' + r.stdout + (r.stderr ? '\n[stderr]\n' + r.stderr : '');
    }).catch(function (e) {
      // 拒绝是正常路径，不是错误：措辞要区分"你拒绝了"和"执行失败"
      out.textContent = e.code === 'user_denied' ? '你拒绝了这条命令。' : '失败：' + e.message;
    });
  }

  teamssh.data.listHosts().then(render).catch(function (e) {
    root.innerHTML = '<div class="ts-empty">' + esc(e.message) + '</div>';
  });
})();
