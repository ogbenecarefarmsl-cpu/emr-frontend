import { forwardRef } from 'react';
import { format } from 'date-fns';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { BranchLetterhead, BranchFooterText } from './BranchLetterhead';

interface TreatmentPlanReceiptProps {
  plan: TreatmentPlan;
}

export const TreatmentPlanReceipt = forwardRef<HTMLDivElement, TreatmentPlanReceiptProps>(
  ({ plan }, ref) => {
    const formatCurrency = (amount: number) => `Le ${amount.toLocaleString()}`;

    const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
    const visit = typeof plan.visitId === 'object' ? plan.visitId : null;

    const TYPE_BADGES: Record<string, { label: string; color: string }> = {
      drug: { label: 'DRUG', color: 'bg-blue-100 text-blue-800' },
      iv: { label: 'IV', color: 'bg-purple-100 text-purple-800' },
      lab: { label: 'LAB', color: 'bg-green-100 text-green-800' },
      procedure: { label: 'PROC', color: 'bg-orange-100 text-orange-800' },
      other: { label: 'OTHER', color: 'bg-gray-100 text-gray-800' },
    };

    return (
      <div ref={ref} className="receipt">
        {/* Header */}
        <div className="header">
          <BranchLetterhead />
        </div>

        {/* Title */}
        <div className="copy-type">TREATMENT PLAN</div>

        {/* Plan Info */}
        <div className="section">
          <div className="info-row">
            <span className="info-label">Plan:</span>
            <span className="info-value">{plan.planNumber}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Date:</span>
            <span className="info-value">
              {format(new Date(plan.createdAt), 'dd/MM/yyyy HH:mm')}
            </span>
          </div>
          {visit && (
            <div className="info-row">
              <span className="info-label">Visit:</span>
              <span className="info-value">{visit.visitNumber}</span>
            </div>
          )}
        </div>

        {/* Patient Info */}
        {patient && (
          <div className="section">
            <div className="section-title">Patient</div>
            <div className="info-row">
              <span className="info-label">Name:</span>
              <span className="info-value">{patient.firstName} {patient.lastName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ID:</span>
              <span className="info-value">{patient.patientId}</span>
            </div>
            {(patient.age || patient.gender) && (
              <div className="info-row">
                <span className="info-label">Age/Sex:</span>
                <span className="info-value">
                  {[patient.age, patient.gender].filter(Boolean).join('/')}
                </span>
              </div>
            )}
            {patient.phone && (
              <div className="info-row">
                <span className="info-label">Phone:</span>
                <span className="info-value">{patient.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Items */}
        <div className="items-table">
          <div className="section-title">Items</div>
          {plan.items.map((item, index) => {
            const badge = TYPE_BADGES[item.type] || TYPE_BADGES.other;
            return (
              <div key={index} className="item-row">
                <div className="item-name">
                  <div className="flex items-center gap-1">
                    <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
                      {index + 1}.
                    </span>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '2px' }}>
                    {item.description}
                  </div>
                </div>
                <div className="item-price">{formatCurrency(item.amount)}</div>
              </div>
            );
          })}
        </div>

        {/* Total + Payment */}
        <div className="totals">
          <div className="total-row grand-total">
            <span>TOTAL:</span>
            <span>{formatCurrency(plan.totalAmount)}</span>
          </div>
          {(plan.amountPaid || 0) > 0 && (
            <div className="total-row" style={{ color: '#16a34a' }}>
              <span>PAID:</span>
              <span>{formatCurrency(plan.amountPaid)}</span>
            </div>
          )}
          {(plan.balance || 0) > 0 && (
            <div className="total-row" style={{ color: '#d97706', fontWeight: 'bold' }}>
              <span>BALANCE:</span>
              <span>{formatCurrency(plan.balance)}</span>
            </div>
          )}
          <div className="total-row" style={{ fontSize: '10px', marginTop: '4px' }}>
            <span>STATUS:</span>
            <span style={{ fontWeight: 'bold' }}>
              {plan.paymentStatus === 'paid' ? 'FULLY PAID' : plan.paymentStatus === 'partial' ? 'PARTIALLY PAID' : 'UNPAID'}
            </span>
          </div>
        </div>

        {/* Notes */}
        {plan.notes && (
          <div className="section">
            <div className="section-title">Notes</div>
            <div style={{ fontSize: '10px' }}>{plan.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="thank-you">THANK YOU!</div>
        <div className="footer">
          <BranchFooterText />
          <div style={{ marginTop: '10px', fontSize: '9px' }}>
            This is a computer-generated treatment plan
          </div>
          <div style={{ fontSize: '9px' }}>
            Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>
        </div>
      </div>
    );
  }
);

TreatmentPlanReceipt.displayName = 'TreatmentPlanReceipt';

// 58mm thermal printer styles
export const treatmentPlanPrintStyles = `
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
    font-size: 11px;
    line-height: 1.3;
    color: #000;
    width: 58mm;
    padding: 4mm;
    background: white;
  }
  
  .receipt {
    width: 100%;
  }
  
  .header {
    text-align: center;
    margin-bottom: 8px;
    border-bottom: 2px dashed #000;
    padding-bottom: 8px;
  }
  
  .copy-type {
    font-size: 13px;
    font-weight: bold;
    margin: 8px 0;
    text-align: center;
    padding: 4px;
    border: 2px solid #000;
  }
  
  .section {
    margin: 8px 0;
    padding: 4px 0;
  }
  
  .section-title {
    font-weight: bold;
    font-size: 10px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
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
    margin: 8px 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
    padding: 4px 0;
  }
  
  .item-row {
    margin: 4px 0;
    font-size: 10px;
  }
  
  .item-name {
    flex: 1;
    padding-right: 8px;
  }
  
  .item-price {
    white-space: nowrap;
    font-weight: bold;
    text-align: right;
  }
  
  .totals {
    margin: 8px 0;
    padding: 4px 0;
    border-top: 2px solid #000;
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    font-size: 11px;
  }
  
  .total-row.grand-total {
    font-size: 13px;
    font-weight: bold;
    border-top: 1px dashed #000;
    padding-top: 4px;
    margin-top: 4px;
  }
  
  .footer {
    text-align: center;
    margin-top: 12px;
    font-size: 9px;
  }
  
  .thank-you {
    text-align: center;
    font-weight: bold;
    margin: 8px 0;
    font-size: 11px;
  }
  
  .branch-letterhead {
    text-align: center;
    margin-bottom: 4px;
  }
  
  .branch-letterhead .logo,
  .branch-letterhead .logo-image {
    margin-bottom: 4px;
  }
  
  @media print {
    body {
      width: 58mm;
    }
  }
`;
