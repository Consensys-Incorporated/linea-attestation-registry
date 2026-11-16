import AuditForm from "./AuditForm.tsx";
import { Web3ModalProvider } from "./Web3ModalProvider.tsx";

const WalletApp = () => {
  return (
    <Web3ModalProvider>
      <AuditForm />
    </Web3ModalProvider>
  );
};

export default WalletApp;
