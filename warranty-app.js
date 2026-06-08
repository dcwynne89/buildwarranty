/* ============================================================
   warranty-app.js — Consumer site logic for BuildWarranty
   Manages form state, live preview, and PDF download
   ============================================================ */

// ── Guest API key ─────────────────────────────────────────────
const GUEST_KEY_STORAGE = "bwt_guest_key";
const API_BASE = "/api/v1";

async function getOrCreateGuestKey() {
  let key = localStorage.getItem(GUEST_KEY_STORAGE);
  if (key && key.startsWith("bwt_")) return key;

  const email = `guest_${Date.now()}_${Math.random().toString(36).slice(2)}@buildwarranty.co`;
  try {
    const res  = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.success && data.api_key) {
      localStorage.setItem(GUEST_KEY_STORAGE, data.api_key);
      return data.api_key;
    }
  } catch (e) { console.warn("Guest key registration failed:", e); }
  return null;
}

// ── State ─────────────────────────────────────────────────────
let accentColor = "#d97706";
let isGenerating = false;

// ── DOM refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Set default date to today
  const today = new Date();
  $("warrantyDate").value = today.toISOString().split("T")[0];

  // Auto-calc expiration on load
  calcExpiration();
  bindEvents();
  updatePreview();
  getOrCreateGuestKey();
});

function bindEvents() {
  // Color picker
  $("accentColor").addEventListener("input", (e) => {
    accentColor = e.target.value;
    $("accentColorHex").value = e.target.value;
    updatePreview();
  });
  $("accentColorHex").addEventListener("input", (e) => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
      accentColor = e.target.value;
      $("accentColor").value = e.target.value;
      updatePreview();
    }
  });

  // Download
  $("btnDownload").addEventListener("click", downloadWarranty);

  // Auto-calc expiration when date, duration, or unit changes
  $("warrantyDate").addEventListener("input", () => { calcExpiration(); updatePreview(); });
  $("duration").addEventListener("input", () => { calcExpiration(); updatePreview(); });
  $("durationUnit").addEventListener("change", () => { calcExpiration(); updatePreview(); });

  // Listen to all form inputs for live preview
  document.querySelectorAll("input, textarea, select").forEach((el) => {
    el.addEventListener("input", () => { updatePreview(); });
  });

  // Toast close
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("toast")) e.target.classList.remove("show");
  });
}

// ── Expiration Calculation ────────────────────────────────────
function calcExpiration() {
  const dateStr = $("warrantyDate").value;
  const dur     = parseInt($("duration").value) || 0;
  const unit    = $("durationUnit").value;

  if (!dateStr || dur <= 0) {
    $("expirationDate").value = "";
    return;
  }

  const startDate = new Date(dateStr + "T00:00:00");
  if (isNaN(startDate.getTime())) { $("expirationDate").value = ""; return; }

  let expDate = new Date(startDate);

  if (unit === "years") {
    expDate.setFullYear(expDate.getFullYear() + dur);
  } else if (unit === "months") {
    expDate.setMonth(expDate.getMonth() + dur);
  } else if (unit === "days") {
    expDate.setDate(expDate.getDate() + dur);
  }

  // Format as YYYY-MM-DD
  const y = expDate.getFullYear();
  const m = String(expDate.getMonth() + 1).padStart(2, "0");
  const d = String(expDate.getDate()).padStart(2, "0");
  $("expirationDate").value = `${y}-${m}-${d}`;
}

// ── Live Preview ──────────────────────────────────────────────
function updatePreview() {
  const data = collectFormData();
  $("previewBody").innerHTML = renderPreviewHTML(data);
}

function collectFormData() {
  return {
    from: {
      name:    $("fromName").value,
      email:   $("fromEmail").value,
      address: [$("fromStreet").value, $("fromCity").value, $("fromState").value].filter(Boolean).join(", "),
      phone:   $("fromPhone").value,
    },
    to: {
      name:    $("toName").value,
      email:   $("toEmail").value,
      address: [$("toStreet").value, $("toCity").value, $("toState").value].filter(Boolean).join(", "),
    },
    warranty: {
      number:         $("warrantyNumber").value || "WRT-001",
      date:           $("warrantyDate").value,
      type:           $("warrantyType").value,
      duration:       $("duration").value,
      durationUnit:   $("durationUnit").value,
      expirationDate: $("expirationDate").value,
      transferable:   $("transferable").value,
    },
    projectDescription:  $("projectDescription").value,
    coverageDescription: $("coverageDescription").value,
    exclusions:          $("exclusions").value,
    claimProcess:        $("claimProcess").value,
    contactInfo:         $("contactInfo").value,
    terms:               $("terms").value,
    color:               accentColor,
  };
}

