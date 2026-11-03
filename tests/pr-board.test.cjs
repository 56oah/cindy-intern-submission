const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

// 只替换宿主和 GitHub 边界，执行交付的 main.js；测试数据不会进入插件包。
const script = new vm.Script(fs.readFileSync(path.join(__dirname, '../plugin/pr-board/main.js'), 'utf8'));
const json = value => JSON.parse(JSON.stringify(value));
const sha = 'a'.repeat(40);
const issue = { number: 1, title: 'Fix tests', repository_url: 'https://api.github.com/repos/acme/repo', html_url: 'https://github.com/acme/repo/pull/1' };
const check = (status, conclusion, id = 7) => ({ id, name: 'unit tests', status, conclusion,
  details_url: 'https://github.com/acme/repo/actions/runs/12/job/34', output: { summary: '1 test failed', text: 'Expected 1 but got 2', annotations_count: 1 } });
function api(options = {}) {
  return async url => {
    const request = new URL(url);
    const route = request.pathname;
    if (route === '/user') return { login: 'dev' };
    if (route === '/search/issues') return { total_count: 1, items: [issue] };
    if (route === '/repos/acme/repo/pulls/1') return { title: 'Fix tests', html_url: issue.html_url,
      head: { sha, ref: 'fix', repo: { full_name: 'contributor/fork' } }, base: { repo: { full_name: 'acme/repo' } } };
    if (route.endsWith('/check-runs')) {
      if (options.checks) return options.checks(request);
      return { total_count: 1, check_runs: [check('completed', 'success')] };
    }
    if (route.endsWith('/status')) return options.status || { state: 'pending', total_count: 0, statuses: [] };
    if (route.endsWith('/annotations')) return [{ path: 'test.js', start_line: 2, annotation_level: 'failure', message: 'assertion failed' }];
    if (route.endsWith('/jobs')) return { total_count: 1, jobs: [{ name: 'Linux', conclusion: 'failure', html_url: 'https://github.com/acme/repo/actions/runs/12/job/34', steps: [{ name: 'Run tests', conclusion: 'failure' }] }] };
    throw new Error(`Unexpected API request: ${url}`);
  };
}
function host(options = {}) {
  let handler, channel, reply;
  const calls = [], creates = [], sends = [];
  const storage = options.storage || { value: {} };
  const resolvers = new Map();
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    BroadcastChannel: class {
      constructor() { channel = this; }
      postMessage(value) { const resolve = resolvers.get(value.id); if (resolve) { resolvers.delete(value.id); resolve(json(value)); } }
    },
    fetch: async (url, request) => {
      assert.equal(url, '/kv');
      if (options.kvFailure) return { ok: false };
      if (request) storage.value = JSON.parse(request.body);
      return { ok: true, json: async () => json(storage.value) };
    },
    cindy: {
      onHostMessage: callback => { handler = callback; },
      send: value => { reply = value; },
      fetch: async request => {
        calls.push(json(request));
        const response = await (options.api || api())(request.url, request);
        return response?.ok === false || response?.status ? response : { ok: true, status: 200, body: JSON.stringify(response) };
      },
      tasks: options.noTasks ? undefined : {
        capabilities: async () => ({ operations: ['create', 'send'], messageContext: true }),
        create: async request => { creates.push(json(request)); return { taskId: 'task-1', revision: 3 }; },
        send: async request => { sends.push(json(request)); if (options.send) return options.send(request); return { runId: 'run-1', taskId: request.taskId, status: 'queued' }; }
      }
    }
  });
  script.runInContext(context);
  return {
    calls, creates, sends, storage,
    async tool(tool, args = {}) { await handler({ type: 'tool-call', tool, args, callId: 'tool-1' }); return json(reply); },
    request(action, args = {}, id = webcrypto.randomUUID()) {
      return new Promise(resolve => {
        resolvers.set(id, resolve);
        channel.onmessage({ data: { type: 'request', id, action, ...args } });
      });
    }
  };
}

