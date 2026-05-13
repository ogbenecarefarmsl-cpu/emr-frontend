/**
 * Browser Print Service (Fallback)
 * Uses standard browser print dialog with thermal printer CSS
 */

export class BrowserPrintService {
  /**
   * Print receipt using browser print dialog
   * Optimized for 80mm thermal printers
   */
  printReceipt(receipt: {
    labName: string;
    labAddress: string;
    labPhone: string;
    orderNumber: string;
    patientName: string;
    date: string;
    tests: Array<{ name: string; price: number }>;
    subtotal: number;
    discount: number;
    total: number;
    amountPaid: number;
    balance: number;
    paymentMethod: string;
  }): void {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.error('Failed to access iframe document');
      return;
    }

    // Generate receipt HTML
    const receiptHTML = this.generateReceiptHTML(receipt);
    
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();

    // Wait for content to load, then print
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 250);
    };
  }

  /**
   * Generate HTML for thermal receipt
   */
  private generateReceiptHTML(receipt: {
    labName: string;
    labAddress: string;
    labPhone: string;
    orderNumber: string;
    patientName: string;
    date: string;
    tests: Array<{ name: string; price: number }>;
    subtotal: number;
    discount: number;
    total: number;
    amountPaid: number;
    balance: number;
    paymentMethod: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${receipt.orderNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
    }
    
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: 80mm;
      margin: 0 auto;
      padding: 5mm;
      color: #000;
      background: #fff;
    }
    
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    
    .header h1 {
      font-size: 18px;
      font-weight: bold;
      margin: 0 0 5px 0;
    }
    
    .header p {
      margin: 2px 0;
      font-size: 11px;
    }
    
    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    
    .divider-solid {
      border-top: 2px solid #000;
      margin: 8px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    
    .info-label {
      font-weight: bold;
    }
    
    .tests {
      margin: 10px 0;
    }
    
    .test-item {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    
    .test-name {
      flex: 1;
      padding-right: 10px;
    }
    
    .test-price {
      white-space: nowrap;
    }
    
    .totals {
      margin-top: 10px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    
    .total-row.bold {
      font-weight: bold;
      font-size: 14px;
    }
    
    .footer {
      text-align: center;
      margin-top: 15px;
      font-size: 11px;
    }
    
    .footer p {
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${receipt.labName}</h1>
    <p>${receipt.labAddress}</p>
    <p>${receipt.labPhone}</p>
  </div>
  
  <div class="divider-solid"></div>
  
  <div class="info-row">
    <span class="info-label">Order:</span>
    <span>${receipt.orderNumber}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Patient:</span>
    <span>${receipt.patientName}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Date:</span>
    <span>${receipt.date}</span>
  </div>
  
  <div class="divider"></div>
  
  <div class="tests">
    <div style="font-weight: bold; margin-bottom: 5px;">Tests:</div>
    ${receipt.tests.map(test => `
      <div class="test-item">
        <span class="test-name">${test.name}</span>
        <span class="test-price">GHS ${test.price.toFixed(2)}</span>
      </div>
    `).join('')}
  </div>
  
  <div class="divider"></div>
  
  <div class="totals">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>GHS ${receipt.subtotal.toFixed(2)}</span>
    </div>
    ${receipt.discount > 0 ? `
      <div class="total-row">
        <span>Discount:</span>
        <span>-GHS ${receipt.discount.toFixed(2)}</span>
      </div>
    ` : ''}
    <div class="total-row bold">
      <span>TOTAL:</span>
      <span>GHS ${receipt.total.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>Paid:</span>
      <span>GHS ${receipt.amountPaid.toFixed(2)}</span>
    </div>
    ${receipt.balance !== 0 ? `
      <div class="total-row bold">
        <span>${receipt.balance > 0 ? 'Balance Due:' : 'Change:'}</span>
        <span>GHS ${Math.abs(receipt.balance).toFixed(2)}</span>
      </div>
    ` : ''}
  </div>
  
  <div class="divider"></div>
  
  <div class="info-row">
    <span>Payment Method:</span>
    <span>${receipt.paymentMethod}</span>
  </div>
  
  <div class="divider-solid"></div>
  
  <div class="footer">
    <p><strong>Thank you for your visit!</strong></p>
    <p>Get well soon</p>
  </div>
</body>
</html>
    `;
  }
}

export const browserPrint = new BrowserPrintService();
