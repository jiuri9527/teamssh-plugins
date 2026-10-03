/*
 * demo.hello —— 最小可用插件：本地便签。
 * 只用 storage + toast 两项能力，不碰网络、不读任何主程序数据。
 * 它同时是插件 SDK 的"活文档"：新写插件的人照这个文件改就行。
 */
(function () {
  'use strict';

  var KEY = 'notes';
  var root = teamssh.platform.root();

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(notes) {
    var html = '<div class="ts-card">' +
      '<div class="ts-title">便签</div>' +
      '<div class="ts-sub">内容只存在本机插件沙箱里，卸载插件即一并删除。</div>' +
      '</div>';
    if (notes.length === 0) {
      html += '<div class="ts-empty">还没有便签，下面输入一条。</div>';
    } else {
      html += '<div class="ts-card">';
      for (var i = 0; i < notes.length; i++) {
        html += '<div class="ts-row">' +
          '<span class="ts-mono">' + esc(notes[i]) + '</span>' +
          '<button class="ts-btn" data-del="' + i + '">删除</button>' +
          '</div>';
      }
      html += '</div>';
    }
    html += '<div class="ts-card">' +
      '<input id="hi" class="ts-btn" style="width:100%;text-align:left" placeholder="记一条">' +
      '<button id="add" class="ts-btn" style="margin-top:8px;width:100%">添加</button>' +
      '</div>';
    root.innerHTML = html;

    document.getElementById('add').onclick = function () {
      var v = document.getElementById('hi').value.trim();
      if (v === '') { return; }
      notes.push(v);
      teamssh.storage.set(KEY, JSON.stringify(notes)).then(function () {
        teamssh.ui.toast('已保存');
        render(notes);
      }).catch(function (e) {
        teamssh.ui.toast('保存失败：' + e.message);
      });
    };
    var dels = root.querySelectorAll('[data-del]');
    for (var j = 0; j < dels.length; j++) {
      dels[j].onclick = function (ev) {
        var idx = Number(ev.target.getAttribute('data-del'));
        notes.splice(idx, 1);
        teamssh.storage.set(KEY, JSON.stringify(notes)).then(function () {
          render(notes);
        });
      };
    }
  }

  teamssh.info().then(function (me) {
    return teamssh.storage.get(KEY);
  }).then(function (raw) {
    var notes = [];
    try { notes = raw ? JSON.parse(raw) : []; } catch (e) { notes = []; }
    render(Array.isArray(notes) ? notes : []);
  }).catch(function (e) {
    root.innerHTML = '<div class="ts-empty">初始化失败：' + esc(e.message) + '</div>';
  });
})();