test('列表去重，CI 绑定 base 仓库的当前 head SHA，在途工具保留 callId', async () => {
  const env = host();
  const result = await env.tool('list_prs');
  assert.equal(result.ok, true);
  assert.equal(result.result.prs.length, 1);
  assert.equal(result.result.prs[0].state, 'success');
  assert.equal(result.result.prs[0].sha, sha);
  assert.equal(env.calls.filter(item => item.url.includes('/search/issues')).length, 3);
  assert.ok(env.calls.some(item => item.url.includes(`/repos/acme/repo/commits/${sha}/check-runs`)));
  assert.ok(env.calls.every(item => item.callId === 'tool-1'));
  assert.ok(env.calls.every(item => new URL(item.url).origin === 'https://api.github.com'));
});

test('CI 区分成功、失败、运行中、无检查和权限不足', async () => {
  for (const [name, checks, status, expected] of [
    ['success', [check('completed', 'success')], undefined, 'success'],
    ['failure', [check('completed', 'failure')], undefined, 'failure'],
    ['running', [check('in_progress', null)], undefined, 'running'],
    ['none', [], undefined, 'unknown'],
    ['permission', null, { state: 'success', statuses: [{ state: 'success' }] }, 'unknown'],
    ['commit failure', [], { state: 'failure', statuses: [{ state: 'failure' }] }, 'failure'],
    ['queued', [check('queued', null)], undefined, 'running'],
    ['empty conclusion', [check('completed', null)], undefined, 'unknown']
  ]) {
    const env = host({ api: api({ checks: () => checks === null ? { ok: true, status: 403, body: '{}' } : { check_runs: checks }, status }) });
    const result = await env.tool('get_ci_context', { repo: 'acme/repo', number: 1 });
    assert.equal(result.result.ciState, expected, name);
    if (name === 'permission') assert.match(result.result.warnings.join(' '), /403/);
  }
});

test('Checks 分页中的失败被读取；达到分页上限不能判为通过', async () => {
  const env = host({ api: api({ checks: request => ({ check_runs: request.searchParams.get('page') === '1'
    ? Array.from({ length: 100 }, (_, id) => check('completed', 'success', id)) : [check('completed', 'failure', 101)] }) }) });
  const result = await env.tool('get_ci_context', { repo: 'acme/repo', number: 1 });
  assert.equal(result.result.ciState, 'failure');
  assert.ok(env.calls.some(item => item.url.includes('page=2')));
  const limited = host({ api: api({ checks: () => ({ check_runs: Array.from({ length: 100 }, (_, id) => check('completed', 'success', id)) }) }) });
  const capped = await limited.tool('get_ci_context', { repo: 'acme/repo', number: 1 });
  assert.equal(capped.result.ciState, 'unknown');
  assert.match(capped.result.warnings.join(' '), /1000/);
});

test('交接包含 SHA、失败检查和作业步骤，部分注解失败仍可交接，同一点击只发送一次', async () => {
  const regular = api({ checks: () => ({ check_runs: [check('completed', 'failure')] }) });
  const env = host({ api: url => url.includes('/annotations') ? { ok: true, status: 403, body: '{}' } : regular(url) });
  const result = await env.request('handoff', { repo: 'acme/repo', number: 1 }, 'click-1');
  assert.equal(result.ok, true);
  assert.equal(env.creates.length, 1);
  assert.equal(env.sends.length, 1);
  assert.equal(env.sends[0].expectedRevision, 3);
  const context = JSON.parse(env.sends[0].context);
  assert.equal(context.headSha, sha);
  assert.equal(context.failedChecks[0].summary, '1 test failed');
  assert.equal(context.failedJobs[0].failedSteps[0].name, 'Run tests');
  assert.match(context.warnings.join(' '), /403/);
  await env.request('handoff', { repo: 'acme/repo', number: 1 }, 'click-1');
  await env.request('handoff', { repo: 'acme/repo', number: 1 }, 'click-2');
  assert.equal(env.creates.length, 1);
  assert.equal(env.sends.length, 1);
  assert.ok(Object.values(env.storage.value.handoffs)[0].accepted);
});

test('派发结果未知后重启，沿用持久化的请求键、正文与 revision，不另建任务', async () => {
  const storage = { value: {} };
  const first = host({ storage, send: async () => { throw new Error('HOST_NOT_READY: result uncertain'); } });
  const failed = await first.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(failed.ok, false);
  // 同一 SHA 的诊断已经变化，也不能绕过之前结果未知的输入。
  const second = host({ storage, api: api({ checks: () => ({ check_runs: [check('completed', 'failure')] }) }) });
  const retried = await second.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(retried.ok, true);
  assert.equal(second.creates.length, 0);
  assert.deepEqual(second.sends[0], first.sends[0]);
});

