const token = document.querySelector('#token');
const status = document.querySelector('#status');
async function readStatus() {
  const response = await fetch('/secrets');
  if (!response.ok) throw new Error('无法读取凭证状态');
  const secrets = await response.json();
  status.textContent = secrets.find(item => item.key === 'github_token')?.saved ? '已保存 GitHub Token。' : '尚未配置 GitHub Token。';
}
document.querySelector('#save').onclick = async () => {
  if (!token.value.trim()) { status.textContent = '请填写 Token。'; return; }
  try {
    const response = await fetch('/secrets/github_token', { method: 'PUT', body: JSON.stringify({ value: token.value.trim() }) });
    if (!response.ok) throw new Error('保存失败，请重试');
    token.value = '';
    await readStatus();
  } catch (error) { status.textContent = error.message; }
};
document.querySelector('#remove').onclick = async () => {
  try {
    const response = await fetch('/secrets/github_token', { method: 'DELETE' });
    if (!response.ok) throw new Error('清除失败，请重试');
    token.value = '';
    await readStatus();
  } catch (error) { status.textContent = error.message; }
};
readStatus().catch(error => { status.textContent = error.message; });
