import "./Header.css";

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <img src="/verax-logo-circle.svg" alt="" className="header-logo" height={28} width={28} />
        <h1 className="header-title">Proof of Audit</h1>
      </div>
    </header>
  );
};

export default Header;
