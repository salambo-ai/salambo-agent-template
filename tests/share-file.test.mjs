// Shared copy: identical in lisa, odoo-accounting-agent and salambo-agent-template (SAL-928).
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import shareFileExtension from '../.pi/extensions/share-file.mjs';

const TOKEN = 'artifact-token-secret-value';
const UPLOAD_URL = 'https://app.example.test/api/runtime/artifacts';

test('share_file registers one tool whose description forbids sandbox paths', () => {
  const tools = captureTools(shareFileExtension);
  assert.deepEqual([...tools.keys()], ['share_file']);
  const tool = tools.get('share_file');
  assert.match(tool.description, /Never reply with a sandbox: or \/workspace path/);
  assert.deepEqual(tool.parameters.required, ['path']);
});

test('share_file uploads the raw bytes with the artifact headers', async () => {
  await withWorkspace(async ({ root }) => {
    const bytes = Buffer.from('date,amount\n2026-10-01,12.50\n');
    await writeFile(path.join(root, 'outputs', 'sample_report.csv'), bytes);

    const requests = [];
    await withFetch(async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({ success: true });
    }, async () => {
      const result = await run({ path: '/workspace/outputs/sample_report.csv' }, root);

      assert.equal(
        result.content[0].text,
        'Shared sample_report.csv. It will be attached to your reply as a download link.',
      );
    });

    assert.equal(requests.length, 1);
    const { url, options } = requests[0];
    assert.equal(url, UPLOAD_URL);
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'text/csv',
      'Content-Length': String(bytes.byteLength),
      'x-display-path': '/sample_report.csv',
      'x-file-name': 'sample_report.csv',
    });
    assert.deepEqual(Buffer.from(options.body), bytes);
  });
});

test('share_file lets the caller rename the file and keeps the display path logical', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'work', 'deep', 'out.bin'), 'x');

    const headers = await captureHeaders(root, {
      path: 'work/deep/out.bin',
      name: '../reports/Résumé Q3.pdf',
    });

    assert.equal(headers['x-display-path'], '/Resume-Q3.pdf');
    assert.equal(headers['x-file-name'], 'Resume-Q3.pdf');
    assert.equal(headers['Content-Type'], 'application/pdf');
  });
});

test('share_file defaults to the basename and application/octet-stream', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'work', 'deep', 'dump.unknown'), 'x');

    const headers = await captureHeaders(root, { path: 'work/deep/dump.unknown' });

    assert.equal(headers['x-display-path'], '/dump.unknown');
    assert.equal(headers['Content-Type'], 'application/octet-stream');
  });
});

test('share_file refuses a symlink that escapes the workspace', async () => {
  await withWorkspace(async ({ root, outside }) => {
    await writeFile(path.join(outside, 'secret.txt'), 'private');
    await symlink(path.join(outside, 'secret.txt'), path.join(root, 'outputs', 'link.txt'));

    await assertRefused(root, { path: '/workspace/outputs/link.txt' }, /inside \/workspace/);
  });
});

test('share_file refuses a path outside the workspace', async () => {
  await withWorkspace(async ({ root, outside }) => {
    await writeFile(path.join(outside, 'secret.txt'), 'private');

    await assertRefused(root, { path: path.join(outside, 'secret.txt') }, /inside \/workspace/);
    await assertRefused(root, { path: '../outside/secret.txt' }, /inside \/workspace|does not exist/);
  });
});

test('share_file refuses a directory', async () => {
  await withWorkspace(async ({ root }) => {
    await assertRefused(root, { path: '/workspace/outputs' }, /not directories/);
  });
});

test('share_file refuses a file over 100 MB without reading it', async () => {
  await withWorkspace(async ({ root }) => {
    const file = path.join(root, 'outputs', 'huge.bin');
    const handle = await open(file, 'w');
    await handle.truncate(100 * 1024 * 1024 + 1);
    await handle.close();

    await assertRefused(root, { path: file }, /over the 100 MB limit/);
  });
});

test('share_file refuses a missing file', async () => {
  await withWorkspace(async ({ root }) => {
    await assertRefused(root, { path: '/workspace/outputs/nope.csv' }, /does not exist/);
  });
});

test('share_file surfaces a 401 and a 413 as clear errors without the token', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'outputs', 'a.csv'), 'a');

    for (const [status, pattern] of [
      [401, /HTTP 401 \(the upload token is missing, invalid or expired\)/],
      [413, /HTTP 413 \(the file is over the 100 MB limit\)/],
      [500, /HTTP 500/],
    ]) {
      const error = await rejection(root, { path: '/workspace/outputs/a.csv' }, async () =>
        jsonResponse({ error: `Rejected ${TOKEN}` }, status),
      );

      assert.match(error.message, pattern);
      assert.match(error.message, /Sharing a\.csv failed/);
      assert.doesNotMatch(error.message, new RegExp(TOKEN));
    }
  });
});

test('share_file does not forward the platform answer, which can echo sandbox paths', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'outputs', 'a.csv'), 'a');

    const error = await rejection(root, { path: '/workspace/outputs/a.csv' }, async () =>
      jsonResponse({ error: "ENOENT: open '/workspace/outputs/a.csv'" }, 400),
    );

    assert.equal(error.message, 'Sharing a.csv failed with HTTP 400 (the platform refused the file).');
  });
});

