# Cindy 工程实习生笔试

答题文档：[Cindy笔试答题.docx](Cindy笔试答题.docx)。

| 内容 | 位置 |
| --- | --- |
| 项目导览与单词卡设计 | `docs/project-guide.md`、`docs/word-card-design.md` |
| 工程判断 | `docs/part-a.md` |
| PR 看板完整源码与使用说明 | `plugin/pr-board/` |
| 收工 Skill | `skills/finish-work/SKILL.md` |
| 运行记录、截图及测试结果 | `evidence/` |
| 自动化测试 | `tests/pr-board.test.cjs` |

插件按 Cindy 0.1.121 验证，不需要独立后端或额外运行依赖。安装、Token 权限及使用方式见[插件说明](plugin/pr-board/README.md)。

在仓库根目录运行：

```sh
node --test tests/pr-board.test.cjs
```

测试使用明确的 GitHub 和宿主替身，实机验证范围见[运行记录](evidence/run-log.md)。截图和历史 CI 链接保留开发验证时的原始信息，当前源码以本仓库为准。
