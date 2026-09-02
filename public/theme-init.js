(function () {
  try {
    var theme = localStorage.getItem("synapse-theme");
    if (
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
})();
