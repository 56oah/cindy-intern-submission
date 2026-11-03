const channel = new BroadcastChannel('pr-board');
const pending = new Map();
const message = document.querySelector('#message');
const refresh = document.querySelector('#refresh');
const labels = { success: '成功', failure: '失败', running: '运行中', unknown: '未知／无 CI' };
channel.onmessage = ({ data }) => {
  if (data?.type !== 'response') return;
  const request = pending.get(data.id);
  if (!request) return;
  clearInterval(request.timer);
  pending.delete(data.id);
  data.ok ? request.resolve(data.data) : request.reject(new Error(data.error));
};
async function request(action, args = {}) {
  const wake = await fetch('/wake');
  if (!wake.ok) throw new Error('插件未能启动，请确认已启用插件。');
  const payload = { type: 'request', id: crypto.randomUUID(), action, ...args };
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 240) {
        clearInterval(timer);
        pending.delete(payload.id);
        reject(new Error('等待超过两分钟。若正在交接，请先核查 Cindy 任务列表；重试同一 PR 会沿用交接记录。'));
      } else channel.postMessage(payload);
    }, 500);
    pending.set(payload.id, { resolve, reject, timer });
    channel.postMessage(payload);
  });
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
function render(prs) {
  const root = document.querySelector('#prs');
  root.replaceChildren();
  for (const pr of prs) {
    const card = node('article', '', 'pr');
    const link = node('a', `${pr.repo} #${pr.number} ${pr.title}`);
    if (/^https:\/\/github\.com\//.test(pr.url)) link.href = pr.url;
    const heading = node('h2', '');
    heading.append(link);
    card.append(node('span', labels[pr.state], pr.state), heading);
    if (pr.sha) card.append(node('small', `${pr.branch} · ${pr.sha.slice(0, 8)}`));
    for (const warning of pr.warnings || []) card.append(node('p', warning));
    const action = node('button', '交给 Cindy 排查');
    action.onclick = async () => {
      action.disabled = true;
      message.textContent = `正在读取 ${pr.repo}#${pr.number} 的 CI 上下文…`;
      try {
        const result = await request('handoff', { repo: pr.repo, number: pr.number });
        message.textContent = `${result.alreadySent ? '此前已交接' : '已交接'}，请到 Cindy 任务列表查看「CI ${pr.repo}#${pr.number}」。任务 ID：${result.taskId}。受理不代表分析已完成。`;
      } catch (error) { message.textContent = error.message; }
      finally { action.disabled = false; }
    };
    card.append(action);
    root.append(card);
  }
}
refresh.onclick = async () => {
  refresh.disabled = true;
  message.textContent = '正在获取 PR 和 CI 状态…';
  try {
    const result = await request('refresh');
    document.querySelector('#account').textContent = result.login;
    render(result.prs);
    message.textContent = `已获取 ${result.prs.length} 个未关闭 PR（我创建的、指派给我的、等待我评审的）。${result.warnings.join('；')}`;
  } catch (error) { message.textContent = error.message; }
  finally { refresh.disabled = false; }
};
window.addEventListener('pagehide', () => { for (const request of pending.values()) clearInterval(request.timer); channel.close(); });
refresh.click();
