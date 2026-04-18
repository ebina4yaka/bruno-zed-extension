/**
 * Minimal LSP server for formatting Bruno files using prettify-bru as the backend.
 * Registered as a separate server because bruno-language-server does not support formatting.
 */
import { spawnSync } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve the prettify-bru CLI path relative to the extension root
const PRETTIFY_BRU_CLI = join(
  __dirname,
  "..",
  "node_modules",
  "prettify-bru",
  "cli.js"
);

// 起動時に一度だけ存在確認。毎回の format では再チェックしない
const PRETTIFY_BRU_AVAILABLE = existsSync(PRETTIFY_BRU_CLI);

// Keep the latest text of each open document so formatting can read it
const documents = new Map();

function sendMessage(msg) {
  const content = JSON.stringify(msg);
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`
  );
}

// MessageType: 1=Error, 2=Warning, 3=Info, 4=Log
function logMessage(type, message) {
  sendMessage({ jsonrpc: "2.0", method: "window/logMessage", params: { type, message } });
}

function showMessage(type, message) {
  sendMessage({ jsonrpc: "2.0", method: "window/showMessage", params: { type, message } });
}

function logStderr(prefix, stderr) {
  if (!stderr) return;
  for (const line of stderr.split("\n")) {
    if (line.trim()) logMessage(2, `${prefix}: ${line}`);
  }
}

/**
 * prettify-bru で .bru ファイルを整形する。
 * @returns {{ ok: true, text: string } | { ok: false, kind: string, [key: string]: unknown }}
 */
function formatDocument(content) {
  if (!PRETTIFY_BRU_AVAILABLE) {
    return { ok: false, kind: "cli_missing" };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "prettify-bru-"));
  const tmpFile = join(tmpDir, "temp.bru");
  try {
    writeFileSync(tmpFile, content, "utf8");

    logMessage(4, `Bruno Formatter [debug] node: ${process.execPath}`);
    logMessage(4, `Bruno Formatter [debug] cli: ${PRETTIFY_BRU_CLI} (exists=${existsSync(PRETTIFY_BRU_CLI)})`);
    logMessage(4, `Bruno Formatter [debug] tmpFile: ${tmpFile}`);
    logMessage(4, `Bruno Formatter [debug] content length: ${content.length}`);

    // prettify-bru は引数パスを cwd と結合するため絶対パスを渡せない。
    // cwd を tmpDir にして引数なしで起動することで temp.bru をディレクトリ探索させる。
    const result = spawnSync(
      process.execPath,
      [PRETTIFY_BRU_CLI, "--write"],
      { stdio: "pipe", encoding: "utf8", timeout: 5000, cwd: tmpDir }
    );

    logMessage(4, `Bruno Formatter [debug] exit status: ${result.status}`);
    logMessage(4, `Bruno Formatter [debug] signal: ${result.signal}`);
    logMessage(4, `Bruno Formatter [debug] error: ${result.error ? result.error.message : "none"}`);
    if (result.stdout) logMessage(4, `Bruno Formatter [debug] stdout: ${result.stdout}`);
    if (result.stderr) logMessage(4, `Bruno Formatter [debug] stderr: ${result.stderr}`);

    if (result.error) {
      return { ok: false, kind: "spawn_error", error: result.error };
    }
    if (result.status === null && result.signal) {
      return { ok: false, kind: "signal", signal: result.signal };
    }

    let text;
    try {
      text = readFileSync(tmpFile, "utf8");
    } catch (e) {
      return { ok: false, kind: "read_error", error: e };
    }

    logMessage(4, `Bruno Formatter [debug] formatted length: ${text.length}, changed: ${text !== content}`);

    // exit 1 でも tmpFile が書き換えられていれば整形成功とみなす
    // (prettify-bru のバージョンによって exit code が異なる可能性があるため)
    if (result.status !== 0 && text === content) {
      return {
        ok: false,
        kind: "parse_error",
        stderr: result.stderr ?? "",
        stdout: result.stdout ?? "",
        status: result.status,
      };
    }

    return { ok: true, text };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}
  }
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      sendMessage({
        jsonrpc: "2.0",
        id,
        result: {
          capabilities: {
            // Full-text sync so the server always has the current buffer content
            textDocumentSync: 1,
            documentFormattingProvider: true,
          },
        },
      });
      break;

    case "initialized":
      // CLI が見つからない場合は起動時に通知して原因をユーザーに伝える
      if (!PRETTIFY_BRU_AVAILABLE) {
        logMessage(1, `Bruno Formatter: prettify-bru CLI not found at ${PRETTIFY_BRU_CLI}. Run 'zed: extensions' and reinstall the Bruno extension.`);
        showMessage(1, "Bruno Formatter: prettify-bru CLI not found. Reinstall the Bruno extension to fix this.");
      }
      break;

    case "textDocument/didOpen":
      documents.set(params.textDocument.uri, params.textDocument.text);
      break;

    case "textDocument/didChange":
      if (params.contentChanges.length > 0) {
        documents.set(
          params.textDocument.uri,
          params.contentChanges[params.contentChanges.length - 1].text
        );
      }
      break;

    case "textDocument/didClose":
      documents.delete(params.textDocument.uri);
      break;

    case "textDocument/formatting": {
      const content = documents.get(params.textDocument.uri) ?? "";
      const result = formatDocument(content);

      if (!result.ok) {
        switch (result.kind) {
          case "cli_missing":
            logMessage(1, `Bruno Formatter: prettify-bru CLI not found at ${PRETTIFY_BRU_CLI}.`);
            showMessage(1, "Bruno Formatter: prettify-bru not found. Reinstall the Bruno extension.");
            break;
          case "spawn_error":
            logMessage(1, `Bruno Formatter: failed to start prettify-bru — ${result.error.message}`);
            showMessage(1, `Bruno Formatter: failed to start prettify-bru (${result.error.code ?? result.error.message})`);
            break;
          case "signal":
            logMessage(2, `Bruno Formatter: prettify-bru terminated by signal ${result.signal}`);
            break;
          case "parse_error":
            logMessage(2, `Bruno Formatter: prettify-bru exited with status ${result.status}`);
            logStderr("Bruno Formatter stderr", result.stderr);
            if (result.stderr) {
              showMessage(2, `Bruno Formatter: ${result.stderr.split("\n")[0].trim()}`);
            }
            break;
          case "read_error":
            logMessage(1, `Bruno Formatter: failed to read formatted output — ${result.error.message}`);
            showMessage(1, "Bruno Formatter: failed to read formatted output.");
            break;
        }
        sendMessage({ jsonrpc: "2.0", id, result: [] });
        break;
      }

      const formatted = result.text;
      if (formatted === content) {
        logMessage(4, "Bruno Formatter: no changes");
        sendMessage({ jsonrpc: "2.0", id, result: [] });
        break;
      }

      logMessage(4, `Bruno Formatter: formatted ${Buffer.byteLength(formatted)} bytes`);
      const lines = content.split("\n");
      sendMessage({
        jsonrpc: "2.0",
        id,
        result: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: {
                line: lines.length - 1,
                character: lines[lines.length - 1].length,
              },
            },
            newText: formatted,
          },
        ],
      });
      break;
    }

    case "shutdown":
      sendMessage({ jsonrpc: "2.0", id, result: null });
      break;

    case "exit":
      process.exit(0);
      break;
  }
}

// 想定外の例外を Zed に通知して LSP 停止を防ぐ
process.on("uncaughtException", (err) => {
  try {
    logMessage(1, `Bruno Formatter: uncaught exception — ${err.message}\n${err.stack}`);
  } catch {}
});
process.on("unhandledRejection", (reason) => {
  try {
    logMessage(1, `Bruno Formatter: unhandled rejection — ${reason}`);
  } catch {}
});

// Parse the LSP Content-Length framing from stdin
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const headers = buffer.slice(0, headerEnd);
    const match = headers.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;

    const contentLength = parseInt(match[1]);
    const contentStart = headerEnd + 4;
    if (buffer.length < contentStart + contentLength) break;

    const content = buffer.slice(contentStart, contentStart + contentLength);
    buffer = buffer.slice(contentStart + contentLength);

    try {
      handleMessage(JSON.parse(content));
    } catch {}
  }
});
