import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error("CHROME_PATH must point to a Chromium executable");
const expectMissingConfig = process.argv.includes("--expect-missing-config");

const reservePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
};

const waitFor = async (description, predicate, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError });
};

class DevTools {
  #socket;
  #nextId = 0;
  #pending = new Map();
  #listeners = new Map();

  constructor(url) {
    this.#socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.#socket.addEventListener("open", resolve, { once: true });
      this.#socket.addEventListener("error", reject, { once: true });
    });
    this.#socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.#pending.get(message.id);
        if (pending) {
          this.#pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        }
        return;
      }
      for (const listener of this.#listeners.get(message.method) ?? []) {
        listener(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.#nextId;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.#pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
      }, 10_000).unref();
    });
  }

  on(method, callback) {
    const listeners = this.#listeners.get(method) ?? [];
    listeners.push(callback);
    this.#listeners.set(method, listeners);
  }

  close() {
    this.#socket.close();
  }
}

const evaluate = async (cdp, expression) => {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  }
  return result.result?.value;
};

const waitForDom = (cdp, expression, description) => waitFor(description, async () => evaluate(cdp, expression));

const tempRoot = await mkdtemp(join("/tmp", "poa-wallet-browser-"));
const profile = join(tempRoot, "profile");
await mkdir(profile);
const previewPort = await reservePort();
const cdpPort = await reservePort();
const preview = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"],
  { stdio: "ignore", env: process.env },
);
let chrome;
let cdp;
let chromeStderr = "";

