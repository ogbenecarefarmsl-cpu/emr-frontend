import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { OrderWithDetails } from '@/hooks/useOrders';

interface ResultPrintViewProps {
  order: OrderWithDetails;
  results: Array<{
    id: string;
    test_code: string;
    test_name: string;
    value: string;
    unit: string | null;
    reference_range: string | null;
    flag: string;
    resulted_at: string;
    verified_by: string | null;
    verified_at: string | null;
  }>;
}

export function ResultPrintView({ order, results }: ResultPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const html = `
      <html>
        <head>
          <title>Lab Results - ${order.order_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              font-size: 12px;
            }
            .patient-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
              padding: 10px;
              background: #f5f5f5;
            }
            .info-item {
              margin-bottom: 5px;
            }
            .info-label {
              font-weight: bold;
              font-size: 11px;
              color: #666;
            }
            .info-value {
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .flag-normal { color: #000; }
            .flag-low { color: #0066cc; }
            .flag-high { color: #ff6600; }
            .flag-critical { color: #cc0000; font-weight: bold; }
            .footer {
              margin-top: 30px;
              padding-top: 10px;
              border-top: 1px solid #ddd;
              font-size: 10px;
              color: #666;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 40px;
            }
            .signature-line {
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 40px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `;

    // Electron: silent native print (no dialog, no popup)
    if (window.electronAPI?.printHTML) {
      const result = await window.electronAPI.printHTML(html, {
        pageSize: 'A4',
        silent: true,
      });
      if (result.success) return;
      // fall through to browser on failure
    }

    // Browser fallback: popup window
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getFlagClass = (flag: string) => {
    if (flag.includes('critical')) return 'flag-critical';
    if (flag === 'low') return 'flag-low';
    if (flag === 'high') return 'flag-high';
    return 'flag-normal';
  };

  return (
    <div>
      <div className="mb-4 no-print">
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Print Results
        </Button>
      </div>

      <div ref={printRef} className="bg-white p-8 border rounded-lg">
        {/* Header */}
        <div className="header">
          <h1>HARBOUR Laboratory</h1>
          <p>123 Medical Center Drive, Lagos, Nigeria</p>
          <p>Phone: 075 766461, 031-551811 | Email: ogbenecarefarmsig@gmail.com</p>
          <h2 style={{ marginTop: '15px', fontSize: '18px' }}>LABORATORY RESULTS</h2>
        </div>

        {/* Patient Information */}
        <div className="patient-info">
          <div className="info-item">
            <div className="info-label">Patient Name</div>
            <div className="info-value">
              {`${(order.patient || order.patients)?.firstName || (order.patient || order.patients)?.first_name || ''} ${(order.patient || order.patients)?.lastName || (order.patient || order.patients)?.last_name || ''}`.trim() || 'Unknown Patient'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Patient ID</div>
            <div className="info-value">
              {(order.patient || order.patients)?.patientId || (order.patient || order.patients)?.patient_id || 'Unknown ID'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Date of Birth</div>
            <div className="info-value">{new Date(order.patients.date_of_birth).toLocaleDateString()}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Gender</div>
            <div className="info-value">
              {order.patients.gender === 'M' ? 'Male' : order.patients.gender === 'F' ? 'Female' : 'Other'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Order Number</div>
            <div className="info-value">{order.order_number}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Collection Date</div>
            <div className="info-value">
              {order.collected_at ? new Date(order.collected_at).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference Range</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {results.map(result => (
              <tr key={result.id}>
                <td>
                  <strong>{result.test_code}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#666' }}>{result.test_name}</span>
                </td>
                <td><strong>{result.value}</strong></td>
                <td>{result.unit || '-'}</td>
                <td>{result.reference_range || '-'}</td>
                <td className={getFlagClass(result.flag)}>
                  {result.flag === 'normal' ? 'Normal' : 
                   result.flag === 'low' ? 'Low' :
                   result.flag === 'high' ? 'High' :
                   result.flag === 'critical_low' ? 'CRITICAL LOW' :
                   result.flag === 'critical_high' ? 'CRITICAL HIGH' : result.flag}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="signatures">
          <div>
            <div className="signature-line">
              <strong>Performed By</strong>
              <br />
              Lab Technician
            </div>
          </div>
          <div>
            <div className="signature-line">
              <strong>Verified By</strong>
              <br />
              Medical Director
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <p><strong>Note:</strong> These results are for the exclusive use of the requesting physician and patient. 
          Results marked as CRITICAL require immediate attention.</p>
          <p>Report generated on: {new Date().toLocaleString()}</p>
          <p style={{ textAlign: 'center', marginTop: '10px' }}>
            <strong>*** END OF REPORT ***</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
