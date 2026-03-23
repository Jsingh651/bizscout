/**
 * contractTemplate.js
 * Web Design & Development Agreement — California governing law
 * Payment plan: 50% deposit upfront + 50% final payment on completion + monthly recurring.
 * Designers: Jang Singh & Derek Lum (independent contractors)
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

  const rawDeposit   = Math.round(rawSetup / 2)
  const setupPrice   = rawSetup   > 0 ? `$${rawSetup.toLocaleString()}`   : '[TO BE AGREED]'
  const depositPrice = rawSetup   > 0 ? `$${rawDeposit.toLocaleString()}` : '[TO BE AGREED]'
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
    is entered into as of <strong>${today}</strong> (the <strong>&ldquo;Effective Date&rdquo;</strong>)
    by and between the parties identified below. This Agreement constitutes a legally binding
    contract under the laws of the State of California. By signing, each party represents
    they have read, understand, and agree to be bound by all terms and conditions herein.
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
        State of Operation: California
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
  <div class="definition"><strong>&ldquo;Agreement&rdquo;</strong> — this Web Design &amp; Development Agreement, including any written change orders or addenda signed by both parties.</div>
  <div class="definition"><strong>&ldquo;Deliverables&rdquo;</strong> — the completed website and all related source files, code, graphics, and content produced by Designer specifically for Client under this Agreement.</div>
  <div class="definition"><strong>&ldquo;Project Materials&rdquo;</strong> — all content, images, logos, text, credentials, and other assets provided by Client for use in the project.</div>
  <div class="definition"><strong>&ldquo;Launch Date&rdquo;</strong> — the date the completed website is made publicly accessible on Client&rsquo;s domain.</div>
  <div class="definition"><strong>&ldquo;Monthly Services&rdquo;</strong> — the ongoing website hosting, maintenance, security monitoring, minor content updates, and support provided after the Launch Date, billed monthly via Stripe.</div>
  <div class="definition"><strong>&ldquo;Client Satisfaction Agreement&rdquo;</strong> — a separate written sign-off executed by Client prior to Invoice #2, confirming Client&rsquo;s acceptance of the completed Deliverables.</div>
</div>

<!-- 2. SCOPE OF WORK -->
<div class="section">
  <div class="section-title">2. Scope of Work</div>
  <p>Designer agrees to design, develop, and deliver a professional website for Client, including the following:</p>
  <ul>
    <li>Custom website design and front-end development (up to <strong>${numPages} pages</strong>)</li>
    <li>Mobile-responsive design compatible with all modern browsers and devices</li>
    <li>Contact form with email notification functionality</li>
    <li>On-page SEO setup (meta tags, page titles, image alt text, XML sitemap)</li>
    <li>Integration of Client-provided content, images, and branding materials</li>
    <li>Cross-browser compatibility testing and website launch configuration</li>
    <li>One (1) round of design revisions following initial design presentation</li>
  </ul>
  <p>
    Any features, pages, or integrations not expressly listed above are excluded from this Agreement
    and shall require a written change order signed by both parties prior to commencement.
    Designer reserves the right to decline change order requests that fall outside Designer&rsquo;s
    skill set or reasonable capacity.
  </p>
</div>

<!-- 3. FEES AND PAYMENT -->
<div class="section">
  <div class="section-title">3. Fees and Payment Terms</div>

  <div class="fee-box">
    <table>
      <tr>
        <td>Invoice #1 &mdash; Deposit (50% of setup fee, due upon signing)</td>
        <td>${depositPrice}</td>
      </tr>
      <tr>
        <td>Invoice #2 &mdash; Final Payment (50% of setup fee, due upon completion)</td>
        <td>${depositPrice}</td>
      </tr>
      <tr class="divider-row">
        <td><strong>Total one-time setup fee</strong></td>
        <td>${setupPrice}</td>
      </tr>
      <tr class="divider-row">
        <td>Monthly hosting &amp; maintenance (commences on Launch Date)</td>
        <td>${monthlyPrice}/mo</td>
      </tr>
    </table>
  </div>

  <p><strong>3.1 Deposit — Invoice #1.</strong></p>
  <p>
    Client shall pay a non-refundable deposit of <strong>${depositPrice}</strong>, representing
    fifty percent (50%) of the total setup fee, via Stripe upon execution of this Agreement.
    Work shall not commence until the deposit payment is confirmed. The deposit is
    <strong>non-refundable under all circumstances</strong>, including but not limited to Client
    changing direction, ceasing operations, or electing not to proceed with the project after
    work has begun. In extraordinary circumstances at Designer&rsquo;s sole and absolute discretion,
    a partial refund may be considered, but Client shall have no legal right to demand one.
  </p>

  <p><strong>3.2 Final Payment — Invoice #2.</strong></p>
  <p>
    Upon substantial completion of the website, and after Client executes the Client Satisfaction
    Agreement, Designer shall issue a final invoice for the remaining <strong>${depositPrice}</strong>
    (50% of the total setup fee). The website will not be launched and files will not be transferred
    to Client until the final payment is received in full. Invoice #2 also initiates the monthly
    hosting subscription described in Section 9.
  </p>

  <p><strong>3.3 Non-Payment of Invoice #2.</strong></p>
  <p>
    If Client fails to pay Invoice #2 within thirty (30) days of issuance, Designer reserves the
    right to take the website offline without further notice. The deposit paid under Invoice #1
    shall be forfeited in its entirety. Designer shall have no obligation to deliver source files
    or restore the website without receipt of full payment. Designer&rsquo;s primary remedy for
    non-payment is service termination; Designer is not obligated to pursue legal action.
  </p>

  <p><strong>3.4 Late Fees.</strong></p>
  <p>
    Any payment not received within fifteen (15) calendar days of its due date shall accrue a
    late fee of <strong>1.5% per month</strong> (18% per annum) on the outstanding balance,
    compounding monthly, until paid in full.
  </p>

  <p><strong>3.5 Payment Method.</strong></p>
  <p>
    All payments are processed via Stripe. Client authorizes Designer to charge the payment
    method on file in accordance with the schedule above. Client is responsible for keeping
    payment information current.
  </p>
</div>

<!-- 4. PROJECT TIMELINE -->
<div class="section">
  <div class="section-title">4. Project Timeline</div>
  <p>
    The estimated project timeline is <strong>${timeline} weeks</strong>, commencing upon Designer&rsquo;s
    receipt of all three of the following: (i) the fully executed Agreement; (ii) confirmed deposit
    payment; and (iii) all required Project Materials from Client. This timeline is an estimate
    only. Designer shall not be liable for delays caused by Client&rsquo;s failure to provide
    timely feedback, materials, or approvals, or by circumstances outside Designer&rsquo;s reasonable
    control. Any Client-caused delay exceeding ten (10) business days may result in a revised
    timeline or additional fees, which shall be documented in a written change order.
  </p>
</div>

<!-- 5. CLIENT RESPONSIBILITIES -->
<div class="section">
  <div class="section-title">5. Client Responsibilities</div>
  <p>Client agrees to:</p>
  <ul>
    <li>Provide all Project Materials (text, images, logos, brand assets) within <strong>five (5) business days</strong> of executing this Agreement</li>
    <li>Respond to all design mockups, feedback requests, and approval prompts within <strong>three (3) business days</strong></li>
    <li>Provide access to any third-party platforms, domain registrars, or hosting accounts necessary for project completion</li>
    <li>Review the completed website and execute the Client Satisfaction Agreement prior to the issuance of Invoice #2</li>
    <li>Provide written final approval before the website is launched publicly</li>
    <li>Ensure all Project Materials provided are original, licensed, or otherwise legally authorized for use</li>
  </ul>
  <p>
    Designer shall not be responsible for delays, errors, or omissions arising from Client&rsquo;s
    failure to fulfill the above responsibilities.
  </p>
</div>

<!-- 6. CLIENT SATISFACTION AGREEMENT -->
<div class="section">
  <div class="section-title">6. Client Satisfaction &amp; Acceptance</div>
  <p>
    Prior to the issuance of Invoice #2, Designer will provide Client with a link to review the
    completed website and execute a Client Satisfaction Agreement. By signing the Client
    Satisfaction Agreement, Client expressly:
  </p>
  <ul>
    <li>Confirms that Client has reviewed and is satisfied with the completed Deliverables</li>
    <li>Accepts the website design, layout, and functionality as presented</li>
    <li>Authorizes Designer to issue Invoice #2 for final payment</li>
    <li>Waives any right to dispute the quality or completeness of the design work reviewed</li>
  </ul>
  <p>
    Client&rsquo;s execution of the Client Satisfaction Agreement is a condition precedent to
    final billing. Designer shall not be liable for any design-related claims arising after
    Client has signed the Client Satisfaction Agreement.
  </p>
</div>

<!-- 7. REVISIONS AND CHANGE ORDERS -->
<div class="section">
  <div class="section-title">7. Revisions and Change Orders</div>
  <p>
    <strong>7.1 During Development.</strong> One (1) round of revisions is included following the
    initial design presentation. Minor refinements (color adjustments, font changes, copy edits,
    layout tweaks) within this round are included at no additional cost. Additional revision
    rounds require a written change order.
  </p>
  <p>
    <strong>7.2 Major Changes.</strong> Requests that materially alter the agreed scope — including
    but not limited to additional pages, new functionality, platform migrations, or significant
    redesigns — constitute a change order and are subject to additional fees and timeline
    adjustments to be agreed in writing by both parties.
  </p>
  <p>
    <strong>7.3 Changes After Launch.</strong> Minor content updates during the Monthly Services
    period (Section 9) are handled at Designer&rsquo;s discretion. Structural changes or new
    feature development after launch are outside the scope of Monthly Services and require a
    separate agreement.
  </p>
</div>

<!-- 8. INTELLECTUAL PROPERTY -->
<div class="section">
  <div class="section-title">8. Intellectual Property and Ownership</div>
  <p>
    <strong>8.1 Transfer of Ownership.</strong> Upon receipt of all payments in full (Invoice #1
    and Invoice #2), Designer assigns to Client all right, title, and interest in the completed
    Deliverables, including all copyrights therein. Prior to full payment, Designer retains full
    ownership of all work product and Client acquires no license or ownership rights.
  </p>
  <p>
    <strong>8.2 Portfolio Rights.</strong> Designer retains an irrevocable, royalty-free right to
    display the completed website in Designer&rsquo;s portfolio, case studies, and promotional
    materials, unless Client provides written objection within thirty (30) days of launch.
  </p>
  <p>
    <strong>8.3 Client Materials.</strong> Client represents and warrants that it owns or holds
    all necessary rights, licenses, and permissions to use all Project Materials provided to
    Designer. Client shall indemnify Designer against any third-party claims arising from
    Client-provided content.
  </p>
  <p>
    <strong>8.4 Third-Party Components.</strong> The website may incorporate open-source libraries,
    stock assets, or third-party frameworks subject to their respective licenses. Designer shall
    use only legally licensed third-party components.
  </p>
</div>

<!-- 9. MONTHLY SERVICES -->
<div class="section">
  <div class="section-title">9. Monthly Services and Cancellation</div>
  <p>
    <strong>9.1 Commencement.</strong> Monthly Services commence automatically on the Launch Date
    and continue on a month-to-month basis until cancelled in accordance with this Section.
  </p>
  <p>
    <strong>9.2 What Is Included.</strong> The monthly fee of <strong>${monthlyPrice}/mo</strong> covers:
  </p>
  <ul>
    <li><strong>Website Hosting:</strong> Designer will keep the website live and accessible. Designer is not liable for downtime caused by third-party infrastructure providers (e.g., server outages, DNS failures, or force majeure events beyond Designer&rsquo;s reasonable control).</li>
    <li><strong>Security Maintenance:</strong> If Designer identifies a security vulnerability, Designer will take reasonable steps to remediate it. Designer does not warrant the website will be free from all security threats.</li>
    <li><strong>Minor Content Updates:</strong> Designer will perform minor content updates (e.g., swapping images, updating logos, editing text) at Designer&rsquo;s discretion. Client acknowledges these updates are provided as a courtesy and are subject to Designer&rsquo;s available bandwidth. No specific turnaround time is guaranteed for content updates.</li>
    <li><strong>Support:</strong> Designer will respond to Client support inquiries within <strong>three (3) business days</strong> using commercially reasonable efforts. Designer is not obligated to provide 24/7 availability or guaranteed response times beyond this soft commitment.</li>
  </ul>
  <p>
    <strong>9.3 What Is Not Included.</strong> Monthly Services do not include new feature development,
    additional pages, third-party integrations, e-commerce functionality, or any work that
    constitutes a material change to the website. Such work requires a separate written agreement.
  </p>
  <p>
    <strong>9.4 Cancellation by Client.</strong> Client may cancel Monthly Services at any time by
    providing <strong>thirty (30) days&rsquo; written notice</strong> to Designer via email.
    Upon expiration of the notice period, Designer will deliver all website source files to Client
    within fourteen (14) calendar days. Designer is not liable for any downtime, data loss, or
    business interruption following termination of Monthly Services.
  </p>
  <p>
    <strong>9.5 Suspension for Non-Payment.</strong> If any monthly payment is not received within
    fifteen (15) calendar days of the billing date, Designer may suspend hosting services without
    further notice until the outstanding balance is paid in full.
  </p>
</div>

<!-- 10. TERMINATION -->
<div class="section">
  <div class="section-title">10. Termination</div>
  <p>
    <strong>10.1 Termination for Convenience.</strong> Either party may terminate this Agreement
    upon <strong>fourteen (14) days&rsquo; written notice</strong>. The deposit paid under
    Invoice #1 is non-refundable upon termination. Client shall pay Designer for all work
    completed through the effective termination date, calculated on a pro-rata basis against
    the total setup fee.
  </p>
  <p>
    <strong>10.2 Termination for Cause.</strong> Either party may terminate immediately upon
    written notice if the other party commits a material breach of this Agreement and fails to
    cure such breach within ten (10) business days of receiving written notice describing the
    breach in reasonable detail.
  </p>
  <p>
    <strong>10.3 Effect of Termination.</strong> Upon termination: (a) all licenses granted to
    Client terminate immediately; (b) Designer may take the website offline; (c) Designer will
    deliver completed work files only upon receipt of all amounts owed; (d) all payment
    obligations accrued prior to termination survive.
  </p>
</div>

<!-- 11. WARRANTIES AND DISCLAIMER -->
<div class="section">
  <div class="section-title">11. Warranties and Disclaimer</div>
  <p>
    <strong>11.1 Designer Warranty.</strong> Designer warrants that the Deliverables will be
    original work (except for third-party components disclosed to Client), professionally
    produced, and functional as described in Section 2 for a period of <strong>thirty (30) days</strong>
    following the Launch Date. Material functional defects reported in writing during this
    warranty period will be corrected by Designer at no additional charge.
  </p>
  <p>
    <strong>11.2 Disclaimer.</strong> EXCEPT AS EXPRESSLY SET FORTH IN SECTION 11.1, DESIGNER
    MAKES NO WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
    WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
    DESIGNER DOES NOT WARRANT THAT THE WEBSITE WILL ACHIEVE ANY PARTICULAR BUSINESS RESULT,
    SEARCH ENGINE RANKING, OR LEVEL OF TRAFFIC.
  </p>
</div>

<!-- 12. LIMITATION OF LIABILITY -->
<div class="section">
  <div class="section-title">12. Limitation of Liability</div>
  <p>
    TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DESIGNER&rsquo;S TOTAL CUMULATIVE
    LIABILITY TO CLIENT ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE
    TOTAL FEES ACTUALLY PAID BY CLIENT TO DESIGNER IN THE THREE (3) MONTHS IMMEDIATELY
    PRECEDING THE EVENT GIVING RISE TO THE CLAIM. DESIGNER SHALL NOT BE LIABLE FOR ANY
    INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING
    BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, OR LOSS OF BUSINESS
    OPPORTUNITY, EVEN IF DESIGNER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
    THIS LIMITATION APPLIES REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, STATUTE,
    OR OTHERWISE).
  </p>
</div>

<!-- 13. INDEMNIFICATION -->
<div class="section">
  <div class="section-title">13. Indemnification</div>
  <p>
    Client agrees to indemnify, defend, and hold harmless Designer and Designer&rsquo;s
    affiliates, officers, and representatives from and against any and all claims, damages,
    losses, liabilities, costs, and expenses (including reasonable attorneys&rsquo; fees)
    arising out of or relating to: (a) Client&rsquo;s breach of any representation, warranty,
    or obligation under this Agreement; (b) any claim that Client-provided Project Materials
    infringe or misappropriate any third-party intellectual property right; or (c) Client&rsquo;s
    use or misuse of the Deliverables after delivery.
  </p>
</div>

<!-- 14. CONFIDENTIALITY -->
<div class="section">
  <div class="section-title">14. Confidentiality</div>
  <p>
    Each party agrees to hold in strict confidence all non-public, proprietary, or sensitive
    information disclosed by the other party in connection with this Agreement
    (&ldquo;Confidential Information&rdquo;). Neither party shall disclose Confidential
    Information to any third party without the disclosing party&rsquo;s prior written consent,
    except as required by law or court order. This obligation survives termination of this
    Agreement for a period of two (2) years.
  </p>
</div>

<!-- 15. GENERAL PROVISIONS -->
<div class="section">
  <div class="section-title">15. General Provisions</div>
  <p>
    <strong>15.1 Governing Law.</strong> This Agreement shall be governed by and construed in
    accordance with the laws of the <strong>State of California</strong>, without regard to its
    conflict of law provisions. Any legal action arising under this Agreement shall be brought
    exclusively in the state or federal courts located in <strong>Sacramento County, California</strong>,
    and both parties hereby submit to the personal jurisdiction of such courts.
  </p>
  <p>
    <strong>15.2 Entire Agreement.</strong> This Agreement, together with any written change
    orders or addenda signed by both parties, constitutes the entire agreement between the
    parties with respect to the subject matter hereof and supersedes all prior negotiations,
    representations, warranties, and understandings, whether oral or written.
  </p>
  <p>
    <strong>15.3 Amendments.</strong> No modification of this Agreement shall be valid or binding
    unless made in writing and signed by authorized representatives of both parties.
  </p>
  <p>
    <strong>15.4 Severability.</strong> If any provision of this Agreement is found to be invalid,
    illegal, or unenforceable under applicable law, such provision shall be deemed modified to
    the minimum extent necessary to make it enforceable, and the remaining provisions shall
    continue in full force and effect.
  </p>
  <p>
    <strong>15.5 Independent Contractor.</strong> Designer is an independent contractor and not
    an employee, partner, agent, or joint venturer of Client. Designer retains sole discretion
    over the means and methods of performing services. Nothing in this Agreement creates an
    employment relationship or partnership between the parties.
  </p>
  <p>
    <strong>15.6 Force Majeure.</strong> Neither party shall be liable for any delay or failure
    in performance resulting from causes beyond that party&rsquo;s reasonable control, including
    but not limited to acts of God, government actions, natural disasters, pandemics, internet
    outages, or third-party service failures. The affected party shall provide prompt written
    notice and use commercially reasonable efforts to resume performance.
  </p>
  <p>
    <strong>15.7 Waiver.</strong> No failure or delay by either party in exercising any right
    under this Agreement shall constitute a waiver of that right. A waiver of any breach shall
    not be deemed a waiver of any subsequent breach.
  </p>
  <p>
    <strong>15.8 Electronic Signatures.</strong> The parties agree that electronic signatures
    (including digital signatures captured via BizScout&rsquo;s signing platform) are legally
    valid and enforceable to the same extent as handwritten signatures under the California
    Uniform Electronic Transactions Act (UETA), Cal. Civ. Code &sect;&sect; 1633.1 et seq.,
    and the federal Electronic Signatures in Global and National Commerce Act (E-SIGN).
  </p>
  <p>
    <strong>15.9 Notices.</strong> All notices under this Agreement shall be in writing and
    delivered via email to the addresses set forth in the Parties section above. Notices are
    effective upon confirmed delivery.
  </p>
  <p>
    <strong>15.10 Counterparts.</strong> This Agreement may be executed in counterparts, each of
    which shall be deemed an original, and all of which together shall constitute one and the
    same instrument.
  </p>
</div>

<!-- SIGNATURE PAGE -->
<div class="sig-page">
  <div class="sig-page-title">— Signature Page —</div>
  <p style="text-align:justify;margin-bottom:28px;font-size:11pt;">
    IN WITNESS WHEREOF, the parties have executed this Web Design &amp; Development Agreement
    as of the Effective Date first written above. Each signatory represents and warrants that
    they are duly authorized to execute this Agreement on behalf of the respective party and
    to legally bind such party to the terms herein.
  </p>
  <div class="sig-grid">
    <div>
      <span class="sig-label">Designer / Service Provider</span>
      <div class="sig-image-area">${designerSigBlock}</div>
      <div class="sig-line"></div>
      <div class="sig-printed"><strong>${c.designer_name || '________________________________'}</strong></div>
      <div class="sig-title">Independent Web Designer &amp; Developer</div>
      <div class="sig-date">Date: ${designerSig ? designerSignedDate : '________________________________'}</div>
    </div>
    <div>
      <span class="sig-label">Client / Authorized Representative</span>
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
  Governing Law: State of California &nbsp;|&nbsp; Venue: Sacramento County, California<br/>
  Electronic signatures on this document are legally binding under California UETA and the federal E-SIGN Act.<br/>
  Both parties should retain a fully executed copy of this Agreement for their records.
</div>

</body>
</html>`
}
