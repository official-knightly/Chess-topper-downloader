(() => {
  "use strict";

  const GITHUB_API = "https://api.github.com/repos/official-knightly";
  const DESKTOP_RELEASES = GITHUB_API + "/Chess-topper-app/releases/latest";
  const MOBILE_RELEASES = GITHUB_API + "/Chess-topper-mobile/releases/tags/mobile-latest";
  const EXTENSION_MANIFEST = "https://raw.githubusercontent.com/official-knightly/Chess-topper-extension/main/manifest.json";

  const byId = (id) => document.getElementById(id);
  const desktopFallback = "https://github.com/official-knightly/Chess-topper-app/releases/latest";
  const mobileFallback = "https://github.com/official-knightly/Chess-topper-mobile/releases/tag/mobile-latest";

  function safeGitHubUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && (parsed.hostname === "github.com" || parsed.hostname === "objects.githubusercontent.com") ? parsed.href : null;
    } catch {
      return null;
    }
  }

  async function getJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("GitHub returned " + response.status);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function installerAssets(assets) {
    return (Array.isArray(assets) ? assets : []).filter((asset) => {
      const name = String(asset.name || "").toLowerCase();
      return !name.endsWith(".blockmap") && !name.endsWith(".yml") && (
        name.endsWith(".exe") || name.endsWith(".dmg") || name.endsWith(".appimage") || name.endsWith(".deb")
      ) && safeGitHubUrl(asset.browser_download_url);
    });
  }

  function platformLabel(asset) {
    const name = String(asset.name || "").toLowerCase();
    if (name.endsWith(".exe")) return "Windows · x64";
    if (name.endsWith(".dmg")) return "macOS · Apple silicon";
    if (name.endsWith(".appimage")) return "Linux · AppImage";
    if (name.endsWith(".deb")) return "Linux · Debian";
    return asset.name || "Download";
  }

  function preferredAsset(assets) {
    const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
    const isWindows = platform.includes("win");
    const isMac = platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad");
    const isLinux = platform.includes("linux") || platform.includes("x11");
    if (isWindows) return assets.find((asset) => String(asset.name).toLowerCase().endsWith(".exe")) || null;
    if (isMac) return assets.find((asset) => String(asset.name).toLowerCase().endsWith(".dmg")) || null;
    if (isLinux) return assets.find((asset) => String(asset.name).toLowerCase().endsWith(".appimage")) ||
      assets.find((asset) => String(asset.name).toLowerCase().endsWith(".deb")) || null;
    return null;
  }

  function setButton(button, label, href) {
    const safeUrl = safeGitHubUrl(href);
    if (!button || !safeUrl) return;
    button.href = safeUrl;
    button.target = "_self";
    button.rel = "noreferrer";
    button.innerHTML = label + ' <span aria-hidden="true">↓</span>';
    button.setAttribute("aria-label", label);
    button.classList.remove("is-loading");
  }

  function appendAssetLink(container, asset, label) {
    const href = safeGitHubUrl(asset.browser_download_url);
    if (!container || !href) return;
    const link = document.createElement("a");
    link.href = href;
    link.target = "_self";
    link.rel = "noreferrer";
    link.textContent = label + (asset.size ? " · " + formatBytes(asset.size) : "");
    container.appendChild(link);
  }

  async function loadDesktop() {
    try {
      const release = await getJson(DESKTOP_RELEASES);
      const assets = installerAssets(release.assets);
      const version = release.tag_name || release.name || "Latest";
      byId("desktop-version").textContent = version;
      byId("hero-version").textContent = version;

      const primary = preferredAsset(assets);
      if (primary) {
        const suffix = String(primary.name).toLowerCase().endsWith(".exe") ? "Windows" :
          String(primary.name).toLowerCase().endsWith(".dmg") ? "macOS" :
          String(primary.name).toLowerCase().endsWith(".appimage") ? "Linux" : "Linux";
        setButton(byId("desktop-primary"), "Download for " + suffix, primary.browser_download_url);
      } else {
        setButton(byId("desktop-primary"), "Choose a desktop installer", release.html_url || desktopFallback);
      }

      const alternatives = byId("desktop-assets");
      alternatives.replaceChildren();
      assets.filter((asset) => asset !== primary).forEach((asset) => appendAssetLink(alternatives, asset, platformLabel(asset)));

      const date = formatDate(release.published_at);
      const footnote = byId("desktop-updated");
      footnote.textContent = date ? "Published " + date + " · " + assets.length + " installer option" + (assets.length === 1 ? "" : "s") : "Installer links are served by GitHub.";
      return { ok: true, version };
    } catch {
      byId("desktop-version").textContent = "See GitHub";
      byId("hero-version").textContent = "Latest";
      byId("desktop-updated").textContent = "Live release details could not load. Open GitHub to see current installers.";
      setButton(byId("desktop-primary"), "View desktop releases", desktopFallback);
      return { ok: false, version: "" };
    }
  }

  async function loadMobile() {
    try {
      const release = await getJson(MOBILE_RELEASES);
      const apkAssets = (Array.isArray(release.assets) ? release.assets : []).filter((asset) =>
        String(asset.name || "").toLowerCase().endsWith(".apk") && safeGitHubUrl(asset.browser_download_url)
      );
      const apk = apkAssets.find((asset) => String(asset.name).toLowerCase() === "chess.topper.apk") || apkAssets[0];
      byId("mobile-version").textContent = release.tag_name || release.name || "Latest";
      if (apk) {
        setButton(byId("mobile-primary"), "Download Android APK", apk.browser_download_url);
        byId("mobile-file").textContent = apk.name + (apk.size ? " · " + formatBytes(apk.size) : "") + (release.published_at ? " · Published " + formatDate(release.published_at) : "");
      } else {
        setButton(byId("mobile-primary"), "View Android release", release.html_url || mobileFallback);
        byId("mobile-file").textContent = "The latest release is available, but it does not currently contain an APK asset.";
      }
      return { ok: Boolean(apk), version: release.tag_name || "Latest" };
    } catch {
      byId("mobile-version").textContent = "See GitHub";
      byId("mobile-file").textContent = "Live release details could not load. Open the GitHub release page to check the latest APK.";
      setButton(byId("mobile-primary"), "View Android releases", mobileFallback);
      return { ok: false, version: "" };
    }
  }

  async function loadExtensionVersion() {
    try {
      const manifest = await getJson(EXTENSION_MANIFEST);
      const version = String(manifest.version || "").trim();
      if (version) {
        const value = document.querySelector(".product-card:nth-child(2) .version-row strong");
        if (value) value.textContent = version;
      }
    } catch {
      // The source ZIP remains available even when the manifest endpoint is temporarily unavailable.
    }
  }

  function setupNavigation() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = byId("primary-nav");
    if (!toggle || !nav) return;
    const close = () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      nav.classList.remove("is-open");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      nav.classList.toggle("is-open", open);
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
  }

  async function init() {
    byId("year").textContent = String(new Date().getFullYear());
    setupNavigation();
    const results = await Promise.all([loadDesktop(), loadMobile(), loadExtensionVersion()]);
    const desktop = results[0];
    const mobile = results[1];
    const status = byId("release-status");
    if (desktop.ok && mobile.ok) {
      status.textContent = "Release channels connected · Desktop " + desktop.version + " · Android " + mobile.version;
    } else if (desktop.ok || mobile.ok) {
      status.textContent = "Some release data is available · Check GitHub for the rest";
    } else {
      status.textContent = "Live release data unavailable · GitHub links are still available below";
    }
  }

  init();
})();