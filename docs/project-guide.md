# Cindy 项目导览

## 主要组成

桌面客户端（apps/desktop）。用户聊天、创建任务和使用插件的主要入口，采用 Electron。内部又分为三层：renderer 负责显示聊天、任务和插件界面。main 主进程负责接入 Agent、管理任务与本地数据，并提供网络、文件等本机能力。preload 在界面与主进程之间提供受控的调用接口。插件的加载、运行和权限管理主要位于主进程的 cindy-brain 中。

手机客户端（apps/mobile）。采用 Expo 和 React Native，主要负责登录账号、发现桌面设备、查看会话和远程操作任务。它通过设备连接能力与电脑通信，让用户在手机上继续查看和控制桌面端正在处理的工作。

Agent 运行核心（packages/maker-core）。负责定义 Agent 的统一接口、组织会话流程，以及传递执行过程中的事件和结果。桌面端负责界面和本机环境，这一层负责 Agent 如何运行，两者职责分开。

模型、工具和跨设备能力包（packages/ 下的相关模块）。model-providers 管理模型目录、供应商信息和路由。lizi-mcps 提供 GitHub、浏览器等可复用工具。device-link 负责桌面与手机之间的通信、重连和远程调用。maker-shared 保存两端共用的数据类型和约定。这些能力按需被客户端使用。

配置与工程配套。config 保存不同区域的服务端点配置。scripts 提供开发、构建和校验脚本。tools 管理随桌面端使用的运行时版本。docs 记录项目结构与开发规则。它们主要帮助开发者启动、维护和发布项目。

## 插件可以使用的能力

存储配置、业务数据和文件。 用户偏好、开关和少量缓存可以通过 /kv 保存，每个插件的数据相互隔离，容量上限为 64KB。文件可以通过 cindy.fs 保存到插件私有目录。如果是卸载插件后仍应保留的用户作品，则使用 cindy.library。（依据：plugin-settings.md §4.8、plugin-files-and-library.md §4.10、§4.10.1）。

联网访问外部服务。 插件可以通过 cindy.fetch 请求外部 API，例如获取 GitHub PR，由 Cindy 宿主代发请求。插件自己主动联网时，需要在 network.hosts 中声明允许访问的域名。如果请求发生在当前 Agent 工具调用中，则可以携带该次调用的真实 callId 访问普通 HTTPS 地址，不用预先列出域名。（依据：plugin-network.md §4.7）。

安全保存和使用访问凭证。 访问 GitHub 等服务需要 Token 时，可以通过 network.secrets 声明，由用户在设置页录入，再交给宿主保险库保存。请求发出时，宿主只向声明的目标域名注入凭证。插件页面只能查询配置状态，不能从保险库读回完整令牌，所以不用把 Token 写进源码、普通配置或聊天内容。（依据：plugin-network.md 的凭证管理说明）。

调用模型生成内容。 总结、分类、改写和生成例句这类单次文本任务，可以通过 cindy.send 发出 oneshot_text 请求，复用 Cindy 已配置的模型，不用启动完整 Agent。插件需要声明相应能力，实际能否调用取决于 Cindy 的模型配置。图片生成等内容任务也有宿主提供的代办接口，例如 gen_image。（依据：plugin-runtime.md，§4.0.2 快问快答）。

创建任务并交给 Agent 处理。 需要读文件、查资料或连续执行多步操作时，可以声明 agent.tasks，通过 cindy.tasks.create 创建任务，再用 cindy.tasks.send 发送要求和上下文。任务默认对用户可见，用户可以查看过程和继续接手/插件也能查询自己创建的任务状态和结果。例如，PR 看板可以把失败检查资料交给 Agent 分析。（依据：plugin-agent-tasks.md §4.11.3）。

向 AI 提供工具，并向用户提供操作界面。 插件可以在 ghost.json 中声明工具名称、用途和参数，让 Agent 调用自己的功能，也可以通过聊天卡片展示一次调用的过程和结果，或使用常驻面板提供列表、按钮等持续入口。用户配置则可以放在插件设置页中。（依据：plugin-tools.md、plugin-chat-cards.md、plugin-panels.md）。

## 阅读顺序

我把阅读目标分成两部分：一是弄清 Cindy 各模块的职责和关系，二是确认插件能使用哪些宿主能力。按这个目标，先从 README、AGENTS.md 和项目地图入手，了解项目用途、开发约定和主要目录，再进入与插件有关的部分。

接着看插件作者手册和示例，梳理插件的组成、加载方式以及存储、联网、模型和 Agent 接口。核查时重点关注三个问题：接口在哪里实现、使用需要哪些权限、文档描述是否与源码一致。这样整理出来的导览既能说明“有什么”，也能说明“在什么条件下能用”。

## 源码依据

源码调查基准为 makecindy/cindy@4e1b73dce924704c86a79481378f8741cfeb05f9；插件接口另对照实际客户端 v0.1.121 核查。

- [项目 README](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/README.zh-CN.md)
- [仓库地图](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/docs/dev-rules/repo-map.md)
- [plugin-settings.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-settings.md)
- [plugin-files-and-library.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-files-and-library.md)
- [plugin-network.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-network.md)
- [plugin-runtime.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md)
- [plugin-agent-tasks.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-agent-tasks.md)
- [plugin-tools.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-tools.md)
- [plugin-chat-cards.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-chat-cards.md)
- [plugin-panels.md](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-panels.md)
