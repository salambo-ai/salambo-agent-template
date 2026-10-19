// Shared copy: this file is identical in salambo-ai/lisa, salambo-ai/odoo-accounting-agent
// and salambo-ai/salambo-agent-template (SAL-928). Change all three together.
import { open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

const CONTENT_TYPES = {
  '.csv': 'text/csv',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.svg': 'image/svg+xml',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
};

const STATUS_HINTS = {
  400: 'the platform refused the file',
  401: 'the upload token is missing, invalid or expired',
  413: 'the file is over the 100 MB limit',
  500: 'file sharing is not configured on the platform',
};

export default function extension(pi) {
  pi.registerTool({
    name: 'share_file',
    label: 'Share File',
    description:
      'Share a file from the workspace with the user. Use this whenever the user should receive a file (report, CSV, PDF, export). Never reply with a sandbox: or /workspace path; the user cannot open it. The file is attached to your reply as a download link.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path of the file under /workspace, for example /workspace/outputs/report.csv.',
        },
        name: {
          type: 'string',
          description: 'Optional file name the user sees. Defaults to the file name in path.',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params, signal) {
      const upload = requireUploadConfiguration();
      const file = await readWorkspaceFile(requireString(params?.path, 'path'));
      const name = displayName(optionalString(params?.name), file.baseName);
      const contentType = guessContentType(name);

      await uploadFile({ upload, file, name, contentType, signal });

      return {
        content: [
          {
            type: 'text',
            text: `Shared ${name}. It will be attached to your reply as a download link.`,
          },
        ],
        details: { name, sizeBytes: file.bytes.byteLength, contentType },
      };
    },
  });
}

function requireUploadConfiguration() {
  const url = process.env.SALAMBO_ARTIFACT_UPLOAD_URL?.trim();
  const token = process.env.SALAMBO_ARTIFACT_TOKEN?.trim();
  if (!url || !token) throw new Error('File sharing is not available for this run.');
  return { url, token };
}

async function readWorkspaceFile(requested) {
  const workspaceRoot = await realpath(
    path.resolve(process.env.WORKSPACE_DIR || '/workspace'),
  ).catch(() => {
    throw new Error('The workspace is not available.');
  });
  const candidate = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(workspaceRoot, requested);
  const handle = await openContainedFile(workspaceRoot, candidate);
  try {
    return { baseName: path.basename(candidate), bytes: await readBoundedFile(handle) };
  } finally {
    await handle.close();
  }
}

// Opens the file, then checks that the path still resolves to the very same inode inside the
// workspace. A symlink swapped in before the open is caught here: the descriptor and the path
// would name different files.
async function openContainedFile(workspaceRoot, candidate) {
  const resolvedBefore = await realpath(candidate).catch(() => {
    throw new Error('The file does not exist in the workspace.');
  });
  if (!isInside(workspaceRoot, resolvedBefore)) {
    throw new Error('Only files inside /workspace can be shared.');
  }

  const handle = await open(resolvedBefore, 'r').catch(() => {
    throw new Error('The file cannot be read.');
  });
  try {
    await assertStillTheSameFile(handle, workspaceRoot, candidate);
  } catch (error) {
    await handle.close();
    throw error;
  }
  return handle;
}

async function assertStillTheSameFile(handle, workspaceRoot, candidate) {
  const opened = await handle.stat();
  const resolvedAfter = await realpath(candidate).catch(() => undefined);
  const current = resolvedAfter && (await stat(resolvedAfter).catch(() => undefined));
  if (!current || !isInside(workspaceRoot, resolvedAfter)) {
    throw new Error('Only files inside /workspace can be shared.');
  }
  if (current.ino !== opened.ino || current.dev !== opened.dev) {
    throw new Error('Only files inside /workspace can be shared.');
  }
}

// Reads at most the stat size plus one byte, so a file that grows after the check never
// allocates more than the 100 MB limit.
async function readBoundedFile(handle) {
  const metadata = await handle.stat();
  if (!metadata.isFile()) throw new Error('Only files can be shared, not directories.');
  if (metadata.size > MAX_FILE_BYTES) throw new Error('The file is over the 100 MB limit.');

  const buffer = Buffer.alloc(metadata.size + 1);
  let filled = 0;
  while (filled < buffer.length) {
    const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, filled);
    if (bytesRead === 0) break;
    filled += bytesRead;
  }
  if (filled !== metadata.size) throw new Error('The file changed while it was being read.');
  return buffer.subarray(0, filled);
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return (
    Boolean(relative) &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

// Same rules as the platform's artifact file names, so the display path is predictable
// and header-safe: no directories, ASCII letters, digits, dot, dash and underscore.
function displayName(requestedName, fallbackName) {
  return sanitizeName(requestedName) || sanitizeName(fallbackName) || 'file';
}

function sanitizeName(value) {
  if (!value) return '';
  return path.posix
    .basename(value.replace(/\\/g, '/'))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 160);
}

function guessContentType(name) {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

async function uploadFile({ upload, file, name, contentType, signal }) {
  let response;
  try {
    response = await fetch(upload.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upload.token}`,
        'Content-Type': contentType,
        'Content-Length': String(file.bytes.byteLength),
        'x-display-path': `/${name}`,
        'x-file-name': name,
      },
      body: file.bytes,
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new Error(`Sharing ${name} failed: the upload endpoint could not be reached.`);
  }

  if (!response.ok) throw new Error(uploadFailureMessage(name, response.status));
}

// The platform's answer body is not forwarded: it can echo paths from the run.
function uploadFailureMessage(name, status) {
  const hint = STATUS_HINTS[status];
  return `Sharing ${name} failed with HTTP ${status}${hint ? ` (${hint})` : ''}.`;
}

function requireString(value, label) {
  const normalized = optionalString(value);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
