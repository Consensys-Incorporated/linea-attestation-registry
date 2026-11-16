import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  envFile: false,
  logLevel: "error",
  appType: "custom",
  server: {
    middlewareMode: true,
  },
});

try {
  await server.ssrLoadModule("/src/wagmiConfig.ts");
  console.error("wagmiConfig evaluated without VITE_WALLETCONNECT_PROJECT_ID");
  process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const details = `${message}\n${error instanceof Error ? error.stack : ""}`;
  if (!details.includes("Missing VITE_WALLETCONNECT_PROJECT_ID")) {
    console.error(details);
    process.exitCode = 1;
  } else {
    console.log("Missing VITE_WALLETCONNECT_PROJECT_ID rejected wagmiConfig evaluation");
  }
} finally {
  await server.close();
}
