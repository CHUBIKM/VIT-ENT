const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../server');

test('AI routes isolate request keys, reject missing keys and redact provider errors', async (t) => {
  const seen = [];
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'server-key-must-not-be-used';
  const { server, close } = startServer({
    port: 0, authDbPath: ':memory:', poseDbPath: ':memory:',
    aiFetch: async (_url, options) => {
      seen.push(options.headers.Authorization);
      if (options.headers.Authorization === 'Bearer rejected-key') {
        return new Response(JSON.stringify({ error: { message: 'rejected-key secret detail' } }), { status: 401 });
      }
      const body = JSON.parse(options.body);
      return body.stream
        ? new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n')
        : new Response(JSON.stringify({ choices: [{ message: { content: 'Hello' } }] }));
    }
  });
  t.after(() => {
    server.close(); close();
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, key) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body)
  });
  for (const route of ['/api/qwen-chat', '/api/qwen-chat-stream']) {
    assert.equal((await post(route, { message: 'hello' })).status, 401);
    assert.equal((await post(route, { message: 'hello' }, 'invalid key')).status, 401);
  }
  assert.equal(seen.length, 0);
  const responses = await Promise.all([
    post('/api/qwen-chat', { message: 'hello' }, 'user-a'),
    post('/api/qwen-chat-stream', { message: 'hello' }, 'user-b')
  ]);
  assert.equal((await responses[0].json()).reply, 'Hello');
  assert.equal(await responses[1].text(), 'Hello');
  assert.deepEqual([...seen].sort(), ['Bearer user-a', 'Bearer user-b']);
  await post('/api/pose/sessions', { userEmail: 'tester@example.com', exercise: 'general' });
  assert.equal((await post('/api/pose/sessions/latest/llm-analyze', { userEmail: 'tester@example.com' })).status, 401);
  const analysis = await post('/api/pose/sessions/latest/llm-analyze', { userEmail: 'tester@example.com' }, 'user-c');
  assert.equal((await analysis.json()).analysis, 'Hello');
  assert.equal(seen.at(-1), 'Bearer user-c');
  const failure = await post('/api/qwen-chat', { message: 'hello' }, 'rejected-key');
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /rejected-key|secret detail/);
});
