import "./Footer.css";
import LogoVerax from "../assets/logo-verax.svg";

const GithubIcon = () => (
  <svg aria-hidden="true" fill="currentColor" focusable="false" height="24" viewBox="0 0 24 24" width="24">
    <path d="M12 0C5.37 0 0 5.48 0 12.24c0 5.4 3.44 9.98 8.2 11.6.6.12.82-.27.82-.59 0-.29-.01-1.06-.02-2.08-3.34.74-4.04-1.64-4.04-1.64-.55-1.41-1.34-1.79-1.34-1.79-1.08-.75.09-.73.09-.73 1.2.09 1.83 1.25 1.83 1.25 1.07 1.86 2.8 1.33 3.48 1.01.11-.79.42-1.33.76-1.64-2.66-.31-5.46-1.36-5.46-6.04 0-1.34.47-2.43 1.24-3.28-.12-.31-.54-1.56.12-3.24 0 0 1.01-.33 3.3 1.25A11.3 11.3 0 0 1 12 5.86c1.02.01 2.04.14 3 .42 2.29-1.58 3.3-1.25 3.3-1.25.66 1.68.24 2.93.12 3.24.77.85 1.24 1.94 1.24 3.28 0 4.7-2.81 5.73-5.49 6.03.43.38.81 1.12.81 2.26 0 1.64-.01 2.96-.01 3.36 0 .33.21.71.82.59A12.24 12.24 0 0 0 24 12.24C24 5.48 18.63 0 12 0Z" />
  </svg>
);

const XIcon = () => (
  <svg aria-hidden="true" fill="currentColor" focusable="false" height="24" viewBox="0 0 16 16" width="24">
    <path d="M12.6.75h2.45L9.69 6.89 16 15.25h-4.94L7.2 10.18l-4.43 5.07H.32l5.73-6.57L0 .75h5.06l3.5 4.63L12.6.75Zm-.86 13.03h1.36L4.32 2.15H2.87l8.87 11.63Z" />
  </svg>
);

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="copyright">
          By{" "}
          <a href="https://alainnicolas.fr/en/" target="_blank" rel="noopener noreferrer">
            Alain Nicolas
          </a>
        </p>
        <div className="footer-links">
          <a
            href="https://www.ver.ax"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="Verax website"
          >
            <img src={LogoVerax} alt="Verax logo" height={24} width={24} />
          </a>
          <a
            href="https://github.com/Consensys/linea-attestation-registry/tree/dev/proof-of-audit"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="GitHub repository"
          >
            <GithubIcon />
          </a>
          <a
            href="https://x.com/Alain_Ncls"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="X profile"
          >
            <XIcon />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
