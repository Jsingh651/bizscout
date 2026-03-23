/**
 * pdfUtils.js
 *
 * PDF via hidden iframe + window.print().
 * The HTML passed in already has @media print styles.
 * We also inject an extra <style> that forcibly zeroes body padding
 * so the @page margins are the only whitespace — no double-padding overlap.
 */

export async function generateContractPDF(html, filename = 'contract') {
  return new Promise((resolve) => {

    // Inject a guaranteed-last style block that zeroes screen body padding for print.
    // We do it as a real <style> tag appended to <head> so it wins specificity.
    const overrideStyle = `
<style id="pdf-override">
  @media print {
    body {
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
    }
  }
</style>`

    // Append right before </head>
    const htmlReady = html.includes('</head>')
      ? html.replace('</head>', overrideStyle + '\n</head>')
      : html

    // Save and restore document title so browser suggests the right filename
    const prevTitle = document.title
    document.title  = filename

    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, {
      position:   'fixed',
      top:        '0',
      left:       '0',
      width:      '1px',
      height:     '1px',
      opacity:    '0',
      border:     'none',
      pointerEvents: 'none',
    })
    document.body.appendChild(iframe)

    const cleanup = () => {
      document.title = prevTitle
      try { document.body.removeChild(iframe) } catch (_) {}
      resolve(null)
    }

    iframe.onload = () => {
      const iwin = iframe.contentWindow
      const idoc = iframe.contentDocument || iwin.document

      // Wait for fonts inside iframe to finish loading
      const fontsReady = idoc.fonts ? idoc.fonts.ready : Promise.resolve()

      fontsReady.then(() => {
        // Extra 300ms paint buffer
        setTimeout(() => {
          iwin.focus()

          iwin.onafterprint = cleanup

          // Fallback: if onafterprint never fires (some browsers), clean up after 3 min
          const fallback = setTimeout(cleanup, 180_000)
          const origCleanup = iwin.onafterprint
          iwin.onafterprint = () => { clearTimeout(fallback); origCleanup() }

          iwin.print()
        }, 300)
      })
    }

    const idoc = iframe.contentDocument || iframe.contentWindow.document
    idoc.open()
    idoc.write(htmlReady)
    idoc.close()
  })
}

export function extractBase64(dataUri) {
  return dataUri ? dataUri.split(',')[1] || dataUri : ''
}