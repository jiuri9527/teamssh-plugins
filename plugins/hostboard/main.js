/*
 * demo.hostboard —— 主机指标看板。
 * 能力：data.hosts.read + monitor.read + ui.toast。
 * 只读已入库的 5 分钟聚合点，不触发新的采集，因此插件本身不会给服务器加负载。
 */
(function () {
  'use strict';

  var root = teamssh.platform.root();

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function bar(pct) {
    var w = Math.max(0, Math.min(100, pct));
    return '<div style="background:var(--ts-fill);border-radius:999px;height:6px;overflow:hidden">' +
      '<div style="width:' + w + '%;height:100%;background:var(--ts-accent)"></div></div>';
  }

  function point(p) {
    return '<div class="ts-kv"><b>' + esc(p) + '</b><span></span></div>';
  }

  function show(hosts, chosen) {
    var html = '<div class="ts-card"><div class="ts-title">主机指标看板</div>' +
      '<div class="ts-sub">数据取自主程序已采集的 5 分钟聚合，插件不额外探测服务器。</div></div>';
    if (hosts.length === 0) {
      root.innerHTML = html + '<div class="ts-empty">没有可见主机。需要主机列表权限的插件才会看到主机。</div>';
      return;
    }
    html += '<div class="ts-card"><div class="ts-row"><span>选择主机</span>' +
      '<select id="hs" class="ts-btn">';
    for (var i = 0; i < hosts.length; i++) {
      html += '<option value="' + hosts[i].id + '"' +
        (chosen === hosts[i].id ? ' selected' : '') + '>' + esc(hosts[i].name) + '</option>';
    }
    html += '</select></div></div>';
    root.innerHTML = html;
    var sel = document.getElementById('hs');
    sel.onchange = function () { load(Number(sel.value)); };
    load(chosen === 0 ? Number(sel.value) : chosen);
  }

  function load(hostId) {
    teamssh.data.readMetrics(hostId).then(function (pts) {
      var box = document.createElement('div');
      box.className = 'ts-card';
      if (!pts || pts.length === 0) {
        box.innerHTML = '<div class="ts-empty">该主机暂无监控数据。先在主程序里打开一次监控页采集。</div>';
      } else {
        var last = pts[pts.length - 1];
        box.innerHTML = '<div class="ts-title">最近一次采样</div>' +
          '<div class="ts-kv"><b>CPU</b><span>' + last.cpu + '%</span></div>' + bar(last.cpu) +
          '<div class="ts-kv"><b>内存</b><span>' + last.mem + '%</span></div>' + bar(last.mem) +
          '<div class="ts-kv"><b>磁盘</b><span>' + last.disk + '%</span></div>' + bar(last.disk) +
          '<div class="ts-kv"><b>负载</b><span>' + last.load + '</span></div>' +
          '<div class="ts-kv"><b>网络</b><span>↓' + last.netIn + ' ↑' + last.netOut + ' KB/s</span></div>' +
          '<div class="ts-sub" style="margin-top:8px">共 ' + pts.length + ' 个采样点（最多显示 48 个）</div>';
      }
      root.appendChild(box);
    }).catch(function (e) {
      teamssh.ui.toast('读取指标失败：' + e.message);
    });
  }

  Promise.all([teamssh.data.listHosts(), teamssh.info()]).then(function (r) {
    show(r[0] || [], 0);
  }).catch(function (e) {
    root.innerHTML = '<div class="ts-empty">需要 data.hosts.read 能力：' + esc(e.message) + '</div>';
  });
})();
