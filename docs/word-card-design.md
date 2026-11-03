# 每日单词卡设计

## 模型接入

我会使用 Cindy 已有的快问快答能力 oneshot_text。生成例句只需要提交单词和工作场景，再取得文本结果，不涉及读取文件或连续调用工具，因此没有必要启动完整 Agent。

实现时，在 ghost.json 中声明 oneshot 文本能力，通过 cindy.send 发送 oneshot_text 请求，由 Cindy 负责选择和调用模型。我会一次提交当天的 10 个单词，要求返回对应例句，并检查数量和对应关系，避免出现漏词或例句错配。

仓库依据是 plugin-runtime.md 的 §4.0.2“快问快答”，其中给出了能力声明、请求示例，并说明该接口使用宿主的模型通道，不启动 Agent。

## 用户配置

如果 Cindy 中已经有可用模型，用户不需要再为这个插件填写一份模型 API Key。插件可以沿用 Cindy 的系统辅助模型配置，用户也可以在插件详情页的“模型与任务”中单独选择模型。如果 Cindy 本身没有可用模型，则需要先完成 Cindy 的模型配置。

为了让例句贴近实际工作，我会在首次使用时让用户简短填写工作场景，例如“后端开发”或“客户沟通”，之后可以修改。这是插件需要的业务信息，与模型接入凭证是两回事，也不能假定插件自动知道用户的工作内容。

依据同样来自 plugin-runtime.md §4.0.2 的模型选择说明。不重复配置 Key 也不代表免费，是否产生费用仍取决于所用模型和通道。

## API Key 方案判断

我不会采用这个方案。Cindy 已经提供统一模型通道，再让用户填写 OpenAI Key，会增加重复配置，也让插件额外承担凭证保护、接口适配和错误处理的工作，并把功能绑定到 OpenAI。对于生成例句这样的小功能，这些成本没有必要。

项目本身也明确要求模型调用走 Cindy 的统一通道，不允许插件自行绕过。因此，我会把模型接入交给 Cindy，插件只负责组织单词和场景、检查生成结果以及展示单词卡。

依据：[快问快答接口](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md#L248)、[插件模型调用约定](https://github.com/makecindy/cindy/blob/4e1b73dce924704c86a79481378f8741cfeb05f9/docs/dev-rules/plugin-security-and-authoring.md#L555)。
