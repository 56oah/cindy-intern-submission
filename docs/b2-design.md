# 收工 Skill 设计

## 文件与加载

完整文件保存在 skills/finish-work/SKILL.md，它先确认“本次改动”从哪里算起，再执行题目要求的四步，否则工作区干净时很容易漏掉本次已经提交的代码。Cindy 可从 SkillHub 本地导入该文件，或把 finish-work 目录放入项目 .agents/skills/ 后重启会话；仓库里的 skills/ 只是交付目录，不表示已经加载。

## 固定动作与判断

应固定的是四步顺序、检查完整改动范围、失败仍继续审查、修改后重新测试，以及没有通过就不能宣布收工完成。这些是防止遗漏的底线。测试命令如何选择、需要补看哪些调用方，以及某条日志或固定数据是否合理，则交给 AI 结合项目判断。不同项目没有统一的测试入口，合法日志和测试样本也不能见到关键词就删除。

## 为什么使用 Skill

这里需要复用的是一套工作流程，终端、Git 和文件读取能力已经存在，用 Skill 告诉 Agent 按什么顺序检查就够了。做成插件会多出接口和维护工作，却没有新的服务或界面需求。

加载方式依据：[cindy-skill-creator/SKILL.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-skill-creator/SKILL.md#L158)。