function renderPreviewHTML(d) {
  const col  = d.color || "#d97706";
  const esc  = escHtml;

  // Warranty type label
  const typeLabels = {
    workmanship:     "Workmanship",
    materials:       "Materials",
    parts_and_labor: "Parts & Labor",
    comprehensive:   "Comprehensive",
    limited:         "Limited",
    extended:        "Extended",
  };
  const typeLabel = typeLabels[d.warranty.type] || "—";

  // Duration display
  const durNum  = d.warranty.duration || "—";
  const durUnit = d.warranty.durationUnit ? d.warranty.durationUnit.charAt(0).toUpperCase() + d.warranty.durationUnit.slice(1) : "";
  const durText = `${durNum} ${durUnit}`;

  // Transferable
  const transferLabel = d.warranty.transferable === "yes" ? "Yes" : "No";

  // Multiline helper
  const nl2br = (str) => esc(str).replace(/\n/g, "<br>");

  return `
    <div style="font-family:Inter,sans-serif;font-size:12px;color:#1a202c;padding:24px;background:#fff;min-height:600px;position:relative;overflow:hidden;">
      <!-- Shield watermark -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:120px;opacity:0.04;pointer-events:none;z-index:0;">🛡️</div>

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;position:relative;z-index:1;">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1a202c;">${esc(d.from.name) || "<span style='color:#aaa'>Your Business</span>"}</div>
          ${d.from.address ? `<div style="color:#718096;font-size:11px;margin-top:2px;">${esc(d.from.address)}</div>` : ""}
          ${d.from.email   ? `<div style="color:#718096;font-size:11px;">${esc(d.from.email)}</div>` : ""}
          ${d.from.phone   ? `<div style="color:#718096;font-size:11px;">${esc(d.from.phone)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;font-weight:700;color:#718096;letter-spacing:2px;">WARRANTY CERTIFICATE</div>
          <div style="font-size:20px;font-weight:800;color:${col};">#${esc(d.warranty.number)}</div>
          ${d.warranty.date ? `<div style="font-size:10px;color:#4a5568;">Date: ${d.warranty.date}</div>` : ""}
        </div>
      </div>

      <!-- Divider -->
      <div style="height:4px;background:${col};border-radius:2px;margin-bottom:16px;position:relative;z-index:1;"></div>

      <!-- Shield badge & warranty type -->
      <div style="text-align:center;margin-bottom:16px;position:relative;z-index:1;">
        <div style="display:inline-block;font-size:32px;margin-bottom:4px;">🛡️</div>
        <div style="font-size:14px;font-weight:800;color:${col};letter-spacing:1px;text-transform:uppercase;">${esc(typeLabel)} WARRANTY</div>
        <div style="font-size:11px;color:#4a5568;margin-top:2px;">Duration: <strong>${esc(durText)}</strong> · Transferable: <strong>${esc(transferLabel)}</strong></div>
        ${d.warranty.expirationDate ? `<div style="font-size:11px;color:#4a5568;">Expires: <strong>${d.warranty.expirationDate}</strong></div>` : ""}
      </div>

      <!-- Warrantor / Holder -->
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1;">
        <div>
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">WARRANTY HOLDER</div>
          <div style="font-weight:700;font-size:13px;">${esc(d.to.name) || "<span style='color:#aaa'>Client Name</span>"}</div>
          ${d.to.address ? `<div style="color:#718096;font-size:10px;">${esc(d.to.address)}</div>` : ""}
          ${d.to.email   ? `<div style="color:#718096;font-size:10px;">${esc(d.to.email)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">WARRANTOR</div>
          <div style="font-weight:700;font-size:13px;">${esc(d.from.name) || "<span style='color:#aaa'>Your Business</span>"}</div>
          ${d.from.phone ? `<div style="color:#718096;font-size:10px;">${esc(d.from.phone)}</div>` : ""}
          ${d.from.email ? `<div style="color:#718096;font-size:10px;">${esc(d.from.email)}</div>` : ""}
        </div>
      </div>

      <!-- Project Description -->
      ${d.projectDescription ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">PROJECT DESCRIPTION</div>
          <div style="font-size:10px;color:#4a5568;background:#f7f7f7;padding:8px 10px;border-radius:4px;border-left:3px solid ${col};">${nl2br(d.projectDescription)}</div>
        </div>
      ` : ""}

      <!-- Coverage -->
      ${d.coverageDescription ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">COVERAGE</div>
          <div style="font-size:10px;color:#4a5568;background:#f0fdf4;padding:8px 10px;border-radius:4px;border-left:3px solid #22c55e;">${nl2br(d.coverageDescription)}</div>
        </div>
      ` : ""}

      <!-- Exclusions -->
      ${d.exclusions ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:#ef4444;letter-spacing:1px;margin-bottom:4px;">EXCLUSIONS</div>
          <div style="font-size:10px;color:#4a5568;background:#fef2f2;padding:8px 10px;border-radius:4px;border-left:3px solid #ef4444;">${nl2br(d.exclusions)}</div>
        </div>
      ` : ""}

      <!-- Claim Process -->
      ${d.claimProcess ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">CLAIM PROCESS</div>
          <div style="font-size:10px;color:#4a5568;">${nl2br(d.claimProcess)}</div>
        </div>
      ` : ""}

      <!-- Contact Info -->
      ${d.contactInfo ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">WARRANTY SERVICE CONTACT</div>
          <div style="font-size:10px;color:#4a5568;">${nl2br(d.contactInfo)}</div>
        </div>
      ` : ""}

      <!-- Terms -->
      ${d.terms ? `
        <div style="margin-bottom:12px;position:relative;z-index:1;">
          <div style="font-size:8px;font-weight:700;color:${col};letter-spacing:1px;margin-bottom:4px;">TERMS & CONDITIONS</div>
          <div style="font-size:9px;color:#718096;line-height:1.5;">${nl2br(d.terms)}</div>
        </div>
      ` : ""}

      <!-- Dual Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;position:relative;z-index:1;">
        <div style="width:45%;">
          <div style="border-bottom:1px solid #cbd5e0;height:32px;margin-bottom:4px;"></div>
          <div style="font-size:9px;color:#718096;">Warrantor Signature</div>
          <div style="font-size:9px;color:#a0aec0;">${esc(d.from.name) || "Your Business"}</div>
        </div>
        <div style="width:45%;text-align:right;">
          <div style="border-bottom:1px solid #cbd5e0;height:32px;margin-bottom:4px;"></div>
          <div style="font-size:9px;color:#718096;">Warranty Holder Signature</div>
          <div style="font-size:9px;color:#a0aec0;">${esc(d.to.name) || "Client Name"}</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:16px;font-size:9px;color:#a0aec0;position:relative;z-index:1;">This warranty certificate is a binding document between the warrantor and the warranty holder.</div>
    </div>
  `;
}

// ── Download ──────────────────────────────────────────────────
async function downloadWarranty() {
  if (isGenerating) return;

  const data = collectFormData();
  if (!data.from.name) { showToast("Enter your business name to generate a warranty.", "error"); return; }
  if (!data.to.name)   { showToast("Enter a client name to generate a warranty.", "error"); return; }

  isGenerating = true;
  $("btnDownload").disabled = true;
  $("btnDownload").textContent = "Generating...";

  const previewHTML = renderPreviewHTML(collectFormData());
  const toName = $("toName")?.value || 'customer';
  const num = $("warrantyNumber")?.value || 'WRT-001';
  const filename = `warranty-${toName.replace(/\s+/g, '-').toLowerCase()}-${num}.pdf`;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>${filename}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #fff; }
        @media print { body { margin: 0; } @page { size: letter; margin: 0.5in; } }
      </style>
    </head><body>
      ${previewHTML}
      <script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});</script>
    </body></html>
  `);
  printWindow.document.close();

  isGenerating = false;
  $("btnDownload").disabled = false;
  $("btnDownload").textContent = "\u2b07 Download Warranty PDF";
  showToast("Warranty ready \u2014 use Save as PDF in the print dialog", "success");
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, type = "success") {
  const toast = $("toast");
  toast.textContent = msg;
  toast.className   = `toast toast--${type} show`;
  setTimeout(() => toast.classList.remove("show"), 4000);
}