test('share_file accepts a workspace file whose name starts with two dots', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'outputs', '..report.csv'), 'a');

    const headers = await captureHeaders(root, { path: '/workspace/outputs/..report.csv' });

    assert.equal(headers['x-display-path'], '/report.csv');
  });
});

test('share_file does not leak the token when the endpoint is unreachable', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'outputs', 'a.csv'), 'a');

    const error = await rejection(root, { path: '/workspace/outputs/a.csv' }, async () => {
      throw new Error(`connect failed with Bearer ${TOKEN}`);
    });

    assert.match(error.message, /could not be reached/);
    assert.doesNotMatch(error.message, new RegExp(TOKEN));
  });
});

test('share_file says sharing is unavailable when the run has no upload configuration', async () => {
  await withWorkspace(async ({ root }) => {
    await writeFile(path.join(root, 'outputs', 'a.csv'), 'a');

    await withEnvironment(
      { WORKSPACE_DIR: root, SALAMBO_ARTIFACT_UPLOAD_URL: '', SALAMBO_ARTIFACT_TOKEN: '' },
      async () => {
        await assert.rejects(
          captureTools(shareFileExtension).get('share_file').execute('call', { path: 'outputs/a.csv' }),
          /File sharing is not available for this run/,
        );
      },
    );
  });
});

test('share_file delivers the bytes and headers over real HTTP', async () => {
  await withWorkspace(async ({ root }) => {
    const bytes = Buffer.from('%PDF-1.4 hello');
    await writeFile(path.join(root, 'outputs', 'real.pdf'), bytes);

    const received = [];
    const server = http.createServer((request, response) => {
      const chunks = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => {
        received.push({ headers: request.headers, body: Buffer.concat(chunks) });
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ success: true }));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address();
      await withEnvironment(
        {
          WORKSPACE_DIR: root,
          SALAMBO_ARTIFACT_UPLOAD_URL: `http://127.0.0.1:${port}/upload`,
          SALAMBO_ARTIFACT_TOKEN: TOKEN,
        },
        async () => {
          await captureTools(shareFileExtension)
            .get('share_file')
            .execute('call', { path: path.join(root, 'outputs', 'real.pdf') });
        },
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    assert.equal(received.length, 1);
    assert.equal(received[0].headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(received[0].headers['x-display-path'], '/real.pdf');
    assert.equal(received[0].headers['content-type'], 'application/pdf');
    assert.equal(received[0].headers['content-length'], String(bytes.byteLength));
    assert.deepEqual(received[0].body, bytes);
  });
});

// A temp directory stands in for /workspace: absolute /workspace/... paths in a test
// are written against `root` by setting WORKSPACE_DIR, and a sibling directory is "outside".
async function withWorkspace(operation) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'share-file-'));
  const root = path.join(base, 'workspace');
  const outside = path.join(base, 'outside');
  await mkdir(path.join(root, 'outputs'), { recursive: true });
  await mkdir(path.join(root, 'work', 'deep'), { recursive: true });
  await mkdir(outside, { recursive: true });
  try {
    await operation({ root, outside });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

async function run(params, root) {
  return withEnvironment(
    {
      WORKSPACE_DIR: root,
      SALAMBO_ARTIFACT_UPLOAD_URL: UPLOAD_URL,
      SALAMBO_ARTIFACT_TOKEN: TOKEN,
    },
    () =>
      captureTools(shareFileExtension)
        .get('share_file')
        .execute('call', rebaseWorkspacePath(params, root)),
  );
}

// The tool is given the documented /workspace/... path; map it onto the temp workspace.
function rebaseWorkspacePath(params, root) {
  return params.path.startsWith('/workspace/')
    ? { ...params, path: path.join(root, params.path.slice('/workspace/'.length)) }
    : params;
}

async function captureHeaders(root, params) {
  let headers;
  await withFetch(async (_url, options) => {
    headers = options.headers;
    return jsonResponse({ success: true });
  }, () => run(params, root));
  return headers;
}

async function assertRefused(root, params, pattern) {
  let called = false;
  await withFetch(async () => {
    called = true;
    return jsonResponse({ success: true });
  }, async () => {
    await assert.rejects(run(params, root), (error) => {
      assert.match(error.message, pattern);
      assert.doesNotMatch(error.message, new RegExp(TOKEN));
      return true;
    });
  });
  assert.equal(called, false, 'a refused file must not be uploaded');
}

async function rejection(root, params, fetchMock) {
  let caught;
  await withFetch(fetchMock, async () => {
    await run(params, root).catch((error) => {
      caught = error;
    });
  });
  assert.ok(caught, 'expected share_file to reject');
  return caught;
}

function captureTools(factory) {
  const tools = new Map();
  factory({
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  });
  return tools;
}

async function withFetch(mock, operation) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await operation();
  } finally {
    globalThis.fetch = original;
  }
}

async function withEnvironment(values, operation) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
