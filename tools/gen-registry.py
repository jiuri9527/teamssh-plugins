#!/usr/bin/env python3
"""
生成 plugin.json 与 index.json，并把入口文件的 sha256 绑进清单。
保留在仓库里当**上架自查器**：改完插件跑一遍，它会按 App 侧同样的规则拒绝
非法 id/版本/能力/域名，并刷新所有哈希。提交前必须跑通它。

规则必须与 App 侧 model/PluginManifest.ets 完全一致，否则装不上：
  id     ^[a-z0-9][a-z0-9._-]{1,63}$
  ver    x.y.z
  entry  ^[A-Za-z0-9._/-]{1,128}$、必须 .js 结尾、不含 .. 与绝对路径
  sha256 ^[0-9a-f]{64}$，且是**入口文件字节**的哈希
  申请 net.fetch 就必须给出 netHosts；不申请就必须留空
  registry 声明的能力必须是该插件 manifest 能力的**超集**（App 侧会拒绝越权清单）
"""
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGINS = os.path.join(ROOT, 'plugins')

ALLOWED = {
    'storage', 'net.fetch', 'ui.panel', 'ui.toast', 'event.session', 'event.alert',
    'data.hosts.read', 'data.snippets.read', 'data.snippets.write', 'monitor.read', 'exec.command'
}
DENIED = {
    'credential.read', 'credential.password.read', 'credential.privatekey.read',
    'credential.passphrase.read', 'terminal.bytes.read', 'terminal.bytes.write',
    'sftp.raw', 'file.read', 'file.write', 'keyvault.any', 'native.any',
    'plugin.install', 'settings.write'
}
ID_RE = re.compile(r'^[a-z0-9][a-z0-9._-]{1,63}$')
VER_RE = re.compile(r'^\d+\.\d+\.\d+$')
SHA_RE = re.compile(r'^[0-9a-f]{64}$')
HOST_RE = re.compile(r'^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$')

SPECS = [
    {
        'id': 'demo.hello', 'name': '便签', 'version': '1.0.0', 'author': 'TeamSSH',
        'description': '把随手要记的东西存在插件自己的沙箱里，卸载即清空。',
        'dir': 'hello', 'entry': 'main.js',
        'capabilities': ['storage', 'ui.toast'], 'netHosts': [],
    },
    {
        'id': 'demo.hostboard', 'name': '主机指标看板', 'version': '1.0.0', 'author': 'TeamSSH',
        'description': '用主程序已采集的 5 分钟聚合数据看 CPU/内存/磁盘/负载，不额外探测服务器。',
        'dir': 'hostboard', 'entry': 'main.js',
        'capabilities': ['data.hosts.read', 'monitor.read', 'ui.toast'], 'netHosts': [],
    },
    {
        'id': 'demo.httpcheck', 'name': '接口可用性自查', 'version': '1.0.0', 'author': 'TeamSSH',
        'description': '检查 GitHub API 与插件索引是否可达；请求由主程序代发并过域名白名单。',
        'dir': 'httpcheck', 'entry': 'main.js',
        'capabilities': ['net.fetch', 'storage', 'ui.toast'],
        'netHosts': ['api.github.com', 'raw.githubusercontent.com'],
    },
    {
        'id': 'demo.execdemo', 'name': '远程命令演示', 'version': '1.0.0', 'author': 'TeamSSH',
        'description': '四条只读命令样板；每条都要你在弹窗里单独批准一次，批准不累积。',
        'dir': 'execdemo', 'entry': 'main.js',
        'capabilities': ['data.hosts.read', 'exec.command', 'ui.toast'], 'netHosts': [],
    },
]


def fail(msg):
    print('FAIL:', msg)
    sys.exit(1)


index_entries = []

for s in SPECS:
    if not ID_RE.match(s['id']):
        fail(f"bad id {s['id']}")
    if not VER_RE.match(s['version']):
        fail(f"bad version {s['version']}")
    caps = s['capabilities']
    if not caps:
        fail(f'{s["id"]}: empty capabilities')
    if len(set(caps)) != len(caps):
        fail(f'{s["id"]}: duplicate capability')
    for c in caps:
        if c in DENIED:
            fail(f'{s["id"]}: denied capability {c}')
        if c not in ALLOWED:
            fail(f'{s["id"]}: unknown capability {c}')
    hosts = s['netHosts']
    if 'net.fetch' in caps:
        if not hosts:
            fail(f'{s["id"]}: net.fetch without netHosts')
        for h in hosts:
            if not HOST_RE.match(h) or h in ('localhost', 'metadata.google.internal'):
                fail(f'{s["id"]}: bad host {h}')
            if re.match(r'^\d+\.\d+\.\d+\.\d+$', h):
                fail(f'{s["id"]}: IP literal host {h}')
    elif hosts:
        fail(f'{s["id"]}: netHosts without net.fetch')

    entry_path = os.path.join(PLUGINS, s['dir'], s['entry'])
    if not os.path.isfile(entry_path):
        fail(f'missing {entry_path}')
    with open(entry_path, 'rb') as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    if not SHA_RE.match(digest):
        fail('hash not hex')

    manifest = {
        'schema': 1,
        'id': s['id'],
        'name': s['name'],
        'version': s['version'],
        'author': s['author'],
        'description': s['description'],
        'entry': s['entry'],
        'capabilities': caps,
        'netHosts': hosts,
        'minAppVersion': '0.1.0',
        'sha256': digest,
    }
    with open(os.path.join(PLUGINS, s['dir'], 'plugin.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    index_entries.append({
        'id': s['id'],
        'name': s['name'],
        'version': s['version'],
        'description': s['description'],
        'path': f'plugins/{s["dir"]}',
        'sha256': digest,
        # registry 声明的能力 = manifest 能力（保持相等，App 侧要求超集）
        'capabilities': caps,
    })
    print(f'{s["id"]:18s} sha={digest[:16]}… caps={len(caps)}')

with open(os.path.join(ROOT, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump({'schema': 1, 'plugins': index_entries}, f, ensure_ascii=False, indent=2)
print(f'index.json: {len(index_entries)} plugins')
