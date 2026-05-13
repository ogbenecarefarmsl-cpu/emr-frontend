import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Save, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestResult {
  id: string;
  testCode: string;
  testName: string;
  value: string;
  referenceRange: string;
  unit: string;
  flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
}

interface TestSection {
  title: string;
  tests: TestResult[];
}

interface PatientInfo {
  name: string;
  age: string;
  gender: string;
  idNumber: string;
  doctor: string;
  collectedDate: string;
  receivedDate: string;
  reportedDate: string;
}

export default function EditableResultReport() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: 'Zainab Kargbo',
    age: '9 years',
    gender: 'Female',
    idNumber: 'LAB-20250131-001',
    doctor: 'Dr Vincent',
    collectedDate: '31/01/26',
    receivedDate: '31/01/26',
    reportedDate: '31/01/26',
  });

  const [testSections, setTestSections] = useState<TestSection[]>([
    {
      title: 'CLINICAL CHEMISTRY',
      tests: [
        { id: '1', testCode: 'K', testName: 'Potassium', value: '14.27', referenceRange: '3.5 - 5.2', unit: 'mmol/L', flag: 'critical_high' },
        { id: '2', testCode: 'Na', testName: 'Sodium', value: '141.6', referenceRange: '136 - 145', unit: 'mmol/L', flag: 'normal' },
        { id: '3', testCode: 'Cl', testName: 'Chloride', value: '110.2', referenceRange: '96 - 108', unit: 'mmol/L', flag: 'high' },
        { id: '4', testCode: 'iCa', testName: 'Ionized Calcium', value: '0.23', referenceRange: '1.05 - 1.35', unit: 'mmol/L', flag: 'critical_low' },
        { id: '5', testCode: 'nCa', testName: 'Normalized Calcium', value: '0.16', referenceRange: '1.05 - 1.35', unit: 'mmol/L', flag: 'critical_low' },
        { id: '6', testCode: 'TCa', testName: 'Total Calcium', value: '0.32', referenceRange: '2.08 - 2.60', unit: 'mmol/L', flag: 'critical_low' },
        { id: '7', testCode: 'TCO2', testName: 'Total CO2', value: '5.85', referenceRange: '22.0 - 30.0', unit: 'mmol/L', flag: 'critical_low' },
        { id: '8', testCode: 'pH', testName: 'pH', value: '6.70', referenceRange: '', unit: '', flag: 'critical_low' },
      ],
    },
    {
      title: 'SEROLOGY',
      tests: [
        { id: '9', testCode: 'HBsAg', testName: 'Hepatitis B', value: 'Non-reactive', referenceRange: '', unit: '', flag: 'normal' },
        { id: '10', testCode: 'HCV', testName: 'Hepatitis C', value: 'Non-reactive', referenceRange: '', unit: '', flag: 'normal' },
        { id: '11', testCode: 'VDRL', testName: 'Syphilis', value: 'Non-reactive', referenceRange: '', unit: '', flag: 'normal' },
      ],
    },
    {
      title: 'HEAMATOLOGY',
      tests: [
        { id: '12', testCode: 'SCS', testName: 'Sickle Cell Screening', value: '', referenceRange: '', unit: '', flag: 'normal' },
        { id: '13', testCode: 'Genotype', testName: 'Genotype', value: 'AA', referenceRange: '', unit: '', flag: 'normal' },
      ],
    },
  ]);

  const [verifiedBy, setVerifiedBy] = useState('');
  const [disclaimer, setDisclaimer] = useState(
    'All tests conducted using calibrated, automated analyzers with high accuracy and precision. For detailed interpretation kindly consult your healthcare provider.'
  );

  const handlePrint = () => {
    setIsEditing(false);
    setTimeout(async () => {
      if (window.electronAPI?.printSilent) {
        await window.electronAPI.printSilent({ pageSize: 'A4', silent: true });
      } else {
        window.print();
      }
    }, 100);
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const updateTestValue = (sectionIndex: number, testId: string, field: keyof TestResult, value: string) => {
    setTestSections(prev => {
      const newSections = [...prev];
      const test = newSections[sectionIndex].tests.find(t => t.id === testId);
      if (test) {
        (test as any)[field] = value;
      }
      return newSections;
    });
  };

  const getValueColor = (flag: TestResult['flag']) => {
    switch (flag) {
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 font-bold';
      case 'high':
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto mb-4 flex justify-end gap-2 print:hidden">
        {!isEditing ? (
          <>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Report
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </>
        )}
      </div>

      {/* Report Container */}
      <div ref={printRef} className="max-w-5xl mx-auto bg-white shadow-lg print:shadow-none">
        {/* Header with Logo and Company Info */}
        <div className="border-b-4 border-blue-600 pb-4 px-8 pt-8">
          <div className="flex items-start justify-between">
            {/* Logo and Company Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">HARBOUR</h1>
                <p className="text-xs text-gray-500 italic">Motto: Automated Precision...</p>
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="text-right text-sm text-gray-600">
              <p className="font-semibold">075 766461, 031-551811</p>
              <p>ogbenecarefarmsig@gmail.com</p>
              <p>114 Fourah Bay Road, Freetown, Sierra Leone</p>
            </div>
          </div>
        </div>

        {/* Patient and Doctor Info */}
        <div className="px-8 py-6 border-b">
          <div className="grid grid-cols-3 gap-8">
            {/* Patient Section */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Patient</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Name:</label>
                  {isEditing ? (
                    <Input
                      value={patientInfo.name}
                      onChange={e => setPatientInfo({ ...patientInfo, name: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Age:</label>
                  {isEditing ? (
                    <Input
                      value={patientInfo.age}
                      onChange={e => setPatientInfo({ ...patientInfo, age: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.age}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Gender:</label>
                  {isEditing ? (
                    <Input
                      value={patientInfo.gender}
                      onChange={e => setPatientInfo({ ...patientInfo, gender: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.gender}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">ID Number:</label>
                  {isEditing ? (
                    <Input
                      value={patientInfo.idNumber}
                      onChange={e => setPatientInfo({ ...patientInfo, idNumber: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.idNumber}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Doctor Section */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Referred By Doctor</h3>
              <div className="space-y-2">
                <div>
                  {isEditing ? (
                    <Input
                      value={patientInfo.doctor}
                      onChange={e => setPatientInfo({ ...patientInfo, doctor: e.target.value })}
                      placeholder="Type doctor's name"
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.doctor}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Copies To Section */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Copies To</h3>
              <div className="space-y-2">
                <div>
                  {isEditing ? (
                    <Input
                      value={patientInfo.doctor}
                      className="mt-1"
                      placeholder="Copy recipient"
                    />
                  ) : (
                    <p className="font-semibold">{patientInfo.doctor}</p>
                  )}
                </div>
                <div className="text-sm space-y-1 mt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">COLLECTED:</span>
                    {isEditing ? (
                      <Input
                        value={patientInfo.collectedDate}
                        onChange={e => setPatientInfo({ ...patientInfo, collectedDate: e.target.value })}
                        className="w-32 h-7 text-sm"
                      />
                    ) : (
                      <span className="font-semibold">{patientInfo.collectedDate}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">RECEIVED:</span>
                    {isEditing ? (
                      <Input
                        value={patientInfo.receivedDate}
                        onChange={e => setPatientInfo({ ...patientInfo, receivedDate: e.target.value })}
                        className="w-32 h-7 text-sm"
                      />
                    ) : (
                      <span className="font-semibold">{patientInfo.receivedDate}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PRINTED:</span>
                    {isEditing ? (
                      <Input
                        value={patientInfo.reportedDate}
                        onChange={e => setPatientInfo({ ...patientInfo, reportedDate: e.target.value })}
                        className="w-32 h-7 text-sm"
                      />
                    ) : (
                      <span className="font-semibold">{patientInfo.reportedDate}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Results Sections */}
        <div className="px-8 py-6">
          {testSections.map((section, sectionIndex) => (
            <div key={section.title} className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-green-50 px-4 py-2 mb-4">
                <h2 className="text-lg font-bold text-gray-800">{section.title}</h2>
              </div>

              {/* Electrolyte Table */}
              {section.title === 'CLINICAL CHEMISTRY' && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-3">ELECTROLYTE</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 text-sm font-semibold text-gray-700"></th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">RESULT</th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">RANGES</th>
                        <th className="text-right py-2 text-sm font-semibold text-gray-700">UNIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.tests.map(test => (
                        <tr key={test.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-2">
                            <span className="font-semibold text-gray-900">{test.testCode}</span>
                          </td>
                          <td className="text-right py-2">
                            {isEditing ? (
                              <Input
                                value={test.value}
                                onChange={e => updateTestValue(sectionIndex, test.id, 'value', e.target.value)}
                                className={cn('w-24 h-8 text-right', getValueColor(test.flag))}
                              />
                            ) : (
                              <span className={cn('font-bold', getValueColor(test.flag))}>
                                {test.value}
                              </span>
                            )}
                          </td>
                          <td className="text-right py-2 text-gray-600">
                            {isEditing ? (
                              <Input
                                value={test.referenceRange}
                                onChange={e => updateTestValue(sectionIndex, test.id, 'referenceRange', e.target.value)}
                                className="w-32 h-8 text-right"
                              />
                            ) : (
                              test.referenceRange
                            )}
                          </td>
                          <td className="text-right py-2 text-gray-600">
                            {isEditing ? (
                              <Input
                                value={test.unit}
                                onChange={e => updateTestValue(sectionIndex, test.id, 'unit', e.target.value)}
                                className="w-24 h-8 text-right"
                              />
                            ) : (
                              test.unit
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Serology Results */}
              {section.title === 'SEROLOGY' && (
                <div className="space-y-3">
                  {section.tests.map(test => (
                    <div key={test.id} className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="font-semibold text-gray-900">{test.testName}</span>
                      {isEditing ? (
                        <Input
                          value={test.value}
                          onChange={e => updateTestValue(sectionIndex, test.id, 'value', e.target.value)}
                          className="w-48 h-8"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">{test.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Hematology Results */}
              {section.title === 'HEAMATOLOGY' && (
                <div className="space-y-3">
                  {section.tests.map(test => (
                    <div key={test.id} className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="font-semibold text-gray-900">{test.testName}</span>
                      {isEditing ? (
                        <Input
                          value={test.value}
                          onChange={e => updateTestValue(sectionIndex, test.id, 'value', e.target.value)}
                          className="w-48 h-8"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">{test.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Verification Section */}
        <div className="px-8 py-6 border-t">
          <div className="mb-4">
            <label className="text-sm text-gray-600">Verified By:</label>
            {isEditing ? (
              <Input
                value={verifiedBy}
                onChange={e => setVerifiedBy(e.target.value)}
                className="mt-1 max-w-md"
                placeholder="Enter verifier name"
              />
            ) : (
              <div className="mt-2 border-b border-gray-400 w-64 h-8"></div>
            )}
          </div>
        </div>

        {/* Footer with Disclaimer */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 px-8 py-6 text-white">
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Disclaimer</h4>
            {isEditing ? (
              <Textarea
                value={disclaimer}
                onChange={e => setDisclaimer(e.target.value)}
                className="bg-white text-gray-900"
                rows={3}
              />
            ) : (
              <p className="text-sm">{disclaimer}</p>
            )}
          </div>
          
          <div className="text-right border-t border-white/30 pt-4">
            <p className="text-sm font-semibold">Signature & Stamp</p>
          </div>

          <div className="mt-6 text-center text-sm">
            <p className="font-semibold">OPEN 24/7 | ONSITE & ONLINE ACCESS |</p>
            <p className="font-semibold">TRUSTED BY CLINICS & HOSPITALS</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
