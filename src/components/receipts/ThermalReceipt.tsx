import { forwardRef } from 'react';
import { format } from 'date-fns';
import type { ReceiptData } from '@/utils/escpos';

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
        {/* Header */}
        <div className="header">
          <div className="logo">🏥</div>
          <div className="company-name">HARBOUR Medical Diagnostic</div>
          <div className="company-info">114, Fourah Bay Road, Freetown, Sierra Leone</div>
          <div className="company-info">Tel: +23274414434</div>
          <div className="company-info">habourlab@gmail.com</div>
        </div>

        {/* Copy Type Badge */}
        <div className="copy-type">
          {copyType === 'patient' ? '📋 PATIENT COPY' : '🔬 LAB COPY'}
        </div>

        {/* Receipt Info */}
        <div className="section">
          <div className="info-row">
            <span className="info-label">Receipt No:</span>
            <span className="info-value">{data.receiptNumber}</span>
          </div>
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
          <div className="section-title">Patient Information</div>
          <div className="info-row">
            <span className="info-label">Name:</span>
            <span className="info-value">{data.patientName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Patient ID:</span>
            <span className="info-value">{data.patientId}</span>
          </div>
          {data.patientAge && (
            <div className="info-row">
              <span className="info-label">Age:</span>
              <span className="info-value">{data.patientAge}</span>
            </div>
          )}
          {data.patientGender && (
            <div className="info-row">
              <span className="info-label">Sex:</span>
              <span className="info-value">{data.patientGender}</span>
            </div>
          )}
          {data.patientPhone && (
            <div className="info-row">
              <span className="info-label">Phone:</span>
              <span className="info-value">{data.patientPhone}</span>
            </div>
          )}
        </div>

        {/* Tests/Items */}
        <div className="items-table">
          <div className="section-title">Tests Ordered</div>
          {data.tests.map((test, index) => (
            <div key={index} className="item-row">
              <div className="item-name">
                <div style={{ fontWeight: 'bold' }}>{test.code}</div>
                <div style={{ fontSize: '10px' }}>{test.name}</div>
              </div>
              <div className="item-price">{formatCurrency(test.price)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="totals">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.subtotal)}</span>
          </div>
          {data.discount > 0 && (
            <div className="total-row">
              <span>
                Discount (
                {data.discountType === 'percentage'
                  ? `${data.discount}%`
                  : formatCurrency(data.discount)}
                ):
              </span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="total-row grand-total">
            <span>TOTAL:</span>
            <span>{formatCurrency(data.total)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="payment-info">
          <div className="info-row">
            <span className="info-label">Payment Method:</span>
            <span className="info-value" style={{ textTransform: 'uppercase' }}>
              {data.paymentMethod.replace('-', ' ')}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Amount Paid:</span>
            <span className="info-value">{formatCurrency(data.amountPaid)}</span>
          </div>
          {data.amountPaid > data.total && (
            <div className="info-row">
              <span className="info-label">Change:</span>
              <span className="info-value">
                {formatCurrency(data.amountPaid - data.total)}
              </span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Cashier:</span>
            <span className="info-value">{data.cashier}</span>
          </div>
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
        {copyType === 'patient' ? (
          <div className="instructions">
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              IMPORTANT INSTRUCTIONS:
            </div>
            <div>• Please arrive 15 minutes before scheduled time</div>
            <div>• Bring this receipt for sample collection</div>
            <div>• Fasting may be required for some tests</div>
            <div>• Results ready within 24-48 hours</div>
            <div>• Contact us for any queries</div>
          </div>
        ) : (
          <div className="instructions lab-instructions">
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              LAB TECHNICIAN NOTES:
            </div>
            <div>• Verify patient ID before collection</div>
            <div>• Check test requirements and prep</div>
            <div>• Label samples with order number</div>
            <div>• Update system after collection</div>
            <div>• Handle samples per protocol</div>
          </div>
        )}

        {/* Barcode */}
        <div className="barcode">{data.orderNumber}</div>

        {/* Footer — patient copy only */}
        {copyType === 'patient' && (
          <>
            <div className="thank-you">THANK YOU FOR CHOOSING US!</div>
            <div className="footer">
              <div>Open 24/7 | Onsite & Online Access</div>
              <div>Trusted by Clinics & Hospitals</div>
              <div style={{ marginTop: '10px', fontSize: '9px' }}>
                This is a computer-generated receipt
              </div>
              <div style={{ fontSize: '9px' }}>
                Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
              </div>
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
    size: 80mm auto;
    margin: 0;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    width: 80mm;
    padding: 5mm;
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
  
  .company-name {
    font-size: 14px;
    font-weight: bold;
  }
  
  .company-info {
    font-size: 10px;
    margin-top: 3px;
  }
  
  .copy-type {
    font-size: 14px;
    font-weight: bold;
    margin: 10px 0;
    text-align: center;
    padding: 5px;
    border: 2px solid #000;
  }
  
  .section {
    margin: 10px 0;
    padding: 5px 0;
  }
  
  .section-title {
    font-weight: bold;
    font-size: 11px;
    margin-bottom: 5px;
    text-transform: uppercase;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    margin: 3px 0;
    font-size: 11px;
  }
  
  .info-label {
    font-weight: bold;
  }
  
  .info-value {
    text-align: right;
  }
  
  .items-table {
    width: 100%;
    margin: 10px 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
    padding: 5px 0;
  }
  
  .item-row {
    display: flex;
    justify-content: space-between;
    margin: 5px 0;
    font-size: 11px;
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
    margin: 10px 0;
    padding: 5px 0;
    border-top: 2px solid #000;
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    margin: 5px 0;
    font-size: 12px;
  }
  
  .total-row.grand-total {
    font-size: 14px;
    font-weight: bold;
    border-top: 1px dashed #000;
    padding-top: 5px;
    margin-top: 5px;
  }
  
  .payment-info {
    margin: 10px 0;
    padding: 10px 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
  }
  
  .footer {
    text-align: center;
    margin-top: 15px;
    font-size: 10px;
  }
  
  .barcode {
    text-align: center;
    font-family: 'Libre Barcode 128', cursive;
    font-size: 40px;
    margin: 10px 0;
    letter-spacing: 0;
  }
  
  .thank-you {
    text-align: center;
    font-weight: bold;
    margin: 10px 0;
    font-size: 12px;
  }
  
  .instructions {
    font-size: 10px;
    margin: 10px 0;
    padding: 5px;
    background: #f5f5f5;
    border: 1px solid #ddd;
  }
  
  .lab-instructions {
    background: #fff3cd;
    border: 1px solid #ffc107;
  }
  
  @media print {
    body {
      width: 80mm;
    }
  }
`;
