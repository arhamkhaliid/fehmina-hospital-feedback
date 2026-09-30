/**
 * Fehmina Hospital - Poster QR Code Generator Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const deptSelect = document.getElementById('poster-dept-select');
  const sizeSelect = document.getElementById('poster-size-select');
  const btnPrint = document.getElementById('btn-print-poster');
  const posterSheet = document.getElementById('poster-sheet');
  const qrTarget = document.getElementById('qrcode-target');
  const locationTag = document.getElementById('poster-location-tag');
  const locationDisplay = document.getElementById('location-name-display');

  function generatePosterQR() {
    const origin = window.location.origin;
    const deptVal = deptSelect.value;
    
    let targetUrl = origin + '/';
    if (deptVal) {
      targetUrl += '?dept=' + encodeURIComponent(deptVal) + '&source=poster_qr';
      locationTag.classList.remove('hidden');
      locationDisplay.textContent = deptSelect.options[deptSelect.selectedIndex].text;
    } else {
      locationTag.classList.add('hidden');
    }

    // Generate QR code
    qrTarget.innerHTML = '';
    new QRCode(qrTarget, {
      text: targetUrl,
      width: 220,
      height: 220,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: 2
    });
  }

  deptSelect.addEventListener('change', generatePosterQR);

  sizeSelect.addEventListener('change', () => {
    if (sizeSelect.value === 'tabletop') {
      posterSheet.classList.add('tabletop-layout');
      posterSheet.classList.remove('a4-layout');
    } else {
      posterSheet.classList.remove('tabletop-layout');
      posterSheet.classList.add('a4-layout');
    }
  });

  btnPrint.addEventListener('click', () => {
    window.print();
  });

  // Initial render
  generatePosterQR();
});
