(() => {
  "use strict";

  const API_ROOT = "https://api.github.com/repos/official-knightly";
  const DESKTOP_REPO = "Chess-topper-app";
  const MOBILE_REPO = "Chess-topper-mobile";
  const DESKTOP_RELEASES = API_ROOT + "/" + DESKTOP_REPO + "/releases";
  const MOBILE_RELEASES = API_ROOT + "/" + MOBILE_REPO + "/releases";
  const EXTENSION_MANIFEST = "https://raw.githubusercontent.com/official-knightly/Chess-topper-extension/main/manifest.json";
  const EXTENSION_ZIP = "https://github.com/official-knightly/Chess-topper-extension/archive/refs/heads/main.zip";

  const byId = (id) => document.getElementById(id);
  const desktopFallback = "https://github.com/official-knightly/Chess-topper-app/releases";
  const mobileFallback = "https://github.com/official-knightly/Chess-topper-mobile/releases";

  let allBuilds = [];
  let activeFilter = "all";

  function safeGitHubUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && (
        parsed.hostname === "github.com" ||
        parsed.hostname === "objects.githubusercontent.com" ||
        parsed.hostname === "raw.githubusercontent.com"
      ) ? parsed.href : null;
    } catch {
      return null;
    }
  }

  async function getJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
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

  async function getAllReleases(baseUrl) {
    const releases = [];
    for (let page = 1; page <= 10; page += 1) {
      const batch = await getJson(baseUrl + "?per_page=100&page=" + page);
      if (!Array.isArray(batch)) throw new Error("Unexpected GitHub release response");
      releases.push(...batch);
      if (batch.length < 100) break;
    }
    return releases.sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "";
    const size = Number(bytes);
    if (size >= 1024 * 1024 * 1024) return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function platformForAsset(asset, source) {
    const name = String(asset.name || "").toLowerCase();
    if (name.endsWith(".apk")) return "android";
    if (name.endsWith(".exe") && !name.includes("worker") && (name.includes("chess-topper") || name.includes("chess.topper"))) return "windows";
    if (name.endsWith(".dmg")) return "mac";
    if (name.endsWith(".appimage") || name.endsWith(".deb")) return "linux";
    if (source === "extension" && name.endsWith(".zip")) return "extension";
    return null;
  }

  function platformLabel(platform, name) {
    if (platform === "windows") return "Windows";
    if (platform === "mac") return "macOS";
    if (platform === "linux") return String(name).toLowerCase().endsWith(".deb") ? "Linux · DEB" : "Linux · AppImage";
    if (platform === "android") return "Android";
    if (platform === "extension") return "Browser extension";
    return "Download";
  }

  function fileExtension(name) {
    const match = String(name || "").match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toUpperCase() : "FILE";
  }

  function preferredAsset(assets) {
    const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
    const matches = (suffix) => assets.find((asset) => String(asset.name).toLowerCase().endsWith(suffix));
    if (platform.includes("win")) return matches(".exe") || null;
    if (platform.includes("mac") || platform.includes("iphone") || platform.includes("ipad")) return matches(".dmg") || null;
    if (platform.includes("linux") || platform.includes("x11")) return matches(".appimage") || matches(".deb") || null;
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
    link.textContent = label + (asset.size ? " · " + formatBytes(asset.size) : "");
    container.appendChild(link);
  }

  function latestRelease(releases) {
    return Array.isArray(releases) ? releases.find((release) => !release.draft && !release.prerelease) : null;
  }

  async function loadDesktop() {
    try {
      const releases = await getAllReleases(DESKTOP_RELEASES);
      const release = latestRelease(releases);
      if (!release) throw new Error("No published desktop releases found");
      const assets = (release.assets || []).filter((asset) => platformForAsset(asset, "desktop") && safeGitHubUrl(asset.browser_download_url));
      const version = release.tag_name || release.name || "Latest";
      byId("desktop-version").textContent = version;
      byId("hero-version").textContent = version;

      const primary = preferredAsset(assets);
      if (primary) {
        const platform = platformForAsset(primary, "desktop");
        setButton(byId("desktop-primary"), "Download for " + (platform === "windows" ? "Windows" : platform === "mac" ? "macOS" : "Linux"), primary.browser_download_url);
      } else {
        setButton(byId("desktop-primary"), "Choose a desktop installer", release.html_url || desktopFallback);
      }

      const alternatives = byId("desktop-assets");
      alternatives.replaceChildren();
      assets.filter((asset) => asset !== primary).forEach((asset) => appendAssetLink(alternatives, asset, platformLabel(platformForAsset(asset, "desktop"), asset.name)));

      const date = formatDate(release.published_at);
      byId("desktop-updated").textContent = date
        ? "Latest release published " + date + " · " + releases.length + " published desktop release" + (releases.length === 1 ? "" : "s")
        : "Installer links are served directly by GitHub.";
      return { ok: true, version, releases };
    } catch (error) {
      byId("desktop-version").textContent = "See GitHub";
      byId("hero-version").textContent = "Latest";
      byId("desktop-updated").textContent = "Could not load release data. Open GitHub to view the installer files.";
      setButton(byId("desktop-primary"), "View desktop releases", desktopFallback);
      return { ok: false, version: "", releases: [], error };
    }
  }

  async function loadMobile() {
    try {
      const releases = await getAllReleases(MOBILE_RELEASES);
      const release = latestRelease(releases);
      if (!release) throw new Error("No published Android releases found");
      const apkAssets = (release.assets || []).filter((asset) =>
        String(asset.name || "").toLowerCase().endsWith(".apk") && safeGitHubUrl(asset.browser_download_url)
      );
      const apk = apkAssets.find((asset) => String(asset.name).toLowerCase() === "chess.topper.apk") || apkAssets[0];
      byId("mobile-version").textContent = release.tag_name || release.name || "Latest";
      if (apk) {
        setButton(byId("mobile-primary"), "Download Android APK", apk.browser_download_url);
        byId("mobile-file").textContent = apk.name + (apk.size ? " · " + formatBytes(apk.size) : "") +
          (release.published_at ? " · Published " + formatDate(release.published_at) : "");
      } else {
        setButton(byId("mobile-primary"), "View Android release", release.html_url || mobileFallback);
        byId("mobile-file").textContent = "This release currently has no APK asset.";
      }
      return { ok: Boolean(apk), version: release.tag_name || "Latest", releases };
    } catch (error) {
      byId("mobile-version").textContent = "See GitHub";
      byId("mobile-file").textContent = "Could not load APK details. Open GitHub to check current Android builds.";
      setButton(byId("mobile-primary"), "View Android releases", mobileFallback);
      return { ok: false, version: "", releases: [], error };
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
      // The extension source archive remains available if the manifest cannot be reached.
    }
  }

  function collectBuilds(desktopReleases, mobileReleases) {
    const builds = [];

    (desktopReleases || []).forEach((release) => {
      if (release.draft) return;
      (release.assets || []).forEach((asset) => {
        const platform = platformForAsset(asset, "desktop");
        const href = safeGitHubUrl(asset.browser_download_url);
        if (!platform || !href) return;
        builds.push({
          key: "desktop-" + release.id + "-" + asset.id,
          platform,
          product: "Chess Topper Desktop",
          version: release.tag_name || release.name || "Desktop build",
          releaseTitle: release.name || "Chess Topper Desktop",
          date: release.published_at || release.created_at,
          filename: asset.name,
          size: asset.size,
          downloads: asset.download_count,
          url: href
        });
      });
    });

    (mobileReleases || []).forEach((release) => {
      if (release.draft) return;
      (release.assets || []).forEach((asset) => {
        const platform = platformForAsset(asset, "mobile");
        const href = safeGitHubUrl(asset.browser_download_url);
        if (platform !== "android" || !href) return;
        builds.push({
          key: "mobile-" + release.id + "-" + asset.id,
          platform,
          product: "Chess Topper Mobile",
          version: release.tag_name || release.name || "Android build",
          releaseTitle: release.name || "Chess Topper Mobile",
          date: release.published_at || release.created_at,
          filename: asset.name,
          size: asset.size,
          downloads: asset.download_count,
          url: href
        });
      });
    });

    builds.push({
      key: "extension-main-source",
      platform: "extension",
      product: "Chess Topper Extension",
      version: "main",
      releaseTitle: "Browser extension source archive",
      date: "",
      filename: "Chess-topper-extension-main.zip",
      size: 0,
      downloads: null,
      url: EXTENSION_ZIP
    });

    return builds.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }

  function createBuildRow(build) {
    const row = document.createElement("div");
    row.className = "build-row";
    row.dataset.platform = build.platform;
    row.dataset.search = [build.product, build.version, build.filename, platformLabel(build.platform, build.filename)].join(" ").toLowerCase();

    const file = document.createElement("div");
    file.className = "build-file";

    const icon = document.createElement("span");
    icon.className = "build-file-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = fileExtension(build.filename);

    const copy = document.createElement("div");
    copy.className = "build-file-copy";

    const name = document.createElement("span");
    name.className = "build-file-name";
    name.textContent = build.filename;

    const details = document.createElement("span");
    details.className = "build-file-details";
    const platform = document.createElement("span");
    platform.className = "build-platform";
    platform.textContent = platformLabel(build.platform, build.filename);
    details.append(platform);

    if (build.size) {
      const size = document.createElement("span");
      size.textContent = formatBytes(build.size);
      details.append(size);
    }
    if (typeof build.downloads === "number") {
      const downloads = document.createElement("span");
      downloads.textContent = build.downloads + " GitHub download" + (build.downloads === 1 ? "" : "s");
      details.append(downloads);
    }

    copy.append(name, details);
    file.append(icon, copy);

    const link = document.createElement("a");
    link.className = "build-download";
    link.href = build.url;
    link.textContent = "Download";
    link.setAttribute("aria-label", "Download " + build.filename + " from " + build.version);
    link.rel = "noreferrer";

    row.append(file, link);
    return row;
  }

  function renderBuildLibrary() {
    const list = byId("build-library-list");
    if (!list) return;
    const query = String(byId("build-search")?.value || "").trim().toLowerCase();
    const filtered = allBuilds.filter((build) =>
      (activeFilter === "all" || build.platform === activeFilter) &&
      (!query || [build.product, build.version, build.filename, platformLabel(build.platform, build.filename)].join(" ").toLowerCase().includes(query))
    );

    byId("build-count").textContent = String(filtered.length);
    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "build-empty";
      empty.textContent = allBuilds.length
        ? "No installer files match this filter. Try another platform or search."
        : "No installer files are published in the connected releases yet.";
      list.append(empty);
      return;
    }

    const groups = new Map();
    filtered.forEach((build) => {
      const groupKey = build.product + "||" + build.version;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(build);
    });

    groups.forEach((items) => {
      const first = items[0];
      const group = document.createElement("section");
      group.className = "release-group";

      const heading = document.createElement("div");
      heading.className = "release-group-heading";

      const title = document.createElement("div");
      title.className = "release-group-title";
      const product = document.createElement("strong");
      product.textContent = first.product;
      const version = document.createElement("span");
      version.className = "release-version";
      version.textContent = first.version;
      title.append(product, version);

      const date = document.createElement("span");
      date.className = "release-date";
      date.textContent = first.date ? "Published " + formatDate(first.date) : "Source archive";

      heading.append(title, date);
      group.append(heading);
      items.forEach((build) => group.append(createBuildRow(build)));
      list.append(group);
    });
  }

  async function loadAllBuilds(desktopReleases, mobileReleases) {
    const list = byId("build-library-list");
    const status = byId("library-status");
    if (list) list.setAttribute("aria-busy", "true");
    try {
      allBuilds = collectBuilds(desktopReleases, mobileReleases);
      renderBuildLibrary();
      const desktopCount = allBuilds.filter((build) => build.product === "Chess Topper Desktop").length;
      const androidCount = allBuilds.filter((build) => build.product === "Chess Topper Mobile").length;
      const extensionCount = allBuilds.filter((build) => build.product === "Chess Topper Extension").length;
      status.textContent = "Pulled " + desktopCount + " desktop installer(s), " + androidCount + " Android APK(s), and " + extensionCount + " extension archive from your GitHub projects.";
    } catch {
      status.textContent = "Could not build the download catalogue. The GitHub release links above are still available.";
      status.classList.add("is-error");
      if (list) {
        list.replaceChildren();
        const error = document.createElement("div");
        error.className = "build-error";
        error.textContent = "GitHub release data could not be loaded. Check your connection or open the release pages directly.";
        list.append(error);
      }
    } finally {
      if (list) list.setAttribute("aria-busy", "false");
    }
  }

  function setupFilters() {
    document.querySelectorAll(".filter-chip").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "all";
        document.querySelectorAll(".filter-chip").forEach((chip) => {
          const active = chip === button;
          chip.classList.toggle("is-active", active);
          chip.setAttribute("aria-pressed", String(active));
        });
        renderBuildLibrary();
      });
    });
    const search = byId("build-search");
    if (search) search.addEventListener("input", renderBuildLibrary);
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
    setupFilters();
    const [desktop, mobile] = await Promise.all([loadDesktop(), loadMobile()]);
    await Promise.all([
      loadExtensionVersion(),
      loadAllBuilds(desktop.releases, mobile.releases)
    ]);

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