try {
  await waitFor("Vite preview", async () => {
    try {
      return (await fetch(`http://127.0.0.1:${previewPort}/`)).ok;
    } catch {
      return false;
    }
  });

  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      `http://127.0.0.1:${previewPort}/`,
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, TMPDIR: "/tmp" },
    },
  );
  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (chunk) => {
    chromeStderr = `${chromeStderr}${chunk}`.slice(-4_000);
  });

  await waitFor("Chrome DevTools endpoint", async () => {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited (${chrome.exitCode}): ${chromeStderr}`);
    }
    try {
      return (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok;
    } catch {
      return false;
    }
  });
  const targets = await waitFor("Chrome page target", async () => {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const pages = await response.json();
    return pages.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  });
  cdp = new DevTools(targets.webSocketDebuggerUrl);
  await cdp.ready;

  let failureInjected = false;
  let blockWalletChunkRequests = !expectMissingConfig;
  const externalRequests = [];
  const walletChunkUrls = [];
  let loadEvents = 0;
  cdp.on("Page.loadEventFired", () => {
    loadEvents += 1;
  });
  cdp.on("Fetch.requestPaused", async (request) => {
    if (request.request.url.includes("WalletApp-")) {
      if (blockWalletChunkRequests) {
        failureInjected = true;
        await cdp.send("Fetch.failRequest", {
          requestId: request.requestId,
          errorReason: "Failed",
        });
        return;
      }
    }
    await cdp.send("Fetch.continueRequest", { requestId: request.requestId });
  });
  cdp.on("Network.requestWillBeSent", ({ request }) => {
    if (request.url.includes("WalletApp-")) walletChunkUrls.push(request.url);
    if (/^https?:/.test(request.url) && !request.url.startsWith(`http://127.0.0.1:${previewPort}/`)) {
      externalRequests.push(request.url);
    }
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__walletUnhandled = []; window.addEventListener('unhandledrejection', e => window.__walletUnhandled.push(String(e.reason)))`,
  });
  await cdp.send("Fetch.enable", {
    patterns: [{ urlPattern: "*WalletApp-*.js", requestStage: "Request" }],
  });
  await waitForDom(
    cdp,
    `document.querySelector('button.start-button')?.textContent?.trim() === 'Start attestation'`,
    "landing UI",
  );
  await evaluate(
    cdp,
    `window.__walletUnhandled = []; window.addEventListener('unhandledrejection', e => window.__walletUnhandled.push(String(e.reason)))`,
  );
  await delay(300);
  const startup = await evaluate(
    cdp,
    `({ walletButton: Boolean(document.querySelector('appkit-button')), walletChunk: performance.getEntriesByType('resource').some(e => e.name.includes('WalletApp-')) })`,
  );
  if (startup.walletButton || startup.walletChunk || externalRequests.length) {
    throw new Error(`Unexpected work before interaction: ${JSON.stringify({ startup, externalRequests })}`);
  }

  await evaluate(cdp, `document.querySelector('button.start-button').click()`);
  if (expectMissingConfig) {
    await delay(1_000);
    const outcome = await evaluate(
      cdp,
      `({ alert: document.querySelector('[role="alert"]')?.innerText, body: document.body.innerText.slice(-700), footer: Boolean(document.querySelector('footer')), walletChunk: performance.getEntriesByType('resource').some(e => e.name.includes('WalletApp-')), unhandled: window.__walletUnhandled ?? [] })`,
    );
    if (!outcome.alert?.includes("Wallet setup is missing")) {
      throw new Error(`Missing-config build did not expose the expected accessible error: ${JSON.stringify(outcome)}`);
    }
    if (
      outcome.alert.includes("VITE_WALLETCONNECT_PROJECT_ID") ||
      outcome.alert.includes("A project id is not invented here")
    ) {
      throw new Error(
        `Missing-config user message leaked operator configuration details: ${JSON.stringify(outcome.alert)}`,
      );
    }
    if (!outcome.footer || outcome.walletChunk || outcome.unhandled.length) {
      throw new Error(`Missing configuration did not fail safely: ${JSON.stringify(outcome)}`);
    }
    console.log(
      JSON.stringify(
        {
          status: "passed",
          startup,
          missingConfigError: true,
          contentInfoPreserved: outcome.contentInfo,
          unhandledRejections: outcome.unhandled.length,
          externalRequestsBeforeInteraction: externalRequests.length,
        },
        null,
        2,
      ),
    );
  } else {
    try {
      await waitForDom(
        cdp,
        `document.querySelector('[role="alert"]')?.textContent?.includes('Wallet failed to load. Check your connection.')`,
        "accessible chunk failure state",
      );
    } catch (error) {
      const diagnostic = await evaluate(
        cdp,
        `({ alert: document.querySelector('[role="alert"]')?.innerText, body: document.body.innerText.slice(-700), walletChunkRequests: performance.getEntriesByType('resource').filter(e => e.name.includes('WalletApp-')).map(e => e.name), unhandled: window.__walletUnhandled ?? [] })`,
      );
      throw new Error(`Wallet chunk failure state was not rendered: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    if (!failureInjected) throw new Error("The browser did not request the lazy wallet chunk");

    blockWalletChunkRequests = false;
    const beforeRetryLoads = loadEvents;
    await evaluate(cdp, `document.querySelector('[role="alert"] button')?.click()`);
    await waitFor("fresh document after retry", () => loadEvents > beforeRetryLoads);
    await waitForDom(
      cdp,
      `document.querySelector('button.start-button')?.textContent?.trim() === 'Start attestation'`,
      "reloaded landing UI",
    );
    const outcome = await evaluate(
      cdp,
      `({ walletButton: Boolean(document.querySelector('appkit-button')), walletChunk: performance.getEntriesByType('resource').some(e => e.name.includes('WalletApp-')), unhandled: window.__walletUnhandled ?? [] })`,
    );
    if (outcome.walletButton || outcome.walletChunk) {
      throw new Error(
        `The retry page performed wallet bootstrap before a new explicit start: ${JSON.stringify(outcome)}`,
      );
    }
    if (outcome.unhandled.length) {
      throw new Error(`Unhandled promise rejection(s): ${JSON.stringify(outcome.unhandled)}`);
    }
    console.log(
      JSON.stringify(
        {
          status: "passed",
          startup,
          injectedChunkFailure: failureInjected,
          retryReturnedToLanding: true,
          unhandledRejections: outcome.unhandled.length,
          externalRequestsBeforeInteraction: externalRequests.length,
        },
        null,
        2,
      ),
    );
  }
} finally {
  cdp?.close();
  for (const process of [chrome, preview]) {
    if (process && process.exitCode === null) process.kill("SIGTERM");
  }
  await Promise.all(
    [chrome, preview].filter(Boolean).map(async (process) => {
      if (process.exitCode !== null) return;
      await Promise.race([
        once(process, "exit"),
        delay(3_000).then(() => {
          if (process.exitCode === null) process.kill("SIGKILL");
        }),
      ]);
      if (process.exitCode === null) await once(process, "exit");
    }),
  );
  await rm(tempRoot, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
