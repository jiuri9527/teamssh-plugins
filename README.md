# TeamSSH 插件仓库

TeamSSH（HarmonyOS SSH/SFTP/终端工具）的**官方插件源**。应用只从本仓库拉取插件，
仓库地址写死在应用代码里，用户与插件都不能改。

- 索引：[`index.json`](index.json)
- 插件目录：`plugins/<名称>/`，每个插件恰好两个文件 —— `plugin.json` + 入口 JS

## 安装方式

TeamSSH → 服务器页 → 添加与工具 → 插件 → 在「插件源（GitHub）」里点安装。

## 一个插件长什么样

```
plugins/hello/
├── plugin.json     # 清单：身份、版本、能力、域名白名单、入口文件的 sha256
└── main.js         # 入口：唯一的可执行文件
```

`plugin.json`：

```json
{
  "schema": 1,
  "id": "demo.hello",
  "name": "便签",
  "version": "1.0.0",
  "author": "TeamSSH",
  "description": "……",
  "entry": "main.js",
  "capabilities": ["storage", "ui.toast"],
  "netHosts": [],
  "minAppVersion": "0.1.0",
  "sha256": "<入口 main.js 的 SHA-256，64 位小写十六进制>"
}
```

`sha256` 必须是**入口文件字节**的哈希。内容与授权绑定：改了 `main.js` 就必须改清单，
校验不过应用直接拒绝安装。

## 能力清单（闭集）

插件只能申请下面这些能力。**清单里出现任何一项之外的字符串，整份清单判废、拒绝安装。**

| 能力 | 允许插件做什么 |
| --- | --- |
| `storage` | 在**自己**的沙箱目录里读写数据，上限 256 条键 / 512KB |
| `net.fetch` | 经主程序代发 HTTPS 请求，且只能命中 `netHosts` 声明的域名 |
| `ui.panel` | 声明自己的面板标题 |
| `ui.toast` | 弹一条提示 |
| `event.session` | 接收连接/断开事件 |
| `event.alert` | 接收告警事件 |
| `data.hosts.read` | 读取主机的 **id / 名称 / 分组 / 是否收藏**（不含地址、用户名、任何凭据） |
| `data.snippets.read` | 读取命令片段 |
| `data.snippets.write` | 新增/修改/删除命令片段 |
| `monitor.read` | 读取主程序**已采集**的 5 分钟聚合指标（不触发新采集） |
| `exec.command` | 在已连接主机上执行命令，**每条都要用户单独确认** |

## 这些能力永远不存在

不是"申请了会被拒"，是接口本身没有这些方法：

`credential.read` · `credential.password.read` · `credential.privatekey.read` ·
`credential.passphrase.read` · `terminal.bytes.read` · `terminal.bytes.write` ·
`sftp.raw` · `file.read` · `file.write` · `keyvault.any` · `native.any` ·
`plugin.install` · `settings.write`

也就是说：**插件读不到你的密码、私钥、私钥口令，也读不到终端里滚过的字节。**
凭据对插件永久不可见。

## 运行时模型（写插件前必读）

- 插件 JS 跑在一个受限 WebView 沙箱里，宿主页面由主程序提供，插件无法替换。
- 宿主页面 CSP 含 `connect-src 'none'` 与 `frame-src 'none'`：
  - 插件页面**自己发不出任何网络请求**，联网只能走 `teamssh.net.fetch`；
  - 禁止 iframe —— 因为桥对象会出现在页面的所有 frame（含 iframe）里，
    允许 iframe 就等于允许插件把桥泄漏给外部站点。
- 沙箱文件走自定义协议按次发放，WebView 的 `fileAccess` 关闭（否则等于交出整个应用沙箱）；
  `domStorageAccess` 也关闭，否则 `localStorage` 能绕开存储配额。
- **没有 `localStorage` / `sessionStorage` / `indexedDB` 可用**，持久化只走 `teamssh.storage`。
- 未授予的能力，对应方法在 `teamssh` 对象上**根本不存在**（不是"存在但报错"），
  可以用 `'fetch' in teamssh.net` 探测。

## API

```js
await teamssh.info()                        // {id,name,version,appVersion,capabilities}
await teamssh.storage.get(key)              // string
await teamssh.storage.set(key, value)       // value 上限 64KB
await teamssh.storage.remove(key)
await teamssh.net.fetch(url, {method,headers,body,timeoutMs})  // {status,body,truncated}
await teamssh.ui.toast(msg)
await teamssh.ui.registerPanel({title})
await teamssh.data.listHosts()              // [{id,name,group,favorite}]
await teamssh.data.listSnippets()           // [{id,title,command,group}]
await teamssh.data.saveSnippet({id,title,command,group})  // id=0 新建
await teamssh.data.deleteSnippet(id)
await teamssh.data.readMetrics(hostId)      // 最近 48 个 5 分钟聚合点
await teamssh.exec({hostId, command})       // {exit,stdout,stderr}；每次弹确认
teamssh.onSession(cb) / teamssh.onAlert(cb)
teamssh.platform.root()                     // 你的 DOM 挂载点
```

失败一律以 `Error` 抛出，`e.code` 是稳定码值（如 `host_not_allowed`、`user_denied`、
`capability_denied`）。`user_denied` 是正常路径，不是故障。

## 上架一个插件

1. 在 `plugins/` 下建目录，写 `plugin.json` 与 `main.js`。
2. 算入口哈希：`shasum -a 256 plugins/<你的目录>/main.js`，填进清单的 `sha256`。
3. 在 `index.json` 的 `plugins` 数组里加一条，`capabilities` 必须**包含**清单声明的全部能力
   （应用会拒绝"清单超出索引声明"的越权提权）。
4. 提 PR。索引里任何一条不合法，整份索引会被应用判废拒解析 —— 请自查后再提。

## 已收录

| 插件 | 能力 | 说明 |
| --- | --- | --- |
| `demo.hello` | storage, ui.toast | 本地便签，也是 SDK 的活文档 |
| `demo.hostboard` | data.hosts.read, monitor.read, ui.toast | 主机指标看板，只读已采集数据 |
| `demo.httpcheck` | net.fetch, storage, ui.toast | 接口可用性自查，演示受限联网 |
| `demo.execdemo` | data.hosts.read, exec.command, ui.toast | 四条只读命令，演示逐次确认 |

## 许可

插件示例采用 MIT。示例的作用是演示 API 与安全边界，不保证适合生产使用。
