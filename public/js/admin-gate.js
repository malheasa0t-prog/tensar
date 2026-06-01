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
  var DEFAULT_LOGIN_MESSAGE = "\u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0628\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645.";
  var INVALID_CREDENTIALS_MESSAGE =
    "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.";
  var LOGIN_RETRY_MESSAGE =
    "\u062A\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u062D\u0627\u0644\u064A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.";
  var LOGIN_BUTTON_IDLE = "\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0644\u0648\u062D\u0629";
  var LOGIN_BUTTON_BUSY = "\u062C\u0627\u0631\u064D \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644...";

  var authClient = null;
  var statusNode = document.getElementById("gateStatus");
  var loadingNode = document.getElementById("gateLoading");
  var authNode = document.getElementById("gateAuth");
  var authMsgNode = document.getElementById("gateAuthMsg");
  var authErrorNode = document.getElementById("gateAuthError");
  var authForm = document.getElementById("gateAuthForm");
  var emailNode = document.getElementById("gateEmail");
  var passwordNode = document.getElementById("gatePassword");
  var submitNode = document.getElementById("gateSubmit");
  var deniedNode = document.getElementById("gateDenied");
  var deniedMsg = document.getElementById("gateDeniedMsg");

  function setMessage(msg) {
    if (statusNode) {
      statusNode.textContent = msg;
    }
  }

  function setAuthMessage(msg) {
    if (authMsgNode) {
      authMsgNode.textContent = msg || DEFAULT_LOGIN_MESSAGE;
    }
  }

  function setAuthError(msg) {
    if (!authErrorNode) {
      return;
    }

    if (!msg) {
      authErrorNode.textContent = "";
      authErrorNode.style.display = "none";
      return;
    }

    authErrorNode.textContent = msg;
    authErrorNode.style.display = "block";
  }

  function setAuthFormBusy(isBusy) {
    var shouldDisable = isBusy === true;
    if (emailNode) emailNode.disabled = shouldDisable;
    if (passwordNode) passwordNode.disabled = shouldDisable;
    if (submitNode) {
      submitNode.disabled = shouldDisable;
      submitNode.textContent = shouldDisable ? LOGIN_BUTTON_BUSY : LOGIN_BUTTON_IDLE;
    }
  }

  function showLoading(msg) {
    setMessage(msg || "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642...");
    if (loadingNode) loadingNode.style.display = "block";
    if (authNode) authNode.style.display = "none";
    if (deniedNode) deniedNode.style.display = "none";
  }

  function showLogin(msg) {
    if (loadingNode) loadingNode.style.display = "none";
    if (deniedNode) deniedNode.style.display = "none";
    if (authNode) authNode.style.display = "block";
    setAuthMessage(msg || DEFAULT_LOGIN_MESSAGE);
    setAuthFormBusy(false);
    if (emailNode && typeof emailNode.focus === "function") {
      window.setTimeout(function () { emailNode.focus(); }, 0);
    }
  }

  function showDenied(msg) {
    if (loadingNode) loadingNode.style.display = "none";
    if (authNode) authNode.style.display = "none";
    if (deniedNode) deniedNode.style.display = "block";
    if (deniedMsg) deniedMsg.textContent = msg;
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
            (registration && registration.active && registration.active.scriptURL)
            || (registration && registration.waiting && registration.waiting.scriptURL)
            || (registration && registration.installing && registration.installing.scriptURL)
            || ""
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
    showLoading("\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0644\u0648\u062D\u0629...");
    resetLegacyAdminShellState()
      .then(function () { return fetchPanelShellWithFallback(token); })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("panel");
        }
        return response.text();
      })
      .then(function (html) {
        document.open();
        document.write(html);
        document.close();
      })
      .catch(function () {
        showLogin("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
      });
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateLoginFields(email, password) {
    if (!email) {
      return "\u0623\u062F\u062E\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648\u0644\u064B\u0627.";
    }
    if (email.indexOf("@") === -1) {
      return "\u0623\u062F\u062E\u0644 \u0628\u0631\u064A\u062F\u064B\u0627 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627.";
    }
    if (!password) {
      return "\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648\u0644\u064B\u0627.";
    }
    return "";
  }

  function mapLoginError(error) {
    var message = String(error && error.message ? error.message : error || "").trim();
    var normalized = message.toLowerCase();

    if (!message) {
      return LOGIN_RETRY_MESSAGE;
    }

    if (
      message === "Invalid login credentials"
      || normalized.indexOf("email not confirmed") !== -1
      || normalized.indexOf("user not found") !== -1
    ) {
      return INVALID_CREDENTIALS_MESSAGE;
    }

    if (normalized.indexOf("rate limit") !== -1 || normalized.indexOf("too many requests") !== -1) {
      return "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.";
    }

    return LOGIN_RETRY_MESSAGE;
  }

  function validateAdminSession(token, options) {
    var handlers = options || {};
    if (!token) {
      if (typeof handlers.onUnauthorized === "function") {
        handlers.onUnauthorized();
      }
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
          if (typeof handlers.onUnauthorized === "function") {
            handlers.onUnauthorized();
          }
          return null;
        }
        if (response.status === 403) {
          if (typeof handlers.onForbidden === "function") {
            handlers.onForbidden();
          }
          return null;
        }
        if (!response.ok) {
          throw new Error("session");
        }
        return response.json();
      })
      .then(function (payload) {
        if (payload === null) {
          return;
        }
        if (!payload || payload.success !== true || !payload.user) {
          if (typeof handlers.onForbidden === "function") {
            handlers.onForbidden();
          }
          return;
        }
        loadShell(token);
      })
      .catch(function () {
        showLogin("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u062F\u0645\u0646. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
      });
  }

  function resolveSessionToken(authResult) {
    var session = authResult && authResult.data && authResult.data.session;
    if (session && session.access_token) {
      return Promise.resolve(session.access_token);
    }
    return authClient.auth.getSession().then(function (result) {
      var activeSession = result && result.data && result.data.session;
      return activeSession && activeSession.access_token ? activeSession.access_token : "";
    });
  }

  function handleLoginSubmit(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    if (!authClient) {
      showDenied("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0645\u0643\u062A\u0628\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.");
      return;
    }

    var email = normalizeEmail(emailNode && emailNode.value);
    var password = String(passwordNode && passwordNode.value || "");
    var validationError = validateLoginFields(email, password);

    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setAuthError("");
    setAuthFormBusy(true);

    authClient.auth.signInWithPassword({ email: email, password: password })
      .then(function (authResult) {
        if (authResult && authResult.error) {
          throw authResult.error;
        }
        return resolveSessionToken(authResult);
      })
      .then(function (token) {
        validateAdminSession(token, {
          onUnauthorized: function () {
            setAuthFormBusy(false);
            showLogin("\u062A\u0639\u0630\u0631 \u062A\u062B\u0628\u064A\u062A \u0627\u0644\u062C\u0644\u0633\u0629. \u062D\u0627\u0648\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.");
          },
          onForbidden: function () {
            setAuthFormBusy(false);
            setAuthError("\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0627 \u064A\u0645\u062A\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645.");
            showLogin("\u0627\u0633\u062A\u062E\u062F\u0645 \u062D\u0633\u0627\u0628\u064B\u0627 \u0625\u062F\u0627\u0631\u064A\u064B\u0627 \u0645\u0641\u0639\u0651\u0644\u064B\u0627 \u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0644\u0648\u062D\u0629.");
          },
        });
      })
      .catch(function (error) {
        setAuthFormBusy(false);
        setAuthError(mapLoginError(error));
      });
  }

  function bindAuthForm() {
    if (!authForm || typeof authForm.addEventListener !== "function") {
      return;
    }
    authForm.addEventListener("submit", handleLoginSubmit);
  }

  function startAdminGate() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      showDenied("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0645\u0643\u062A\u0628\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.");
      return;
    }

    authClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    bindAuthForm();
    authClient.auth.getSession()
      .then(function (result) {
        var session = result && result.data && result.data.session;
        if (!session || !session.access_token) {
          showLogin(DEFAULT_LOGIN_MESSAGE);
          return;
        }

        validateAdminSession(session.access_token, {
          onUnauthorized: function () {
            showLogin("\u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0628\u062D\u0633\u0627\u0628 \u0625\u062F\u0627\u0631\u064A \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645.");
          },
          onForbidden: function () {
            showLogin("\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0627 \u064A\u0645\u062A\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0644\u0648\u062D\u0629. \u064A\u0645\u0643\u0646\u0643 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u062D\u0633\u0627\u0628 \u0625\u062F\u0627\u0631\u064A \u0622\u062E\u0631.");
          },
        });
      })
      .catch(function () {
        showLogin("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629. \u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0645\u0646 \u062C\u062F\u064A\u062F.");
      });
  }

  function waitForSupabaseLibrary(startedAt) {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      startAdminGate();
      return;
    }
    if (window.__tzAdminSupabaseLoadFailed || Date.now() - startedAt >= ADMIN_LIBRARY_TIMEOUT_MS) {
      showDenied("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0645\u0643\u062A\u0628\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629.");
      return;
    }
    window.setTimeout(function () { waitForSupabaseLibrary(startedAt); }, ADMIN_LIBRARY_POLL_MS);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    showDenied("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
    return;
  }

  waitForSupabaseLibrary(Date.now());
})();
