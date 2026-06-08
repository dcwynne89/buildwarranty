/* ============================================================
   BuildWarranty — Save/Load Integration
   Connects the warranty form to BuildAuth for persistence.
   
   Requires: build-ecosystem-auth.js loaded first
   ============================================================ */
(function () {
  "use strict";

  // Wait for BuildAuth to exist
  function waitForAuth(cb) {
    if (window.BuildAuth) { cb(); return; }
    var t = setInterval(function () {
      if (window.BuildAuth) { clearInterval(t); cb(); }
    }, 200);
  }

  waitForAuth(function () { init(); });

  /* ── Autocomplete CSS ─────────────────────────────────────── */
  var acStyle = document.createElement("style");
  acStyle.textContent = `
    .bwt-ac-wrap { position: relative; }
    .bwt-ac-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 500;
      background: #1e1810; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; margin-top: 4px; max-height: 200px;
      overflow-y: auto; display: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .bwt-ac-list.open { display: block; }
    .bwt-ac-item {
      padding: 10px 14px; cursor: pointer; transition: background 0.12s;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .bwt-ac-item:last-child { border-bottom: none; }
    .bwt-ac-item:hover, .bwt-ac-item.active { background: rgba(217,119,6,0.1); }
    .bwt-ac-name { font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.85); }
    .bwt-ac-detail { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-top: 1px; }
    .bwt-ac-badge {
      display: inline-block; font-size: 0.65rem; padding: 1px 6px;
      background: rgba(217,119,6,0.15); color: #f59e0b;
      border-radius: 4px; margin-left: 6px; vertical-align: middle;
    }
  `;
  document.head.appendChild(acStyle);

  /* ── Read form state from DOM ─────────────────────────────── */

  function readFormData() {
    return {
      from_name:            v("fromName"),
      from_email:           v("fromEmail"),
      from_street:          v("fromStreet"),
      from_city:            v("fromCity"),
      from_state:           v("fromState"),
      from_phone:           v("fromPhone"),
      to_name:              v("toName"),
      to_email:             v("toEmail"),
      to_street:            v("toStreet"),
      to_city:              v("toCity"),
      to_state:             v("toState"),
      warranty_number:      v("warrantyNumber"),
      warranty_date:        v("warrantyDate"),
      warranty_type:        v("warrantyType"),
      duration:             v("duration"),
      duration_unit:        v("durationUnit"),
      expiration_date:      v("expirationDate"),
      transferable:         v("transferable"),
      accent_color:         v("accentColor"),
      project_description:  v("projectDescription"),
      coverage_description: v("coverageDescription"),
      exclusions:           v("exclusions"),
      claim_process:        v("claimProcess"),
      contact_info:         v("contactInfo"),
      terms:                v("terms"),
    };
  }

  function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }

  /* ── Write form state to DOM ──────────────────────────────── */

  function loadFormData(data) {
    setVal("fromName",           data.from_name);
    setVal("fromEmail",          data.from_email);
    setVal("fromStreet",         data.from_street);
    setVal("fromCity",           data.from_city);
    setVal("fromState",          data.from_state);
    setVal("fromPhone",          data.from_phone);
    setVal("toName",             data.to_name);
    setVal("toEmail",            data.to_email);
    setVal("toStreet",           data.to_street);
    setVal("toCity",             data.to_city);
    setVal("toState",            data.to_state);
    setVal("warrantyNumber",     data.warranty_number);
    setVal("warrantyDate",       data.warranty_date);
    setVal("warrantyType",       data.warranty_type);
    setVal("duration",           data.duration);
    setVal("durationUnit",       data.duration_unit);
    setVal("expirationDate",     data.expiration_date);
    setVal("transferable",       data.transferable);
    setVal("projectDescription", data.project_description);
    setVal("coverageDescription",data.coverage_description);
    setVal("exclusions",         data.exclusions);
    setVal("claimProcess",       data.claim_process);
    setVal("contactInfo",        data.contact_info);
    setVal("terms",              data.terms);

    if (data.accent_color) {
      setVal("accentColor", data.accent_color);
      setVal("accentColorHex", data.accent_color);
      if (window.accentColor !== undefined) window.accentColor = data.accent_color;
    }

    // Recalculate expiration
    if (typeof window.calcExpiration === "function") {
      window.calcExpiration();
    }
  }

  function setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /* ── Build title from form data ───────────────────────────── */

  function buildTitle(data) {
    var parts = [];
    if (data.warranty_number) parts.push(data.warranty_number);
    if (data.to_name) parts.push("for " + data.to_name);
    if (data.project_description) {
      // Take first ~40 chars of project description
      var desc = data.project_description.substring(0, 40);
      if (data.project_description.length > 40) desc += "…";
      parts.push("— " + desc);
    }
    return parts.join(" ") || "Untitled Warranty";
  }

  /* ── Inject UI ────────────────────────────────────────────── */

  function init() {
    injectSaveButton();
    injectSavedPanel();
    initClientAutocomplete();

    BuildAuth.onAuthChange(function (user) {
      var panel = document.getElementById("bwt-saved-panel");
      var saveBtn = document.getElementById("bwt-save-btn");
      var hint = document.getElementById("bwt-save-hint");

      if (user) {
        if (saveBtn) saveBtn.style.display = "";
        if (hint) hint.style.display = "none";
        if (panel) { panel.style.display = ""; loadSavedWarranties(); }
      } else {
        if (saveBtn) saveBtn.style.display = "none";
        if (hint) hint.style.display = "";
        if (panel) panel.style.display = "none";
      }
    });
  }

  function injectSaveButton() {
    var btnRow = document.getElementById("btnDownload")?.parentElement;
    if (!btnRow) return;

    // Save button (hidden until signed in)
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.id = "bwt-save-btn";
    saveBtn.style.cssText = "display:none;background:rgba(217,119,6,0.15);border:1px solid rgba(217,119,6,0.3);color:#f59e0b;padding:0.75rem 1.25rem;border-radius:12px;font-weight:600;font-size:0.95rem;cursor:pointer;transition:all 0.2s;white-space:nowrap;font-family:inherit;";
    saveBtn.textContent = "💾 Save";
    saveBtn.title = "Save this warranty to your account";
    saveBtn.addEventListener("mouseenter", function () { saveBtn.style.background = "rgba(217,119,6,0.25)"; });
    saveBtn.addEventListener("mouseleave", function () { saveBtn.style.background = "rgba(217,119,6,0.15)"; });
    saveBtn.addEventListener("click", handleSave);
    btnRow.appendChild(saveBtn);

    // "Sign in to save" hint (shown when signed out)
    var hint = document.createElement("button");
    hint.type = "button";
    hint.id = "bwt-save-hint";
    hint.className = "bea-save-hint";
    hint.textContent = "💾 Sign in to save your warranties";
    hint.style.marginTop = "0.75rem";
    hint.addEventListener("click", function () { BuildAuth.showSignIn(); });
    btnRow.parentElement.appendChild(hint);
  }

  async function handleSave() {
    var btn = document.getElementById("bwt-save-btn");
    btn.textContent = "Saving...";
    btn.disabled = true;

    var data = readFormData();
    var title = buildTitle(data);

    // Also save client to shared clients collection
    if (data.to_name) {
      BuildAuth.saveClient({
        name: data.to_name,
        email: data.to_email || "",
        phone: "",
        address: [data.to_street, data.to_city, data.to_state].filter(Boolean).join(", "),
      });
    }

    var docId = await BuildAuth.saveDocument("warranty", title, data, {
      clientName: data.to_name,
      warrantyType: data.warranty_type,
      expirationDate: data.expiration_date,
      status: "active",
    });

    if (docId) {
      btn.textContent = "✓ Saved";
      setTimeout(function () { btn.textContent = "💾 Save"; btn.disabled = false; }, 2000);
      loadSavedWarranties();
    } else {
      btn.textContent = "✗ Error";
      setTimeout(function () { btn.textContent = "💾 Save"; btn.disabled = false; }, 2000);
    }
  }

  /* ── Saved Warranties Panel ───────────────────────────────── */

  function injectSavedPanel() {
    var form = document.querySelector(".form-card, .warranty-form, #warrantyForm");
    if (!form) {
      form = document.querySelector("main") || document.querySelector(".container");
    }
    if (!form) return;

    var panel = document.createElement("div");
    panel.id = "bwt-saved-panel";
    panel.style.cssText = "display:none;margin-bottom:2rem;background:rgba(217,119,6,0.04);border:1px solid rgba(217,119,6,0.12);border-radius:16px;padding:1.5rem;";
    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '<h3 style="margin:0;font-size:1rem;font-weight:700;color:rgba(255,255,255,0.85);">🛡️ Your Saved Warranties</h3>' +
        '<button id="bwt-refresh" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:0.85rem;">↻ Refresh</button>' +
      '</div>' +
      '<div id="bwt-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>';

    form.parentElement.insertBefore(panel, form);

    document.getElementById("bwt-refresh")?.addEventListener("click", loadSavedWarranties);
  }

  async function loadSavedWarranties() {
    var list = document.getElementById("bwt-list");
    if (!list) return;

    list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;">Loading...</div>';

    var docs = await BuildAuth.loadDocuments("warranty");

    if (docs.length === 0) {
      list.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No saved warranties yet. Create a warranty and click 💾 Save.</div>';
      return;
    }

    list.innerHTML = "";
    docs.forEach(function (doc) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:pointer;transition:all 0.15s;";
      row.addEventListener("mouseenter", function () { row.style.background = "rgba(255,255,255,0.06)"; });
      row.addEventListener("mouseleave", function () { row.style.background = "rgba(255,255,255,0.03)"; });

      var info = document.createElement("div");
      info.innerHTML =
        '<div style="font-size:0.9rem;font-weight:600;color:rgba(255,255,255,0.8);">' + escHtml(doc.title) + '</div>' +
        '<div style="font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:2px;">' +
          (doc.clientName ? escHtml(doc.clientName) + " · " : "") +
          (doc.warrantyType ? escHtml(doc.warrantyType) + " · " : "") +
          formatDate(doc.createdAt) +
        '</div>';

      var actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px;flex-shrink:0;";

      var loadBtn = document.createElement("button");
      loadBtn.style.cssText = "background:rgba(217,119,6,0.15);border:1px solid rgba(217,119,6,0.25);color:#f59e0b;padding:5px 12px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:inherit;";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", function (e) { e.stopPropagation(); loadWarranty(doc.id); });

      var delBtn = document.createElement("button");
      delBtn.style.cssText = "background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;padding:5px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:inherit;";
      delBtn.textContent = "✕";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm("Delete this saved warranty?")) {
          BuildAuth.deleteDocument(doc.id).then(function () { loadSavedWarranties(); });
        }
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  async function loadWarranty(docId) {
    var doc = await BuildAuth.getDocument(docId);
    if (!doc || !doc.formData) { alert("Could not load warranty."); return; }
    loadFormData(doc.formData);
    var form = document.querySelector(".form-card, .warranty-form, #warrantyForm, main");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── Client Autocomplete ───────────────────────────────────── */

  var cachedClients = [];
  var acList = null;
  var acActiveIdx = -1;

  function initClientAutocomplete() {
    var nameInput = document.getElementById("toName");
    if (!nameInput) return;

    var parent = nameInput.parentElement;
    parent.style.position = "relative";

    acList = document.createElement("div");
    acList.className = "bwt-ac-list";
    acList.id = "bwt-ac-list";
    parent.appendChild(acList);

    nameInput.addEventListener("input", function () {
      if (!BuildAuth.getUser()) return;
      var query = nameInput.value.trim().toLowerCase();
      if (query.length < 1) { closeAc(); return; }
      showMatches(query);
    });

    nameInput.addEventListener("focus", function () {
      if (!BuildAuth.getUser()) return;
      var query = nameInput.value.trim().toLowerCase();
      if (query.length >= 1) showMatches(query);
    });

    nameInput.addEventListener("keydown", function (e) {
      if (!acList.classList.contains("open")) return;
      var items = acList.querySelectorAll(".bwt-ac-item");
      if (e.key === "ArrowDown") { e.preventDefault(); acActiveIdx = Math.min(acActiveIdx + 1, items.length - 1); highlightAc(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); acActiveIdx = Math.max(acActiveIdx - 1, 0); highlightAc(items); }
      else if (e.key === "Enter" && acActiveIdx >= 0) { e.preventDefault(); items[acActiveIdx]?.click(); }
      else if (e.key === "Escape") { closeAc(); }
    });

    document.addEventListener("click", function (e) {
      if (!acList.contains(e.target) && e.target !== nameInput) closeAc();
    });

    BuildAuth.onAuthChange(function (user) {
      if (user) refreshClients();
      else { cachedClients = []; closeAc(); }
    });
  }

  async function refreshClients() {
    cachedClients = await BuildAuth.loadClients();
  }

  function showMatches(query) {
    var matches = cachedClients.filter(function (c) {
      return (c.name || "").toLowerCase().indexOf(query) !== -1;
    }).slice(0, 6);

    if (matches.length === 0) { closeAc(); return; }

    acActiveIdx = -1;
    acList.innerHTML = "";
    matches.forEach(function (client, idx) {
      var item = document.createElement("div");
      item.className = "bwt-ac-item";
      var products = (client.usedIn || []).map(function (p) {
        return '<span class="bwt-ac-badge">' + escHtml(p) + '</span>';
      }).join("");
      item.innerHTML =
        '<div class="bwt-ac-name">' + escHtml(client.name) + products + '</div>' +
        (client.email ? '<div class="bwt-ac-detail">' + escHtml(client.email) + (client.address ? ' · ' + escHtml(client.address) : '') + '</div>' : '');

      item.addEventListener("click", function () { selectClient(client); });
      acList.appendChild(item);
    });
    acList.classList.add("open");
  }

  function selectClient(client) {
    setVal("toName", client.name);
    if (client.email) setVal("toEmail", client.email);
    if (client.address) {
      var parts = client.address.split(", ");
      if (parts[0]) setVal("toStreet", parts[0]);
      if (parts[1]) setVal("toCity", parts[1]);
      if (parts[2]) setVal("toState", parts[2]);
    }
    closeAc();
  }

  function highlightAc(items) {
    items.forEach(function (it, i) {
      it.classList.toggle("active", i === acActiveIdx);
    });
  }

  function closeAc() {
    if (acList) { acList.classList.remove("open"); acList.innerHTML = ""; }
    acActiveIdx = -1;
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return "";
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
})();
