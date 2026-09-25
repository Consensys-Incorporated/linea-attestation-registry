const toggle = document.querySelector("[data-menu-toggle]");
const nav = toggle && document.getElementById(toggle.getAttribute("aria-controls"));
const mobileQuery = window.matchMedia("(max-width: 767.98px)");
const backgroundContent = document.querySelectorAll("main, footer");

function setMenuOpen(open) {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  nav.classList.toggle("site-nav--open", open);
  document.documentElement.classList.toggle("menu-open", open);
  backgroundContent.forEach((element) => {
    element.inert = open;
  });
}

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setMenuOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      toggle.focus();
    }
  });

  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      setMenuOpen(false);
    }
  });
}
