/**
 * contractTemplate.js
 * Generates a professional legal-grade Web Design & Development Agreement.
 * Used by ContractPage.jsx, LeadContracts.jsx, and SignContractPage.jsx
 * Single payment plan: one-time setup fee + monthly recurring.
 */

export function buildContractHTML(contract, designerSig = null, clientSig = null) {
  const c = contract
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const designerSignedDate = c.designer_signed_at
    ? new Date(c.designer_signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : today

  const clientSignedDate = c.client_signed_at
    ? new Date(c.client_signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // ── Pricing helpers ────────────────────────────────────────────────────────
  const rawSetup   = Number(c.setup_price   || 0)
  const rawMonthly = Number(c.monthly_price || 0)

  const setupPrice   = rawSetup   > 0 ? `$${rawSetup.toLocaleString()}`   : '[TO BE AGREED]'
  const monthlyPrice = rawMonthly > 0 ? `$${rawMonthly.toLocaleString()}` : '[TO BE AGREED]'

  const numPages = c.num_pages      || '5'
  const timeline = c.timeline_weeks || '4'

  const fullyExecuted = designerSig && clientSig

  const designerSigBlock = designerSig
    ? `<img src="${designerSig}" style="height:56px;max-width:220px;display:block;" alt="Designer signature"/>`
    : `<div style="height:56px;border-bottom:2px solid #1a1a2e;width:280px;"></div>`

  const clientSigBlock = clientSig
    ? `<img src="${clientSig}" style="height:56px;max-width:220px;display:block;" alt="Client signature"/>`
    : `<div style="height:56px;border-bottom:2px solid #1a1a2e;width:280px;"></div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Web Design & Development Agreement — ${c.client_name || 'Client'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'EB Garamond', 'Libre Baskerville', Georgia, 'Times New Roman', serif;
    font-size: 11.5pt;
    line-height: 1.75;
    color: #1a1a2e;
    background: #fff;
    max-width: 780px;
    margin: 0 auto;
    padding: 72px 80px 80px;
  }

  .doc-header {
    text-align: center;
    border-bottom: 3px double #1a1a2e;
    padding-bottom: 28px;
    margin-bottom: 32px;
  }
  .doc-header .firm-name {
    font-size: 13pt; font-weight: 700; letter-spacing: 3px;
    text-transform: uppercase; color: #1a1a2e; margin-bottom: 4px;
  }
  .doc-header .firm-sub {
    font-size: 9pt; letter-spacing: 2px; text-transform: uppercase;
    color: #555; margin-bottom: 20px;
  }
  .doc-title {
    font-size: 17pt; font-weight: 700; letter-spacing: 1px;
    text-transform: uppercase; color: #1a1a2e; margin-bottom: 6px;
  }
  .doc-subtitle { font-size: 9.5pt; color: #555; letter-spacing: 0.5px; }

  .executed-banner {
    background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 4px;
    padding: 10px 16px; margin-bottom: 28px; text-align: center;
    font-size: 9pt; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: #166534;
  }

  .preamble { margin-bottom: 28px; text-align: justify; }
  .preamble p { margin-bottom: 10px; }

  .parties-table { width: 100%; border-collapse: collapse; margin: 24px 0 28px; }
  .parties-table td {
    vertical-align: top; padding: 16px 20px; width: 50%;
    border: 1px solid #ccc; background: #fafafa;
  }
  .parties-table td:first-child { border-right: none; }
  .party-role {
    font-size: 7.5pt; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; color: #888; margin-bottom: 6px; display: block;
  }
  .party-name { font-size: 12pt; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .party-detail { font-size: 9.5pt; color: #444; line-height: 1.6; }

  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section-title {
    font-size: 10pt; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: #1a1a2e;
    border-bottom: 1px solid #1a1a2e; padding-bottom: 4px; margin-bottom: 12px;
  }
  .section p { text-align: justify; margin-bottom: 8px; font-size: 11pt; }
  .section ul, .section ol { margin: 8px 0 10px 24px; }
  .section li { margin-bottom: 5px; font-size: 11pt; text-align: justify; }

  /* ── Fee summary box ── */
  .fee-box {
    border: 1.5px solid #1a1a2e; padding: 18px 22px; margin: 14px 0 10px; background: #f8f8fc;
  }
  .fee-box table { width: 100%; border-collapse: collapse; }
  .fee-box td { padding: 5px 0; font-size: 11pt; vertical-align: top; }
  .fee-box td:first-child { color: #555; width: 60%; }
  .fee-box td:last-child { font-weight: 700; color: #1a1a2e; text-align: right; }
  .fee-box .divider-row td { padding-top: 10px; border-top: 1px solid #ccc; }

  .sig-page { margin-top: 48px; page-break-inside: avoid; }
  .sig-page-title {
    text-align: center; font-size: 9pt; letter-spacing: 2px;
    text-transform: uppercase; color: #888; margin-bottom: 28px;
  }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  .sig-label {
    font-size: 7.5pt; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; color: #888; margin-bottom: 10px; display: block;
  }
  .sig-image-area { min-height: 64px; margin-bottom: 6px; display: flex; align-items: flex-end; }
  .sig-line { border-bottom: 1.5px solid #1a1a2e; margin-bottom: 6px; }
  .sig-printed { font-size: 10pt; color: #1a1a2e; margin-bottom: 3px; }
  .sig-title { font-size: 9pt; color: #555; margin-bottom: 3px; }
  .sig-date { font-size: 9pt; color: #555; }

  .doc-footer {
    margin-top: 48px; padding-top: 16px; border-top: 1px solid #ccc;
    font-size: 8pt; color: #888; text-align: center; line-height: 1.6;
  }
  .definition { margin-bottom: 6px; }
  .definition strong { color: #1a1a2e; }

  @media print {
    @page { size: letter; margin: 0.8in 0.9in; }
    *,*::before,*::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      width: 100% !important; max-width: 100% !important;
      margin: 0 !important; padding: 0 !important;
      background: #fff !important; font-size: 10.5pt !important; line-height: 1.7 !important;
    }
    body { padding: 0 !important; margin: 0 !important; }
    .executed-banner { background: #f0fdf4 !important; border-color: #86efac !important; }
    .parties-table td { background: #fafafa !important; }
    .fee-box { background: #f8f8fc !important; }
    .section { page-break-inside: avoid; }
    .sig-page { page-break-inside: avoid; margin-top: 32pt !important; }
    .sig-grid { gap: 40pt !important; }
    a { text-decoration: none !important; color: inherit !important; }
  }
</style>
</head>
<body>

${fullyExecuted ? `<div class="executed-banner">✓ Fully Executed — Both Parties Have Signed This Agreement</div>` : ''}

<!-- HEADER -->
<div class="doc-header">
  <div class="firm-name">${c.designer_name || 'Web Design Services'}</div>
  <div class="firm-sub">Independent Web Design &amp; Development</div>
  <div class="doc-title">Web Design &amp; Development Agreement</div>
  <div class="doc-subtitle">Agreement Date: ${today} &nbsp;|&nbsp; Reference No: WDA-${c.id || '0001'}</div>
</div>

<!-- PREAMBLE -->
<div class="preamble">
  <p>
    This Web Design &amp; Development Agreement (the <strong>&ldquo;Agreement&rdquo;</strong>)
    is entered into as of <strong>${today}</strong> by and between the parties identified below.
    By signing, both parties acknowledge they have read, understand, and agree to be legally bound
    by all terms herein.
  </p>
</div>

<!-- PARTIES -->
<table class="parties-table">
  <tr>
    <td>
      <span class="party-role">Service Provider (&ldquo;Designer&rdquo;)</span>
      <div class="party-name">${c.designer_name || '—'}</div>
      <div class="party-detail">
        Independent Web Designer &amp; Developer<br/>
        ${c.designer_email ? `Email: ${c.designer_email}<br/>` : ''}
      </div>
    </td>
    <td>
      <span class="party-role">Client (&ldquo;Client&rdquo;)</span>
      <div class="party-name">${c.client_name || '—'}</div>
      <div class="party-detail">
        ${c.client_address ? `${c.client_address}<br/>` : ''}
        ${c.client_email ? `Email: ${c.client_email}<br/>` : ''}
      </div>
    </td>
  </tr>
</table>

<!-- 1. DEFINITIONS -->
<div class="section">
  <div class="section-title">1. Definitions</div>
  <div class="definition"><strong>&ldquo;Deliverables&rdquo;</strong> — the website and all related files, code, and content produced under this Agreement.</div>
  <div class="definition"><strong>&ldquo;Launch Date&rdquo;</strong> — the date the completed website is made publicly accessible.</div>
  <div class="definition"><strong>&ldquo;Monthly Services&rdquo;</strong> — ongoing hosting, maintenance, and support after Launch Date, billed monthly via Stripe.</div>
</div>

<!-- 2. SCOPE OF WORK -->
<div class="section">
  <div class="section-title">2. Scope of Work</div>
  <p>Designer agrees to design, develop, and deliver a professional website for Client, including:</p>
  <ul>
    <li>Custom website design and front-end development (up to <strong>${numPages} pages</strong>)</li>
    <li>Mobile-responsive design compatible with all modern browsers and devices</li>
    <li>Contact form with email notification functionality</li>
    <li>On-page SEO setup (meta tags, page titles, sitemap)</li>
    <li>Integration of Client-provided content, images, and branding materials</li>
    <li>Cross-browser testing and website launch setup</li>
    <li>One (1) round of revisions following initial design presentation</li>
  </ul>
  <p>Additional pages, features, or integrations not listed above require a written change order.</p>
</div>

<!-- 3. FEES AND PAYMENT -->
<div class="section">
  <div class="section-title">3. Fees and Payment Terms</div>

  <div class="fee-box">
    <table>
      <tr>
        <td>One-time setup fee (due today via Stripe)</td>
        <td>${setupPrice}</td>
      </tr>
      <tr class="divider-row">
        <td>Monthly hosting &amp; maintenance</td>
        <td>${monthlyPrice}/mo</td>
      </tr>
    </table>
  </div>

  <p><strong>3.1 Setup Fee</strong></p>
  <p>
    Client shall pay a one-time setup fee of <strong>${setupPrice}</strong> in full via Stripe
    prior to commencement of any design or development work. This fee is
    <strong>non-refundable</strong> once work has commenced.
  </p>

  <p><strong>3.2 Monthly Services</strong></p>
  <p>
    Following the Launch Date, Client will be billed <strong>${monthlyPrice}/mo</strong> for
    ongoing hosting, maintenance, and support. This rate remains fixed unless both parties
    agree in writing to a change.
  </p>

  <p><strong>3.3 Payment Method — Monthly Services</strong></p>
  <p>
    All recurring Monthly Service fees are billed via <strong>Stripe</strong> starting on the
    Launch Date. Client will receive a Stripe subscription link upon contract execution.
    Invoices are due within seven (7) days of receipt.
  </p>

  <p><strong>3.4 Late Fees</strong></p>
  <p>
    Payments more than fifteen (15) days past due accrue a late fee of <strong>1.5% per month</strong>
    on the outstanding balance. Designer may suspend hosting services upon written notice if monthly
    payment is not received within fifteen (15) days of the due date.
  </p>
</div>

<!-- 4. PROJECT TIMELINE -->
<div class="section">
  <div class="section-title">4. Project Timeline</div>
  <p>
    Estimated timeline: <strong>${timeline} weeks</strong> from receipt of (i) the signed Agreement,
    (ii) the setup fee payment, and (iii) all Project Materials from Client. This is an estimate;
    Designer is not liable for delays caused by Client.
  </p>
</div>

<!-- 5. CLIENT RESPONSIBILITIES -->
<div class="section">
  <div class="section-title">5. Client Responsibilities</div>
  <ul>
    <li>Provide all Project Materials within five (5) business days of executing this Agreement</li>
    <li>Respond to feedback or approval requests within three (3) business days</li>
    <li>Provide access to any third-party accounts necessary for project completion</li>
    <li>Provide written Final Approval before website launch</li>
  </ul>
</div>

<!-- 6. REVISIONS -->
<div class="section">
  <div class="section-title">6. Revisions and Change Orders</div>
  <p>
    Unlimited minor revisions (content changes, color/font adjustments, layout tweaks) are included.
    Major changes — new pages, significant redesigns, new functionality — require a written change
    order with additional fees.
  </p>
</div>

<!-- 7. INTELLECTUAL PROPERTY -->
<div class="section">
  <div class="section-title">7. Intellectual Property and Ownership</div>
  <p>
    <strong>7.1</strong> Upon receipt of all payments in full, Designer assigns all rights in the
    completed Deliverables to Client. Prior to full payment, Designer retains all intellectual
    property rights.
  </p>
  <p>
    <strong>7.2</strong> Designer retains the right to display the completed website in Designer's
    portfolio and marketing materials.
  </p>
  <p>
    <strong>7.3</strong> Client warrants it owns or has rights to all Project Materials provided.
  </p>
</div>

<!-- 8. CONFIDENTIALITY -->
<div class="section">
  <div class="section-title">8. Confidentiality</div>
  <p>
    Each party shall keep confidential all proprietary information disclosed by the other in
    connection with this Agreement. This obligation survives termination.
  </p>
</div>

<!-- 9. MONTHLY SERVICES AND CANCELLATION -->
<div class="section">
  <div class="section-title">9. Monthly Services and Cancellation</div>
  <p>
    <strong>9.1</strong> Monthly Services commence on the Launch Date and continue month-to-month
    until terminated by either party.
  </p>
  <p>
    <strong>9.2</strong> Client may cancel with <strong>thirty (30) days&rsquo; written notice</strong>.
    Upon cancellation, Designer delivers all website files within fourteen (14) days.
    Designer is not liable for downtime or data loss after termination of Monthly Services.
  </p>
</div>

<!-- 10. TERMINATION -->
<div class="section">
  <div class="section-title">10. Termination</div>
  <p>
    Either party may terminate with <strong>fourteen (14) days&rsquo; written notice</strong>.
    The setup fee is non-refundable once work has commenced; Client pays for all work completed
    through the termination date. Either party may terminate immediately for material breach not
    cured within ten (10) days of written notice.
  </p>
</div>

<!-- 11. WARRANTIES -->
<div class="section">
  <div class="section-title">11. Warranties</div>
  <p>
    Designer warrants Deliverables will be original, professionally produced, and functional as
    described for <strong>thirty (30) days</strong> after Launch Date. Material defects reported
    during this period will be corrected at no charge.
    EXCEPT AS STATED HEREIN, DESIGNER MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED.
  </p>
</div>

<!-- 12. LIMITATION OF LIABILITY -->
<div class="section">
  <div class="section-title">12. Limitation of Liability</div>
  <p>
    DESIGNER&rsquo;S TOTAL LIABILITY SHALL NOT EXCEED FEES PAID IN THE THREE (3) MONTHS
    PRECEDING THE CLAIM. DESIGNER SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL,
    OR PUNITIVE DAMAGES OF ANY KIND.
  </p>
</div>

<!-- 13. INDEMNIFICATION -->
<div class="section">
  <div class="section-title">13. Indemnification</div>
  <p>
    Client indemnifies and holds Designer harmless from claims arising out of Client&rsquo;s breach
    of this Agreement or Client-provided content that infringes third-party rights.
  </p>
</div>

<!-- 14. GENERAL PROVISIONS -->
<div class="section">
  <div class="section-title">14. General Provisions</div>
  <p><strong>14.1 Entire Agreement.</strong> This Agreement supersedes all prior understandings. Amendments must be in writing signed by both parties.</p>
  <p><strong>14.2 Severability.</strong> If any provision is invalid, the remaining provisions continue in full force.</p>
  <p><strong>14.3 Independent Contractor.</strong> Designer is an independent contractor, not an employee or partner of Client.</p>
  <p><strong>14.4 Force Majeure.</strong> Neither party is liable for delays caused by circumstances beyond their reasonable control.</p>
</div>

<!-- SIGNATURE PAGE -->
<div class="sig-page">
  <div class="sig-page-title">— Signature Page —</div>
  <p style="text-align:justify;margin-bottom:28px;font-size:11pt;">
    IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.
    Each signatory represents they are duly authorized to bind the respective party.
  </p>
  <div class="sig-grid">
    <div>
      <span class="sig-label">Designer / Service Provider</span>
      <div class="sig-image-area">${designerSigBlock}</div>
      <div class="sig-line"></div>
      <div class="sig-printed"><strong>${c.designer_name || '________________________________'}</strong></div>
      <div class="sig-title">Independent Web Designer</div>
      <div class="sig-date">Date: ${designerSig ? designerSignedDate : '________________________________'}</div>
    </div>
    <div>
      <span class="sig-label">Client</span>
      <div class="sig-image-area">${clientSigBlock}</div>
      <div class="sig-line"></div>
      <div class="sig-printed"><strong>${c.client_name || '________________________________'}</strong></div>
      <div class="sig-title">${c.client_address || 'Client Representative'}</div>
      <div class="sig-date">Date: ${clientSig ? (clientSignedDate || today) : '________________________________'}</div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="doc-footer">
  Web Design &amp; Development Agreement &nbsp;|&nbsp; ${c.designer_name || 'Designer'} &amp; ${c.client_name || 'Client'}
  &nbsp;|&nbsp; Reference No: WDA-${c.id || '0001'} &nbsp;|&nbsp; Effective Date: ${today}<br/>
  This document constitutes a legally binding agreement. Both parties should retain a signed copy for their records.
</div>

</body>
</html>`
}