test('同一 SHA 的 CI 从运行中变失败后可再次排查，同一诊断快照不重复交接', async () => {
  let conclusion = null;
  const env = host({ api: api({ checks: () => ({ check_runs: [check(conclusion ? 'completed' : 'in_progress', conclusion)] }) }) });
  await env.request('handoff', { repo: 'acme/repo', number: 1 });
  conclusion = 'failure';
  const changed = await env.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(changed.ok, true);
  assert.equal(changed.data.alreadySent, false);
  assert.equal(env.creates.length, 2);
  assert.equal(env.sends.length, 2);
  assert.notEqual(env.sends[0].requestKey, env.sends[1].requestKey);
  assert.equal(JSON.parse(env.sends[1].context).ciState, 'failure');
  const repeated = await env.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(repeated.data.alreadySent, true);
  assert.equal(env.sends.length, 2);
});

test('KV 按 UTF-8 字节回收已受理记录，未确定记录占满时不创建或发送', async () => {
  const accepted = { value: { handoffs: { old: { accepted: true, note: '中'.repeat(22000) } } } };
  const first = host({ storage: accepted });
  assert.equal((await first.request('handoff', { repo: 'acme/repo', number: 1 })).ok, true);
  assert.equal(accepted.value.handoffs.old, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(accepted.value), 'utf8') < 65536);
  const unresolved = { value: { handoffs: { old: { text: '中'.repeat(22000) } } } };
  const second = host({ storage: unresolved });
  const result = await second.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /64KB.*未继续发送/);
  assert.equal(second.creates.length, 0);
  assert.equal(second.sends.length, 0);
  assert.ok(unresolved.value.handoffs.old);
});

test('tasks.send 正常返回 failed 或 reconciling 时不能显示交接成功', async () => {
  for (const status of ['failed', 'reconciling']) {
    const env = host({ send: async () => ({ runId: 'run-1', taskId: 'task-1', status }) });
    const result = await env.request('handoff', { repo: 'acme/repo', number: 1 });
    assert.equal(result.ok, false);
    assert.match(result.error, new RegExp(status));
    assert.notEqual(Object.values(env.storage.value.handoffs)[0].accepted, true);
    await env.request('handoff', { repo: 'acme/repo', number: 1 });
    assert.equal(env.creates.length, 1);
    assert.deepEqual(env.sends[0], env.sends[1]);
  }
});

test('全部远端诊断不可读时仍附链接与缺失证据交给 Agent', async () => {
  const env = host({ api: async () => ({ ok: true, status: 404, body: '{}' }) });
  const result = await env.request('handoff', { repo: 'acme/repo', number: 1 });
  assert.equal(result.ok, true);
  const context = JSON.parse(env.sends[0].context);
  assert.equal(context.url, issue.html_url);
  assert.equal(context.headSha, null);
  assert.match(context.warnings[0], /无法核实 head SHA/);
});

test('缺任务能力、非法 PR 参数和 KV 读取失败不创建任务', async () => {
  const unsupported = host({ noTasks: true });
  assert.equal((await unsupported.request('handoff', { repo: 'acme/repo', number: 1 })).ok, false);
  assert.equal(unsupported.calls.length, 0);
  const invalid = host();
  assert.equal((await invalid.request('handoff', { repo: '../evil', number: 1 })).ok, false);
  assert.equal(invalid.calls.length, 0);
  const brokenStore = host({ kvFailure: true });
  assert.equal((await brokenStore.request('handoff', { repo: 'acme/repo', number: 1 })).ok, false);
  assert.equal(brokenStore.creates.length, 0);
});

test('GitHub 请求最多三个并发；搜索部分失败明确提示不完整', async () => {
  let active = 0, maximum = 0;
  const regular = api();
  const env = host({ api: async url => {
    active++;
    maximum = Math.max(active, maximum);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (url.includes('review-requested')) return { ok: true, status: 403, body: '{}' };
    return regular(url);
  } });
  const result = await env.tool('list_prs');
  assert.equal(result.result.prs.length, 1);
  assert.match(result.result.warnings.join(' '), /review-requested.*403/);
  assert.ok(maximum <= 3);
});
