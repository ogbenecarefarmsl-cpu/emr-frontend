import { useState, useEffect } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useDefaultTemplate,
  useUpdateTemplate,
  useUploadLogo,
} from '@/hooks/useReportTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Upload, Loader2, Eye } from 'lucide-react';

export default function ReportTemplateEditor() {
  const { profile } = useAuth();
  const { data: template, isLoading } = useDefaultTemplate();
  const updateTemplate = useUpdateTemplate();
  const uploadLogo = useUploadLogo();

  const [formData, setFormData] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    if (template) {
      setFormData(template);
      if (template.header?.logoUrl) {
        setLogoPreview(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${template.header.logoUrl}`);
      }
    }
  }, [template]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    try {
      let logoUrl = formData.header?.logoUrl;

      // Upload logo if changed
      if (logoFile) {
        const uploadResult = await uploadLogo.mutateAsync(logoFile);
        logoUrl = uploadResult.url;
      }

      // Update template
      await updateTemplate.mutateAsync({
        id: formData._id || formData.id,
        data: {
          ...formData,
          header: {
            ...formData.header,
            logoUrl,
          },
        },
      });

      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const updateField = (section: string, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  if (isLoading || !formData) {
    return (
      <RoleLayout title="Report Template" subtitle="Loading..." role="admin" userName={profile?.full_name}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout
      title="Report Template Editor"
      subtitle="Customize lab report appearance"
      role="admin"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-6">
            <Tabs defaultValue="header">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="header">Header</TabsTrigger>
                <TabsTrigger value="patient">Patient</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="footer">Footer</TabsTrigger>
                <TabsTrigger value="paper">Paper</TabsTrigger>
              </TabsList>

              {/* Header Tab */}
              <TabsContent value="header" className="space-y-4">
                <div>
                  <Label>Lab Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {logoPreview && (
                      <img src={logoPreview} alt="Logo" className="h-20 w-auto border rounded" />
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Recommended: 120x80px, PNG or JPG
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Lab Name</Label>
                  <Input
                    value={formData.header?.labName || ''}
                    onChange={(e) => updateField('header', 'labName', e.target.value)}
                  />
                </div>

                <div>
                  <Label>Motto/Tagline</Label>
                  <Input
                    value={formData.header?.motto || ''}
                    onChange={(e) => updateField('header', 'motto', e.target.value)}
                    placeholder="Motto: Automated Precision..."
                  />
                </div>

                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={formData.header?.address || ''}
                    onChange={(e) => updateField('header', 'address', e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.header?.phone || ''}
                      onChange={(e) => updateField('header', 'phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={formData.header?.email || ''}
                      onChange={(e) => updateField('header', 'email', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Website</Label>
                  <Input
                    value={formData.header?.website || ''}
                    onChange={(e) => updateField('header', 'website', e.target.value)}
                  />
                </div>

                <div>
                  <Label>Header Border Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.header?.headerBorderColor || '#1e40af'}
                      onChange={(e) => updateField('header', 'headerBorderColor', e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={formData.header?.headerBorderColor || '#1e40af'}
                      onChange={(e) => updateField('header', 'headerBorderColor', e.target.value)}
                      placeholder="#1e40af"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Patient Tab */}
              <TabsContent value="patient" className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showDoctor || false}
                      onChange={(e) => updateField('patientSection', 'showDoctor', e.target.checked)}
                    />
                    <span>Show Doctor Field</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showCopiesTo || false}
                      onChange={(e) => updateField('patientSection', 'showCopiesTo', e.target.checked)}
                    />
                    <span>Show Copies To Field</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showCollectionDate || false}
                      onChange={(e) => updateField('patientSection', 'showCollectionDate', e.target.checked)}
                    />
                    <span>Show Collection Date</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showReceivedDate || false}
                      onChange={(e) => updateField('patientSection', 'showReceivedDate', e.target.checked)}
                    />
                    <span>Show Received Date</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showReportedDate || false}
                      onChange={(e) => updateField('patientSection', 'showReportedDate', e.target.checked)}
                    />
                    <span>Show Reported Date</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.patientSection?.showPrintedDate || false}
                      onChange={(e) => updateField('patientSection', 'showPrintedDate', e.target.checked)}
                    />
                    <span>Show Printed Date</span>
                  </label>
                </div>
              </TabsContent>

              {/* Results Tab */}
              <TabsContent value="results" className="space-y-4">
                <div>
                  <Label>Category Header Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.resultsSection?.categoryHeaderColor || '#dbeafe'}
                      onChange={(e) => updateField('resultsSection', 'categoryHeaderColor', e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={formData.resultsSection?.categoryHeaderColor || '#dbeafe'}
                      onChange={(e) => updateField('resultsSection', 'categoryHeaderColor', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Abnormal Value Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.resultsSection?.abnormalColor || '#ef4444'}
                      onChange={(e) => updateField('resultsSection', 'abnormalColor', e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={formData.resultsSection?.abnormalColor || '#ef4444'}
                      onChange={(e) => updateField('resultsSection', 'abnormalColor', e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Footer Tab */}
              <TabsContent value="footer" className="space-y-4">
                <div>
                  <Label>Disclaimer Text</Label>
                  <Textarea
                    value={formData.footer?.disclaimerText || ''}
                    onChange={(e) => updateField('footer', 'disclaimerText', e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Footer Text</Label>
                  <Input
                    value={formData.footer?.footerText || ''}
                    onChange={(e) => updateField('footer', 'footerText', e.target.value)}
                    placeholder="OPEN 24/7 | ONSITE & ONLINE ACCESS"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Wave Color 1</Label>
                    <Input
                      type="color"
                      value={formData.footer?.waveColor1 || '#1e40af'}
                      onChange={(e) => updateField('footer', 'waveColor1', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Wave Color 2</Label>
                    <Input
                      type="color"
                      value={formData.footer?.waveColor2 || '#10b981'}
                      onChange={(e) => updateField('footer', 'waveColor2', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.footer?.showWaveDesign || false}
                      onChange={(e) => updateField('footer', 'showWaveDesign', e.target.checked)}
                    />
                    <span>Show Wave Design</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.footer?.showVerification || false}
                      onChange={(e) => updateField('footer', 'showVerification', e.target.checked)}
                    />
                    <span>Show Verification Section</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.footer?.showStamp || false}
                      onChange={(e) => updateField('footer', 'showStamp', e.target.checked)}
                    />
                    <span>Show Stamp Placeholder</span>
                  </label>
                </div>
              </TabsContent>

              {/* Paper Tab */}
              <TabsContent value="paper" className="space-y-4">
                <div>
                  <Label>Paper Size</Label>
                  <Select
                    value={formData.paperSize}
                    onValueChange={(value) => setFormData({ ...formData, paperSize: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem value="LETTER">Letter (8.5 x 11 in)</SelectItem>
                      <SelectItem value="LEGAL">Legal (8.5 x 14 in)</SelectItem>
                      <SelectItem value="A5">A5 (148 x 210 mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Orientation</Label>
                  <Select
                    value={formData.orientation}
                    onValueChange={(value) => setFormData({ ...formData, orientation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Margins (mm)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label className="text-xs">Top</Label>
                      <Input
                        type="number"
                        value={formData.margins?.top || 15}
                        onChange={(e) => setFormData({
                          ...formData,
                          margins: { ...formData.margins, top: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Right</Label>
                      <Input
                        type="number"
                        value={formData.margins?.right || 15}
                        onChange={(e) => setFormData({
                          ...formData,
                          margins: { ...formData.margins, right: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bottom</Label>
                      <Input
                        type="number"
                        value={formData.margins?.bottom || 15}
                        onChange={(e) => setFormData({
                          ...formData,
                          margins: { ...formData.margins, bottom: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Left</Label>
                      <Input
                        type="number"
                        value={formData.margins?.left || 15}
                        onChange={(e) => setFormData({
                          ...formData,
                          margins: { ...formData.margins, left: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleSave}
                disabled={updateTemplate.isPending || uploadLogo.isPending}
                className="flex-1"
              >
                {(updateTemplate.isPending || uploadLogo.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg p-4 sticky top-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </h3>
            <div className="bg-white border rounded p-4 text-xs" style={{ fontSize: '10px' }}>
              {/* Mini Preview */}
              <div className="border-b-2 pb-2 mb-2" style={{ borderColor: formData.header?.headerBorderColor }}>
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-8 mb-1" />
                )}
                <div className="font-bold">{formData.header?.labName}</div>
                <div className="text-gray-600 text-[8px]">{formData.header?.motto}</div>
                <div className="text-gray-600 text-[8px]">{formData.header?.phone}</div>
              </div>
              <div className="text-center font-bold mb-2">LABORATORY REPORT</div>
              <div className="bg-gray-50 p-2 mb-2 text-[8px]">
                <div>Patient: John Doe</div>
                {formData.patientSection?.showDoctor && <div>Doctor: Dr. Smith</div>}
                {formData.patientSection?.showCollectionDate && <div>Collected: 31/01/26</div>}
              </div>
              <div className="mb-2">
                <div className="font-bold p-1 text-[8px]" style={{ backgroundColor: formData.resultsSection?.categoryHeaderColor }}>
                  CLINICAL CHEMISTRY
                </div>
                <div className="text-[8px] p-1">
                  <div className="flex justify-between">
                    <span>Test</span>
                    <span>Result</span>
                    <span>Range</span>
                  </div>
                </div>
              </div>
              {formData.footer?.showWaveDesign && (
                <div className="mt-2 h-4 rounded" style={{
                  background: `linear-gradient(90deg, ${formData.footer?.waveColor1} 0%, ${formData.footer?.waveColor2} 100%)`
                }}></div>
              )}
              <div className="text-center text-[7px] mt-1">{formData.footer?.footerText}</div>
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}
