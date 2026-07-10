import { forwardRef } from 'react';
import { format } from 'date-fns';
import type { ReceiptData } from '@/utils/escpos';
import { BranchLetterhead, BranchFooterText } from './BranchLetterhead';

export type { ReceiptData };

interface ThermalReceiptProps {
  data: ReceiptData;
  copyType: 'patient' | 'lab';
}

export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ data, copyType }, ref) => {
    const formatCurrency = (amount: number) => {
      return `Le ${amount.toLocaleString()}`;
    };

    const discountAmount =
      data.discountType === 'percentage'
        ? (data.subtotal * data.discount) / 100
        : data.discount;

    return (
      <div ref={ref} className="receipt">
        {/* Header (branch letterhead from DB) */}
        <div className="header">
          <BranchLetterhead branch={data.branch} />
        </div>

        {/* Copy Type Badge */}
        <div className="copy-type">
          {copyType === 'patient' ? '📋 PATIENT COPY' : '📋 CLINIC COPY'}
        </div>

        {/* Receipt Info */}
        <div className="section">
          <div className="info-row">
            <span className="info-label">Order No:</span>
            <span className="info-value">{data.orderNumber}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Date:</span>
            <span className="info-value">
              {format(new Date(data.paymentDate), 'dd/MM/yyyy HH:mm')}
            </span>
          </div>
        </div>

        {/* Patient Info */}
        <div className="section">
          <div className="info-row">
            <span className="info-label">Patient:</span>
            <span className="info-value">{data.patientName}</span>
          </div>
          {(data.patientAge || data.patientGender) && (
            <div className="info-row">
              <span className="info-label">Age/Sex:</span>
              <span className="info-value">{[data.patientAge, data.patientGender].filter(Boolean).join('/')}</span>
            </div>
          )}
        </div>

        {/* Tests/Items */}
        <div className="items-table">
          {data.tests.map((test, index) => (
            <div key={index} className="item-row">
              <div className="item-name">
                <div>{test.name}</div>
              </div>
              <div className="item-price">{formatCurrency(test.price)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="totals">
          <div className="total-row grand-total">
            <span>TOTAL:</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="payment-info">
          <div className="info-row">
            <span className="info-label">Paid:</span>
            <span className="info-value">{formatCurrency(data.amountPaid)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Method:</span>
            <span className="info-value" style={{ textTransform: 'uppercase' }}>
              {data.paymentMethod.replace(/_/g, ' ')}
            </span>
          </div>
          {data.amountPaid > data.total && (
            <div className="info-row">
              <span className="info-label">Change:</span>
              <span className="info-value">
                {formatCurrency(data.amountPaid - data.total)}
              </span>
            </div>
          )}
        </div>

        {/* Collection Info */}
        {data.collectionDate && (
          <div className="section">
            <div className="section-title">Sample Collection</div>
            <div className="info-row">
              <span className="info-label">Scheduled:</span>
              <span className="info-value">{data.collectionDate}</span>
            </div>
          </div>
        )}

        {/* Instructions based on copy type */}
        {copyType === 'patient' && (
          <div className="instructions">
            <div>• Bring this receipt for collection</div>
            <div>• Results within 24-48 hours</div>
          </div>
        )}

        {/* Barcode */}
        <div className="barcode">{data.orderNumber}</div>

        {/* Footer — patient copy only (uses branch's footerText) */}
        {copyType === 'patient' && (
          <>
            <div className="thank-you">THANK YOU!</div>
            <div className="footer">
              <BranchFooterText branch={data.branch} />
            </div>
          </>
        )}
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';

// Thermal printer styles to be injected into print window
export const thermalPrintStyles = `
  @page {
    size: 58mm auto;
    margin: 0;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    line-height: 1.3;
    color: #000;
    width: 58mm;
    padding: 3mm;
    background: white;
  }
  
  .receipt {
    width: 100%;
  }
  
  .header {
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 2px dashed #000;
    padding-bottom: 10px;
  }
  
  .logo {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .logo-image {
    max-height: 60px;
    max-width: 120px;
    object-fit: contain;
    margin: 0 auto 5px;
    display: block;
  }

  .company-name {
    font-size: 14px;
    font-weight: bold;
  }

  .company-tagline {
    font-size: 10px;
    font-style: italic;
    margin-top: 2px;
  }

  .company-info {
    font-size: 10px;
    margin-top: 3px;
  }

  .company-info-muted {
    color: #555;
  }

  .company-info-warn {
    color: #b00;
    font-weight: bold;
  }

  .branch-letterhead {
    text-align: center;
    margin-bottom: 4px;
  }

  .branch-letterhead .logo,
  .branch-letterhead .logo-image {
    margin-bottom: 4px;
  }
  
  .copy-type {
    font-size: 11px;
    font-weight: bold;
    margin: 6px 0;
    text-align: center;
    padding: 3px;
    border: 1px solid #000;
  }
  
  .section {
    margin: 4px 0;
    padding: 2px 0;
  }
  
  .section-title {
    font-weight: bold;
    font-size: 10px;
    margin-bottom: 3px;
    text-transform: uppercase;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    margin: 1px 0;
    font-size: 10px;
  }
  
  .info-label {
    font-weight: bold;
  }
  
  .info-value {
    text-align: right;
  }
  
  .items-table {
    width: 100%;
    margin: 4px 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
    padding: 3px 0;
  }
  
  .item-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
    font-size: 10px;
  }
  
  .item-name {
    flex: 1;
    padding-right: 10px;
  }
  
  .item-price {
    white-space: nowrap;
    font-weight: bold;
  }
  
  .totals {
    margin: 4px 0;
    padding: 3px 0;
    border-top: 2px solid #000;
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
    font-size: 11px;
  }
  
  .total-row.grand-total {
    font-size: 12px;
    font-weight: bold;
    border-top: 1px dashed #000;
    padding-top: 3px;
    margin-top: 3px;
  }
  
  .payment-info {
    margin: 4px 0;
    padding: 4px 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
  }
  
  .footer {
    text-align: center;
    margin-top: 6px;
    font-size: 8px;
  }
  
  .barcode {
    text-align: center;
    font-family: 'Libre Barcode 128', cursive;
    font-size: 28px;
    margin: 4px 0;
    letter-spacing: 0;
  }
  
  .thank-you {
    text-align: center;
    font-weight: bold;
    margin: 4px 0;
    font-size: 10px;
  }
  
  .instructions {
    font-size: 8px;
    margin: 4px 0;
    padding: 3px;
    background: #f5f5f5;
    border: 1px solid #ddd;
  }
  
  .lab-instructions {
    background: #fff3cd;
    border: 1px solid #ffc107;
  }
  
  @media print {
    body {
      width: 58mm;
    }
  }
`;
