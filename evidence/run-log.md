# 运行记录

## 开发验证

验证日期为 2026-11-02。源码调查基准为 makecindy/cindy@4e1b73dce924704c86a79481378f8741cfeb05f9，实际客户端是官方 macOS arm64 Global Cindy 0.1.121。插件接口对照 tag v0.1.121 核查。

先安装最小 0.1.0 插件，确认右侧面板可以加载，再升级完整 1.0.0。`01-minimal-loaded.png` 中的“0 个 PR”是标注了尚未访问 GitHub 的加载回执；未配置凭证时的提示见 `03-missing-credential.png`。

真实账号验证发生在开发仓库 [56oah/cindy-ai-intern-exam](https://github.com/56oah/cindy-ai-intern-exam) 的 PR #1，提交为 bb07346c06d2fef7b6685c9141f3de337eced360。面板获取了该 PR，显示两项 test 检查成功，见 `04-live-pr-ci.png`。历史 GitHub Actions 运行 41395371366、41395459254 均为 completed/success，原始链接保存在 `github-ci.json`。这些链接和截图反映当时的验证，没有改写为新仓库的记录。

点击后创建了可见任务 d12f8cfa-a189-403c-b184-36b472c01f0b，附带 PR、head SHA、检查和作业链接，见 `05-agent-context.png`。任务调用了插件 get_ci_context，最终确认两项检查成功，没有失败可排查，同时说明原始日志和完整作业步骤未取得，见 `06-agent-result.png` 与重新打开任务后的 `08-agent-result-recheck.jpg`。期间客户端曾退出，恢复后继续，退出原因未确认。

验证时临时使用本机已有的 GitHub OAuth 凭证，权限包含 repo，不能称为只读令牌；插件只调用读取接口。测试结束后清除了插件保险库中的临时凭证，转交用的临时文件也已删除。设置页复核仍为“尚未配置 GitHub Token”，见 `02-installed-settings.png`、`07-settings-recheck.jpg`。设置页复核与任务重新截图没有触发新的 GitHub 查询或任务调用。

## 发现与修正

仓库参数校验初版接受 ../evil，回归测试暴露后补充拒绝点路径段。tasks.send 正常返回仍可能带 failed 或 reconciling，因此根据实际状态提示核查，不能只凭没有异常判断交接成功。

同一 head SHA 的 CI 仍可能改变，原来的去重范围过粗；修正后按诊断结果区分新的排查，同时保留结果未知请求的原键重试，避免重复派发。另按 UTF-8 字节限制 KV 存储容量。

Token 指引最初误把私有 Checks 读取写成 fine-grained PAT 的可选权限。核对 GitHub 官方接口后，修正了设置页、清单和 README，并保留权限不足时的未知状态。

## 交付校验

源码、Skill、测试和原始截图从验证版本复制，运行文件按字节比对。重新运行现有测试和三个 JavaScript 文件的语法检查，结果记录在 `tests.txt`。新仓库发布后的 CI 记录单独保存，和开发阶段的历史记录区分。

## 验证范围

已实测真实账号 PR 获取、成功 CI 展示、宿主凭证代发、任务交接与最终回复。真实失败和运行中 CI 仍只由测试替身覆盖；未下载原始 Actions 日志，不能声称完成了真实失败诊断。亮色界面已截图，暗色尚未实机目检。
