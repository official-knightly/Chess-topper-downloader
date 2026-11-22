(() => {
  "use strict";

  const API = "https://api.github.com/repos/official-knightly";
  const DESKTOP_RELEASES = API + "/Chess-topper-app/releases";
  const MOBILE_RELEASES = API + "/Chess-topper-mobile/releases";
  const EXTENSION_MANIFEST = "https://raw.githubusercontent.com/official-knightly/Chess-topper-extension/main/manifest.json";
  const EXTENSION_ZIP = "https://github.com/official-knightly/Chess-topper-extension/archive/refs/heads/main.zip";
  const DESKTOP_PAGE = "https://github.com/official-knightly/Chess-topper-app/releases";
  const MOBILE_PAGE = "https://github.com/official-knightly/Chess-topper-mobile/releases";
  const $ = (id) => document.getElementById(id);

  let builds = [];
  let filter = "all";
  let detectedPlatform = "unknown";
  let latestDesktop = [];
  let latestAndroid = [];

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["github.com", "objects.githubusercontent.com"].includes(url.hostname) ? url.href : null;
    } catch { return null; }
  }

  async function getJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("GitHub API " + response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function getAllReleases(url) {
    const all = [];
    for (let page = 1; page <= 10; page += 1) {
      const batch = await getJson(url + "?per_page=100&page=" + page);
      if (!Array.isArray(batch)) throw new Error("Invalid releases response");
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all.filter((release) => !release.draft).sort((a, b) =>
      new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0)
    );
  }

  function detectPlatform() {
    const ua = String(navigator.userAgent || "").toLowerCase();
    const platform = String(navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
    const touchMac = platform.includes("mac") && navigator.maxTouchPoints > 1;
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || touchMac) return "ios";
    if (platform.includes("win") || ua.includes("windows")) return "windows";
    if (platform.includes("mac") || ua.includes("macintosh")) return "mac";
    if (platform.includes("linux") || ua.includes("linux") || ua.includes("x11")) return "linux";
    return "unknown";
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function getPlatform(asset, source) {
    const name = String(asset.name || "").toLowerCase();
    if (name.endsWith(".apk")) return source === "mobile" ? "android" : null;
    if (source === "extension" && name.endsWith(".zip")) return "extension";
    if (name.endsWith(".exe") && /chess[-. ]topper/i.test(name) && !name.includes("worker")) return "windows";
    if (name.endsWith(".dmg")) return "mac";
    if (name.endsWith(".appimage") || name.endsWith(".deb")) return "linux";
    return null;
  }

  function platformName(platform) {
    return ({windows:"Windows",mac:"macOS",linux:"Linux",android:"Android",ios:"iOS",extension:"Browser extension",unknown:"your device"})[platform] || "your device";
  }

  function platformLabel(platform, filename) {
    if (platform === "linux" && String(filename).toLowerCase().endsWith(".deb")) return "Linux · DEB";
    if (platform === "linux") return "Linux · AppImage";
    return platformName(platform);
  }

  function getPreferredAsset(assets, platform) {
    const matching = assets.filter((asset) => getPlatform(asset, platform === "android" ? "mobile" : "desktop") === platform && safeUrl(asset.browser_download_url));
    if (platform === "linux") return matching.find((asset) => asset.name.toLowerCase().endsWith(".appimage")) || matching.find((asset) => asset.name.toLowerCase().endsWith(".deb")) || null;
    if (platform === "windows") return matching.find((asset) => asset.name.toLowerCase().endsWith(".exe")) || null;
    if (platform === "mac") return matching.find((asset) => asset.name.toLowerCase().endsWith(".dmg")) || null;
    if (platform === "android") return matching.find((asset) => asset.name.toLowerCase() === "chess.topper.apk") || matching[0] || null;
    return null;
  }

  function setDownloadLink(element, label, href) {
    const url = safeUrl(href);
    if (!element || !url) return false;
    element.href = url;
    element.removeAttribute("target");
    element.rel = "noreferrer";
    element.innerHTML = label + ' <span aria-hidden="true">↓</span>';
    element.setAttribute("aria-label", label);
    return true;
  }

  function latestPublished(releases) {
    return releases.find((release) => !release.prerelease) || releases[0] || null;
  }

  async function loadDesktop() {
    try {
      const releases = await getAllReleases(DESKTOP_RELEASES);
      const release = latestPublished(releases);
      if (!release) throw new Error("No desktop releases");
      latestDesktop = release.assets || [];
      $("desktop-version").textContent = release.tag_name || release.name || "Latest";
      $("hero-version").textContent = release.tag_name || "Latest";
      const selected = getPreferredAsset(latestDesktop, detectedPlatform);
      if (selected) setDownloadLink($("desktop-primary"), "Download for " + platformName(detectedPlatform), selected.browser_download_url);
      else setDownloadLink($("desktop-primary"), "Browse all desktop installers", release.html_url || DESKTOP_PAGE);
      const alternatives = $("desktop-assets");
      alternatives.replaceChildren();
      latestDesktop.filter((asset) => getPlatform(asset, "desktop") && asset !== selected && safeUrl(asset.browser_download_url)).forEach((asset) => {
        const link = document.createElement("a");
        link.href = safeUrl(asset.browser_download_url);
        link.textContent = asset.name + (asset.size ? " · " + formatBytes(asset.size) : "");
        link.rel = "noreferrer";
        alternatives.append(link);
      });
      $("desktop-updated").textContent = "Latest stable release · " + formatDate(release.published_at) + " · " + releases.length + " published version(s) indexed";
      return {ok:true,releases,version:release.tag_name || "Latest"};
    } catch (error) {
      $("desktop-version").textContent = "Unavailable";
      $("desktop-updated").textContent = "Could not reach GitHub. The full release page is still available.";
      setDownloadLink($("desktop-primary"), "Open desktop releases", DESKTOP_PAGE);
      return {ok:false,releases:[],error};
    }
  }

  async function loadMobile() {
    try {
      const releases = await getAllReleases(MOBILE_RELEASES);
      const release = latestPublished(releases);
      if (!release) throw new Error("No Android releases");
      const assets = release.assets || [];
      const apk = assets.find((asset) => asset.name.toLowerCase() === "chess.topper.apk" && safeUrl(asset.browser_download_url)) ||
        assets.find((asset) => asset.name.toLowerCase().endsWith(".apk") && safeUrl(asset.browser_download_url));
      $("mobile-version").textContent = release.tag_name || release.name || "Latest";
      if (apk) {
        setDownloadLink($("mobile-primary"), "Download Android APK", apk.browser_download_url);
        $("mobile-file").textContent = apk.name + (apk.size ? " · " + formatBytes(apk.size) : "") + " · " + formatDate(release.published_at);
      } else {
        setDownloadLink($("mobile-primary"), "Open Android releases", release.html_url || MOBILE_PAGE);
        $("mobile-file").textContent = "No APK file is attached to the latest release.";
      }
      latestAndroid = assets;
      return {ok:Boolean(apk),releases,version:release.tag_name || "Latest"};
    } catch (error) {
      $("mobile-version").textContent = "Unavailable";
      $("mobile-file").textContent = "Could not reach GitHub to check Android builds.";
      setDownloadLink($("mobile-primary"), "Open Android releases", MOBILE_PAGE);
      return {ok:false,releases:[],error};
    }
  }

  async function loadExtensionVersion() {
    try {
      const manifest = await getJson("https://raw.githubusercontent.com/official-knightly/Chess-topper-extension/main/manifest.json");
      if (manifest.version) {
        const node = document.querySelector("#extension-download")?.closest(".product-card")?.querySelector(".version-row strong");
        if (node) node.textContent = manifest.version;
      }
    } catch { /* Keep the source archive link working if the manifest is unavailable. */ }
  }

  function collectBuilds(desktopReleases, mobileReleases) {
    const items = [];
    const addReleaseAssets = (releases, source, product) => {
      releases.forEach((release) => {
        (release.assets || []).forEach((asset) => {
          const platform = getPlatform(asset, source);
          const url = safeUrl(asset.browser_download_url);
          if (!platform || !url) return;
          items.push({
            id: source + "-" + release.id + "-" + asset.id,
            platform, product,
            version: release.tag_name || release.name || "Build",
            date: release.published_at || release.created_at || "",
            filename: asset.name,
            size: asset.size || 0,
            downloads: Number(asset.download_count || 0),
            url,
            releaseUrl: safeUrl(release.html_url)
          });
        });
      });
    };
    addReleaseAssets(desktopReleases, "desktop", "Chess Topper Desktop");
    addReleaseAssets(mobileReleases, "mobile", "Chess Topper Android");
    items.push({
      id:"extension-main-zip",platform:"extension",product:"Chess Topper Extension",
      version:"main branch",date:"",filename:"Chess-topper-extension-main.zip",
      size:0,downloads:null,url:EXTENSION_ZIP,releaseUrl:"https://github.com/official-knightly/Chess-topper-extension"
    });
    return items.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function makeBuildRow(build) {
    const row = document.createElement("article");
    row.className = "build-row";
    const file = document.createElement("div");
    file.className = "build-file";
    const icon = document.createElement("span");
    icon.className = "build-file-icon";
    icon.setAttribute("aria-hidden","true");
    icon.textContent = build.filename.split(".").pop().toUpperCase().slice(0,5);
    const copy = document.createElement("div");
    copy.className = "build-file-copy";
    const name = document.createElement("span");
    name.className = "build-file-name";
    name.textContent = build.filename;
    const meta = document.createElement("span");
    meta.className = "build-file-details";
    const platform = document.createElement("span");
    platform.className = "build-platform";
    platform.textContent = platformLabel(build.platform,build.filename);
    meta.append(platform);
    if (build.size) {
      const size = document.createElement("span");
      size.textContent = formatBytes(build.size);
      meta.append(size);
    }
    if (build.date) {
      const date = document.createElement("span");
      date.textContent = formatDate(build.date);
      meta.append(date);
    }
    copy.append(name,meta);
    file.append(icon,copy);
    const actions = document.createElement("div");
    actions.className = "build-row-actions";
    const download = document.createElement("a");
    download.className = "build-download";
    download.href = build.url;
    download.rel = "noreferrer";
    download.textContent = "Download";
    download.setAttribute("aria-label","Download " + build.filename + " (" + build.version + ")");
    actions.append(download);
    if (build.releaseUrl) {
      const notes = document.createElement("a");
      notes.className = "build-release-link";
      notes.href = build.releaseUrl;
      notes.rel = "noreferrer";
      notes.textContent = "Release notes";
      actions.append(notes);
    }
    row.append(file,actions);
    return row;
  }

  function renderBuilds() {
    const list = $("build-library-list");
    if (!list) return;
    const query = String($("build-search")?.value || "").trim().toLowerCase();
    const visible = builds.filter((item) =>
      (filter === "all" || item.platform === filter) &&
      (!query || [item.product,item.version,item.filename,platformLabel(item.platform,item.filename)].join(" ").toLowerCase().includes(query))
    );
    $("build-count").textContent = String(visible.length);
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "build-empty";
      empty.textContent = builds.length ? "No builds match that filter. Try another platform or search." : "No release assets were found.";
      list.append(empty);
      return;
    }
    const groups = new Map();
    visible.forEach((item) => {
      const key = item.product + "|" + item.version;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(item);
    });
    groups.forEach((items) => {
      const group = document.createElement("section");
      group.className = "release-group";
      const heading = document.createElement("div");
      heading.className = "release-group-heading";
      const title = document.createElement("div");
      title.className = "release-group-title";
      const product = document.createElement("strong");
      product.textContent = items[0].product;
      const version = document.createElement("span");
      version.className = "release-version";
      version.textContent = items[0].version;
      title.append(product,version);
      const date = document.createElement("span");
      date.className = "release-date";
      date.textContent = items[0].date ? "Published " + formatDate(items[0].date) : "Live source archive";
      heading.append(title,date);
      group.append(heading);
      items.forEach((item) => group.append(makeBuildRow(item)));
      list.append(group);
    });
  }

  function setupFilters() {
    document.querySelectorAll(".filter-chip").forEach((button) => {
      button.addEventListener("click",() => {
        filter = button.dataset.filter || "all";
        document.querySelectorAll(".filter-chip").forEach((chip) => {
          const active = chip === button;
          chip.classList.toggle("is-active",active);
          chip.setAttribute("aria-pressed",String(active));
        });
        renderBuilds();
      });
    });
    $("build-search")?.addEventListener("input",renderBuilds);
  }

  function setupNavigation() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = $("primary-nav");
    if (!toggle || !nav) return;
    const close = () => {
      toggle.setAttribute("aria-expanded","false");
      toggle.setAttribute("aria-label","Open navigation");
      nav.classList.remove("is-open");
    };
    toggle.addEventListener("click",() => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded",String(open));
      toggle.setAttribute("aria-label",open ? "Close navigation" : "Open navigation");
      nav.classList.toggle("is-open",open);
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click",close));
    document.addEventListener("keydown",(event) => { if (event.key === "Escape") close(); });
    document.addEventListener("click",(event) => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
  }

  function configureDeviceDownload() {
    const heroLink = $("hero-download");
    const note = $("device-detection");
    const platform = detectedPlatform;
    const latest = platform === "android" ? getPreferredAsset(latestAndroid,"android") : getPreferredAsset(latestDesktop,platform);
    if (platform === "ios") {
      heroLink.textContent = "Android app not available for iOS";
      heroLink.href = "#all-builds";
      note.textContent = "You're on iOS. Chess Topper currently publishes an Android APK and desktop installers.";
      return;
    }
    if (latest) {
      setDownloadLink(heroLink,"Download for " + platformName(platform),latest.browser_download_url);
      note.textContent = "Detected " + platformName(platform) + " · " + latest.name + " · " + formatBytes(latest.size);
      heroLink.classList.add("device-download-ready");
    } else {
      heroLink.textContent = "Browse all downloads ↓";
      heroLink.href = "#all-builds";
      note.textContent = platform === "unknown"
        ? "Device detection is unavailable. Choose your installer from the complete library."
        : "Detected " + platformName(platform) + ", but no matching installer is attached to the latest release. Browse every available build.";
    }
  }

  async function init() {
    $("year").textContent = String(new Date().getFullYear());
    detectedPlatform = detectPlatform();
    setupNavigation();
    setupFilters();
    $("device-detection").textContent = "Detected " + platformName(detectedPlatform) + " · Checking the latest compatible installer…";
    const [desktop,mobile] = await Promise.all([loadDesktop(),loadMobile()]);
    builds = collectBuilds(desktop.releases,mobile.releases);
    renderBuilds();
    $("build-library-list").setAttribute("aria-busy","false");
    const desktopCount = builds.filter((item) => ["windows","mac","linux"].includes(item.platform)).length;
    const androidCount = builds.filter((item) => item.platform === "android").length;
    $("library-status").textContent = "Synced from GitHub · " + desktopCount + " desktop installers · " + androidCount + " Android APKs · every published desktop version is included.";
    configureDeviceDownload();
    await loadExtensionVersion();
    const releaseStatus = $("release-status");
    releaseStatus.textContent = (desktop.ok || mobile.ok)
      ? "GitHub connected · " + builds.length + " downloadable files indexed"
      : "GitHub is temporarily unavailable · Use the complete release pages below";
  }

  init();
})();