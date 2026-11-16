import { Component, type ComponentType, type ReactNode, Suspense, lazy, useCallback, useState } from "react";

import "./App.css";
import Analytics from "./components/Analytics.tsx";
import Footer from "./components/Footer.tsx";
import Header from "./components/Header.tsx";

const loadWalletApp = () => import("./WalletApp.tsx");
type WalletAppModule = { default: ComponentType };
type WalletAppLoad = () => Promise<WalletAppModule>;

const walletAppFallback = (
  <p className="form-loading" role="status" aria-live="polite">
    Loading wallet…
  </p>
);
type WalletLoadErrorProps = {
  error: Error;
  onRetry: () => void;
};

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Wallet failed to load.");
};

const isMissingWalletConfig = (error: Error): boolean => error.message.includes("VITE_WALLETCONNECT_PROJECT_ID");

const isChunkLoadError = (error: Error): boolean =>
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    error.message,
  );

const walletLoadMessage = (error: Error): string => {
  if (isMissingWalletConfig(error)) {
    return "Wallet setup is missing. Contact the site owner.";
  }

  if (isChunkLoadError(error)) {
    return "Wallet failed to load. Check your connection.";
  }

  return "Wallet failed to load. Try again later.";
};

function WalletLoadError({ error, onRetry }: Readonly<WalletLoadErrorProps>) {
  return (
    <section className="panel wallet-load-error" role="alert">
      <h3 className="wallet-load-error-title">Wallet unavailable</h3>
      <p>{walletLoadMessage(error)}</p>
      <button type="button" className="start-button" onClick={onRetry}>
        Reload
      </button>
    </section>
  );
}

type WalletErrorBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
};

type WalletErrorBoundaryState = {
  error: Error | null;
};

class WalletErrorBoundary extends Component<WalletErrorBoundaryProps, WalletErrorBoundaryState> {
  state: WalletErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): WalletErrorBoundaryState {
    return { error: toError(error) };
  }

  render() {
    if (this.state.error) {
      return <WalletLoadError error={this.state.error} onRetry={this.props.onRetry} />;
    }

    return this.props.children;
  }
}

type AppProps = {
  loadWalletApp?: WalletAppLoad;
  reloadPage?: () => void;
  walletProjectId?: string;
};

const App = ({
  loadWalletApp: walletAppLoad = loadWalletApp,
  reloadPage = () => window.location.reload(),
  walletProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
}: Readonly<AppProps>) => {
  const [isWalletAppEnabled, setIsWalletAppEnabled] = useState(false);
  const [walletLoadAttempt, setWalletLoadAttempt] = useState(0);
  const [preloadError, setPreloadError] = useState<Error | null>(null);
  // Keep the lazy component outside Suspense so a suspended mount reuses it.
  const [WalletApp, setWalletApp] = useState(() => lazy(walletAppLoad));

  const preloadWalletApp = useCallback(() => {
    if (!walletProjectId) {
      setPreloadError(new Error("Missing VITE_WALLETCONNECT_PROJECT_ID environment variable"));
      return;
    }

    void walletAppLoad().catch((error: unknown) => {
      setPreloadError(toError(error));
    });
  }, [walletAppLoad, walletProjectId]);

  const startWalletApp = useCallback(() => {
    if (!walletProjectId) {
      setPreloadError(new Error("Missing VITE_WALLETCONNECT_PROJECT_ID environment variable"));
      return;
    }

    setIsWalletAppEnabled(true);
  }, [walletProjectId]);

  const retryWalletLoad = useCallback(() => {
    setPreloadError(null);
    setWalletLoadAttempt((attempt) => attempt + 1);
    setWalletApp(() => lazy(walletAppLoad));
    setIsWalletAppEnabled(true);
    reloadPage();
  }, [reloadPage, walletAppLoad]);

  let walletArea = (
    <section className="tool-start" aria-label="Start">
      <button
        type="button"
        className="start-button"
        onFocus={preloadWalletApp}
        onClick={startWalletApp}
        onPointerEnter={preloadWalletApp}
      >
        Start attestation
      </button>
    </section>
  );

  if (preloadError) {
    walletArea = <WalletLoadError error={preloadError} onRetry={retryWalletLoad} />;
  } else if (isWalletAppEnabled) {
    walletArea = (
      <WalletErrorBoundary key={walletLoadAttempt} onRetry={retryWalletLoad}>
        <Suspense fallback={walletAppFallback}>
          <WalletApp />
        </Suspense>
      </WalletErrorBoundary>
    );
  }

  return (
    <>
      <Header />
      <main className="main-container">
        <section className="intro" aria-labelledby="intro-title">
          <h2 className="intro-title" id="intro-title">
            Attest an audit
          </h2>
          <p className="intro-copy">Link an audited GitHub commit to a contract on Linea.</p>
        </section>
        {walletArea}
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

export default App;
