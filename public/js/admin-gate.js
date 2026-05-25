/**
 * Admin gate bootstrap.
 *
 * Loaded by the gate page at /admin.html. Reads runtime configuration that
 * the server injects onto window.__tzAdminGate (escaped JSON), validates the
 * current Supabase session against /api/admin/session, then replaces the page
 * with the protected admin shell on success.
 *
 * Kept as an external script so the page CSP can drop `'unsafe-inline'`
 * for scripts.
 */
(function bootstrapAdminGate() {
  var config = window.__tzAdminGate || {};
  var supabaseUrl = String(config.supabaseUrl || "").trim();
  var supabaseAnonKey = String(config.supabaseAnonKey || "").trim();
  var panelPath = String(config.panelPath || "").trim();
  var sessionRoute = String(config.sessionRoute || "").trim();
  var ADMIN_LIBRARY_TIMEOUT_MS = 5000;
  var ADMIN_LIBRARY_POLL_MS = 100;

  var statusNode = document.getElementById("gateStatus");
  var loadingNode = document.getElementById("gateLoading");
  var deniedNode = document.getElementById("gateDenied");
  var deniedMsg = document.getElementById("gateDeniedMsg");

  function setMessage(msg) {
    if (statusNode) {
      statusNode.textContent = msg;
    }
  }

  function showDenied(msg) {
    if (loadingNode) {
      loadingNode.style.display = "none";
    }
    if (deniedNode) {
      deniedNode.style.display = "block";
    }
    if (deniedMsg) {
      deniedMsg.textContent = msg;
    }
  }

  function clearAdminShellCaches() {
    if (!("caches" in window)) {
      return Promise.resolve();
    }
    return window.caches.keys()
      .then(function (keys) {
        var cacheKeys = keys.filter(function (key) {
          return String(key || "").indexOf("tz-admin-shell-") === 0;
        });
        return Promise.all(cacheKeys.map(function (key) { return window.caches.delete(key); }));
      })
      .catch(function () { return null; });
  }

  function unregisterAdminServiceWorkers() {
    if (!("serviceWorker" in navigator) || typeof navigator.serviceWorker.getRegistrations !== "function") {
      return Promise.resolve();
    }
    return navigator.serviceWorker.getRegistrations()
      .then(function (registrations) {
        var adminRegistrations = registrations.filter(function (registration) {
          var url = String(
            (registration && registration.active && registration.active.scriptURL) ||
            (registration && registration.waiting && registration.waiting.scriptURL) ||
            (registration && registration.installing && registration.installing.scriptURL) ||
            ""
          );
          return url.indexOf("admin-sw.js") !== -1;
        });
        return Promise.all(adminRegistrations.map(function (registration) { return registration.unregister(); }));
      })
      .catch(function () { return null; });
  }

  function resetLegacyAdminShellState() {
    return Promise.all([clearAdminShellCaches(), unregisterAdminServiceWorkers()])
      .then(function () { return null; });
  }

  function buildPanelRequestPath() {
    var panelUrl = new URL(panelPath, window.location.origin);
    var currentUrl = new URL(window.location.href);

    currentUrl.searchParams.forEach(function (value, key) {
      if (!panelUrl.searchParams.has(key)) {
        panelUrl.searchParams.append(key, value);
      }
    });

    return panelUrl.pathname + panelUrl.search;
  }

  function fetchPanelShell(token) {
    var headers = { Accept: "text/html" };
    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    return fetch(buildPanelRequestPath(), {
      cache: "no-store",
      credentials: "same-origin",
      headers: headers,
    });
  }

  function fetchPanelShellWithFallback(token) {
    return fetchPanelShell(token).then(function (response) {
      if (response.ok || !token) {
        return response;
      }

      return fetchPanelShell("").then(function (fallbackResponse) {
        return fallbackResponse.ok ? fallbackResponse : response;
      });
    });
  }

  function loadShell(token) {
    resetLegacyAdminShellState()
      .then(function () { return fetchPanelShellWithFallback(token); })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("panel");
        }
        return response.text();
      })
      .then(function (html) {
        // Same-origin response from /__tz-panel.html (middleware-gated). We
        // intentionally swap the document so the shell scripts run with their
        // own bootstrap. The HTML never crosses an origin boundary.
        document.open();
        document.write(html);
        document.close();
      })
      .catch(function () {
        setMessage("تعذر تحميل لوحة الإدارة. أعد المحاولة.");
      });
  }

  function validateAdminSession(token) {
    if (!token) {
      showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
      return;
    }
    fetch(sessionRoute, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      },
    })
      .then(function (response) {
        if (response.status === 401) {
          showDenied("جلستك غير صالحة. سجل دخولك مرة أخرى.");
          return null;
        }
        if (response.status === 403) {
          showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
          return null;
        }
        if (!response.ok) {
          throw new Error("session");
        }
        return response.json();
      })
      .then(function (payload) {
        if (payload === null) { return; }
        if (!payload || payload.success !== true || !payload.user) {
          showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
          return;
        }
        loadShell(token);
      })
      .catch(function () {
        setMessage("تعذر التحقق من الجلسة. أعد المحاولة.");
      });
  }

  function startAdminGate() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      showDenied("تعذر تحميل مكتبة تسجيل الدخول.");
      return;
    }
    var client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    client.auth.getSession()
      .then(function (result) {
        var session = result && result.data && result.data.session;
        if (!session || !session.access_token) {
          showDenied("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
          return;
        }
        validateAdminSession(session.access_token);
      })
      .catch(function () {
        showDenied("تعذر التحقق من الجلسة.");
      });
  }

  function waitForSupabaseLibrary(startedAt) {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      startAdminGate();
      return;
    }
    if (window.__tzAdminSupabaseLoadFailed || Date.now() - startedAt >= ADMIN_LIBRARY_TIMEOUT_MS) {
      showDenied("تعذر تحميل مكتبة تسجيل الدخول. أعد تحميل الصفحة.");
      return;
    }
    window.setTimeout(function () { waitForSupabaseLibrary(startedAt); }, ADMIN_LIBRARY_POLL_MS);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    setMessage("تعذر تحميل إعدادات لوحة الإدارة.");
    return;
  }

  waitForSupabaseLibrary(Date.now());
})();
