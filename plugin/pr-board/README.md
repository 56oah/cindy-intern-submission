# 我的 PR 看板

这是一个 Cindy 常驻面板插件，不需要另起服务或安装依赖。打开面板会获取当前 GitHub 账号创建、被指派、被请求评审的未关闭 PR，并显示当前 head SHA 对应的 CI 状态。点击「交给 Cindy 排查」会收集诊断资料，创建可见的 Cindy 任务并发送分析请求。

接口按 Cindy `v0.1.121`（`727afb1ad6902176e2ec55254154b900c489a998`）核查。使用的宿主契约见该版本的 `apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-panels.md`、`plugin-network.md`、`plugin-agent-tasks.md`，SDK 实现在 `apps/desktop/src/preload/ghostPreload.ts`。实际任务返回值另核查了 `apps/desktop/src/shared/pluginTasks.ts` 与 `apps/desktop/src/main/maker-ipc/pluginTaskService.ts`。

## 安装和使用

在本目录执行以下命令，可生成仅供 Cindy 导入安装的插件包。GitHub 仓库保留本目录完整源码，不用压缩包替代源码。

```sh
zip /tmp/pr-board-1.0.0.cindy ghost.json main.js panel.html panel.js style.css settings.html settings.js
```

在 Cindy 的插件页导入这个 `.cindy` 文件，查看并批准网络和任务能力后启用。包由宿主导入流程校验；上述命令是普通 ZIP 打包，没有调用 Cindy Forge。右侧栏会出现「我的 PR 看板」，关闭后可从侧栏的「+」重新打开。

在插件详情的设置区保存你选择的 GitHub Token。fine-grained PAT 可按仓库授予 Pull requests、Commit statuses、Actions 的读取权限，但没有 Checks 选项，不能据此授予私有 Checks 读取能力。[GitHub 的 Checks 接口权限表](https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28#list-check-runs-for-a-git-reference)仅列 GitHub App user／installation token 两种细粒度令牌，并说明 OAuth token 或 classic PAT 访问私有仓库需 `repo` scope。需要完整私有 Checks 时，可以使用支持该接口的已有 OAuth token，或由用户自行选择 classic PAT；`repo` scope 权限较广，包含写权限，不能称为只读令牌。本插件只调用读取接口，Checks 不可读时保留未知状态与错误说明。组织可能要求管理员批准或限制令牌类型。PR、状态及 Actions 各自所需权限见 [Pull requests](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#get-a-pull-request)、[Commit statuses](https://docs.github.com/en/rest/commits/statuses?apiVersion=2022-11-28#get-the-combined-status-for-a-specific-reference)、[Actions jobs](https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28#list-jobs-for-a-workflow-run)。

Token 经同源 `/secrets` 交给宿主保险库，联网时仅向 `api.github.com` 注入，插件逻辑和 Agent 不读取 Token；请勿将其放入聊天、代码或截图。清除按钮会删除这条宿主凭证。

点击刷新查看 PR。首次交接前，需在 Cindy 配好可用的模型／Agent；插件沿用宿主的任务配置，不另索要模型 API Key。交接成功后，在任务列表打开名称为 `CI owner/repo#编号` 的任务继续处理。界面显示已受理只代表消息已排队或执行，不代表已查明 CI 根因。

## 范围与错误处理

CI 同时读取 Checks 和 commit status，失败、运行中、成功及未知分别显示。没有检查、无权限或查询不完整时不会判为成功。成功表示已读到的检查没有失败，不代表满足分支保护规则或 PR 可以合并。结果限于 Token 可访问的仓库；fine-grained PAT 受资源所有者和仓库选择范围限制，不能把未授权仓库中的私有 PR 缺席解释为没有待办。每类 PR 搜索和每份检查列表最多读取 1000 条，触顶或搜索失败会提示结果不完整。

交接附 PR 链接、head SHA、分支、检查输出、失败检查的前 20 条注解，以及最多 3 个 Actions run 的失败作业／步骤。详细输出只取前 5 个失败检查；交接资料超过 10000 字符会明确截断。没有下载原始 Actions 日志，诊断信息不一定足够确认根因；缺权限时仍可交接链接与错误说明。Agent 也可以调用插件的 `get_ci_context` 工具补查。

面板先通过 `/wake` 启动逻辑页，再用同源 BroadcastChannel 交互。请求重发使用同一个编号去重；向宿主创建和发送任务前，将请求键与原始资料写入 `/kv`。同一 PR、SHA 和诊断快照通过 SHA-256 指纹去重；同一 SHA 上 CI 状态或诊断变化后可以重新排查。此前结果未确定时，优先用原请求键及原文重试，不因诊断变化重复派发。宿主返回 `failed` 或 `reconciling` 时明确提示核查任务。最多保存 20 条交接记录，同时将存储控制在 64KB UTF-8 字节以内，超限先淘汰已受理的旧记录；未确定结果的记录不自动删除，无法腾出空间时停止发送并提示核查。网络并发上限为 3，插件没有 GitHub 写功能。

## 验证

在仓库根目录运行：

```sh
node --test tests/pr-board.test.cjs
node --check plugin/pr-board/main.js
node --check plugin/pr-board/panel.js
node --check plugin/pr-board/settings.js
```

测试使用明确的 GitHub 与宿主替身，执行交付的 `main.js` 入口，覆盖列表与 CI、分页与权限、部分诊断失败、任务返回状态、重复交接、跨进程同键重试及并发限制。真实输出保存在 `evidence/tests.txt`。这些自动化测试不代表已完成真实账号的 GitHub 查询或模型调用；实机结果以答题文档和运行截图为准。
