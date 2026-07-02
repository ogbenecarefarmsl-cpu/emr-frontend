import { useState } from 'react';
import { useCreateBranch, useBatchCreateUsers } from '@/hooks/useBranch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Building2, Pill, FlaskConical, UserPlus, Rocket,
  ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle2, Info,
  Eye, EyeOff, Sparkles, Loader2,
} from 'lucide-react';

interface StaffUser {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

interface WizardState {
  name: string;
  code: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  operatingHours: string;
  logoUrl: string;
  footerText: string;
  cafBranchId: string;
  cafTerminalId: string;
  cafEnabled: boolean;
  cafBaseUrl: string;
  cafUsername: string;
  cafPassword: string;
  provisionCaf: boolean;
  lisEnabled: boolean;
  lisBaseUrl: string;
  labApiKey: string;
  labFacilityId: string;
  users: StaffUser[];
}

const INITIAL_STATE: WizardState = {
  name: '',
  code: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  operatingHours: '',
  logoUrl: '',
  footerText: '',
  cafBranchId: '',
  cafTerminalId: 'emr-integration',
  cafEnabled: false,
  cafBaseUrl: '',
  cafUsername: '',
  cafPassword: '',
  provisionCaf: false,
  lisEnabled: false,
  lisBaseUrl: '',
  labApiKey: '',
  labFacilityId: '',
  users: [],
};

const STEPS = [
  { label: 'Details', icon: Building2 },
  { label: 'CAF', icon: Pill },
  { label: 'LIS', icon: FlaskConical },
  { label: 'Staff', icon: UserPlus },
  { label: 'Launch', icon: Rocket },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  { value: 'receptionist', label: 'Receptionist', color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'doctor', label: 'Doctor', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'specialist', label: 'Specialist', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { value: 'nurse', label: 'Nurse', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  { value: 'pharmacist', label: 'Pharmacist', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'lab_tech', label: 'Lab Tech', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'inventory_manager', label: 'Inventory Manager', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
];

interface BranchSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BranchSetupWizard({ open, onOpenChange }: BranchSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardState>(INITIAL_STATE);
  const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdBranchId, setCreatedBranchId] = useState<string | null>(null);
  const [userErrors, setUserErrors] = useState<Array<{ email: string; error: string }>>([]);

  const createBranch = useCreateBranch();
  const batchCreateUsers = useBatchCreateUsers();

  const update = (field: keyof WizardState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.code.trim();
    return true;
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setUserErrors([]);
    try {
      const result = await createBranch.mutateAsync({
        name: form.name,
        code: form.code.toUpperCase(),
        tagline: form.tagline,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        operatingHours: form.operatingHours,
        logoUrl: form.logoUrl,
        footerText: form.footerText,
        cafBranchId: form.cafBranchId || undefined,
        cafTerminalId: form.cafTerminalId || undefined,
        cafEnabled: form.cafEnabled,
        cafBaseUrl: form.cafBaseUrl || undefined,
        cafUsername: form.cafUsername || undefined,
        cafPassword: form.cafPassword || undefined,
        provisionCaf: form.provisionCaf,
        lisEnabled: form.lisEnabled,
        lisBaseUrl: form.lisBaseUrl || undefined,
        labApiKey: form.labApiKey || undefined,
        labFacilityId: form.labFacilityId || undefined,
      });
      const branch = result?.branch || result;

      setCreatedBranchId(branch._id);

      if (result?.generatedPassword) {
        toast.success(`CAF provisioned. Username: ${result.cafUsername}. Password: ${result.generatedPassword}`);
      }

      if (form.users.length > 0) {
        const result = await batchCreateUsers.mutateAsync({
          branchId: branch._id,
          users: form.users.map((u) => ({
            ...u,
            password: u.password || 'TempPassword123!',
          })),
        });
        if (result.errors?.length > 0) {
          setUserErrors(result.errors);
        }
      }

      setSuccess(true);
      toast.success('Branch created successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to create branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setForm(INITIAL_STATE);
    setShowPassword({});
    setIsSubmitting(false);
    setSuccess(false);
    setCreatedBranchId(null);
    setUserErrors([]);
    onOpenChange(false);
  };

  const addUser = () => {
    setForm((prev) => ({
      ...prev,
      users: [...prev.users, { fullName: '', email: '', password: 'TempPassword123!', role: 'receptionist' }],
    }));
  };

  const removeUser = (index: number) => {
    setForm((prev) => ({
      ...prev,
      users: prev.users.filter((_, i) => i !== index),
    }));
  };

  const updateUser = (index: number, field: keyof StaffUser, value: string) => {
    setForm((prev) => ({
      ...prev,
      users: prev.users.map((u, i) => (i === index ? { ...u, [field]: value } : u)),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetWizard(); }}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            {success ? 'Branch Created' : 'New Branch Setup'}
          </DialogTitle>
          <DialogDescription>
            {success
              ? 'Your new branch is ready. You can start adding patients and staff.'
              : `Step ${step + 1} of ${STEPS.length} — ${STEPS[step].label}`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {!success && (
          <div className="flex items-center gap-1 py-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      i < step
                        ? 'bg-primary text-primary-foreground'
                        : i === step
                        ? 'border-2 border-primary bg-primary/10 text-primary'
                        : 'border-2 border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mt-[-12px] ${i < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="py-4">
          {success ? (
            <SuccessStep branchId={createdBranchId} userErrors={userErrors} onClose={resetWizard} />
          ) : step === 0 ? (
            <StepDetails form={form} update={update} />
          ) : step === 1 ? (
            <StepCaf form={form} update={update} />
          ) : step === 2 ? (
            <StepLis form={form} update={update} />
          ) : step === 3 ? (
            <StepStaff
              form={form}
              addUser={addUser}
              removeUser={removeUser}
              updateUser={updateUser}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          ) : (
            <StepReview form={form} />
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <>
                  {step === 1 && (
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      Skip CAF →
                    </Button>
                  )}
                  {step === 2 && (
                    <Button variant="ghost" onClick={() => setStep(3)}>
                      Skip LIS →
                    </Button>
                  )}
                  <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleFinish} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4 mr-2" />
                  )}
                  Create Branch & Users
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDetails({ form, update }: { form: WizardState; update: (f: keyof WizardState, v: any) => void }) {
  return (
    <div className="border rounded-lg p-5 border-primary/20 bg-primary/5 space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Building2 className="w-5 h-5 text-primary" />
        Branch Details
      </div>
      <p className="text-sm text-muted-foreground">Define your new outlet's identity and contact information.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Branch Name *</Label>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Harbour Medical — Water Street" />
        </div>
        <div className="space-y-1">
          <Label>Code *</Label>
          <Input value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} placeholder="e.g. HMD-WS" />
        </div>
        <div className="space-y-1">
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="Trusted by clinics & hospitals" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street, City, Country" />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+232..." />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="reception@..." />
        </div>
        <div className="space-y-1">
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-1">
          <Label>Operating Hours</Label>
          <Input value={form.operatingHours} onChange={(e) => update('operatingHours', e.target.value)} placeholder="Mon-Sat 8am-8pm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Logo URL</Label>
          <Input value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} placeholder="https://...logo.png" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Footer Text</Label>
          <Input value={form.footerText} onChange={(e) => update('footerText', e.target.value)} placeholder="Thank you for choosing us! | Open 24/7" />
        </div>
      </div>
    </div>
  );
}

function StepCaf({ form, update }: { form: WizardState; update: (f: keyof WizardState, v: any) => void }) {
  return (
    <div className="border rounded-lg p-5 border-amber-500/20 bg-amber-50 space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Pill className="w-5 h-5 text-amber-600" />
        CAF Pharmacy Integration
      </div>
      <Alert className="border-amber-200 bg-white/80">
        <Info className="h-4 w-4 text-amber-700" />
        <AlertTitle>Choose one CAF path</AlertTitle>
        <AlertDescription className="text-amber-800">
          Use automatic provisioning when the backend CAF credential has admin permission to create branches. Use existing CAF branch when CAF already has the branch and branch manager user.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-amber-200 bg-white/70 p-3">
          <div>
            <p className="text-sm font-medium">Provision CAF automatically</p>
            <p className="text-xs text-muted-foreground">Creates the CAF branch and a branch_manager integration user, then saves the returned CAF branch ID in EMR.</p>
          </div>
          <Switch checked={form.provisionCaf} onCheckedChange={(v) => update('provisionCaf', v)} />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-amber-200 bg-white/70 p-3">
          <div>
            <p className="text-sm font-medium">Use existing CAF branch</p>
            <p className="text-xs text-muted-foreground">Paste the CAF branch ID and branch manager credentials below. Use this if provisioning fails with a permission error.</p>
          </div>
          <Switch checked={form.cafEnabled} onCheckedChange={(v) => update('cafEnabled', v)} />
        </div>
        <div className="space-y-1">
          <Label>CAF Base URL</Label>
          <Input value={form.cafBaseUrl} onChange={(e) => update('cafBaseUrl', e.target.value)} placeholder="https://caf.example.com" />
        </div>
        <div className="space-y-1">
          <Label>CAF Username</Label>
          <Input value={form.cafUsername} onChange={(e) => update('cafUsername', e.target.value)} placeholder="branch manager username" />
        </div>
        <div className="space-y-1">
          <Label>CAF Password</Label>
          <Input type="password" value={form.cafPassword} onChange={(e) => update('cafPassword', e.target.value)} placeholder="branch manager password" />
        </div>
        <div className="space-y-1">
          <Label>CAF Branch ID</Label>
          <Input value={form.cafBranchId} onChange={(e) => update('cafBranchId', e.target.value)} placeholder="Paste from CAF admin panel" />
        </div>
        <div className="space-y-1">
          <Label>CAF Terminal ID</Label>
          <Input value={form.cafTerminalId} onChange={(e) => update('cafTerminalId', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function StepLis({ form, update }: { form: WizardState; update: (f: keyof WizardState, v: any) => void }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="border rounded-lg p-5 border-cyan-500/20 bg-cyan-50 space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <FlaskConical className="w-5 h-5 text-cyan-600" />
        LIS Lab Integration
      </div>
      <Alert className="border-cyan-200 bg-white/80">
        <Info className="h-4 w-4 text-cyan-700" />
        <AlertTitle>LIS is configured, not provisioned</AlertTitle>
        <AlertDescription className="text-cyan-800">
          The current LIS API lets EMR send orders, sync payment state, and import results. It does not expose a facility/API-key creation endpoint, so create the facility/API key in LIS first, then paste it here.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-cyan-200 bg-white/70 p-3">
          <div>
            <p className="text-sm font-medium">Enable LIS for this branch</p>
            <p className="text-xs text-muted-foreground">Lab orders and results will use this branch config.</p>
          </div>
          <Switch checked={form.lisEnabled} onCheckedChange={(v) => update('lisEnabled', v)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>LIS Base URL</Label>
          <Input value={form.lisBaseUrl} onChange={(e) => update('lisBaseUrl', e.target.value)} placeholder="https://lis.example.com" />
        </div>
        <div className="space-y-1">
          <Label>LIS API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={form.labApiKey}
              onChange={(e) => update('labApiKey', e.target.value)}
              placeholder="lis_..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label>LIS Facility ID</Label>
          <Input value={form.labFacilityId} onChange={(e) => update('labFacilityId', e.target.value)} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
}

function StepStaff({
  form, addUser, removeUser, updateUser, showPassword, setShowPassword,
}: {
  form: WizardState;
  addUser: () => void;
  removeUser: (i: number) => void;
  updateUser: (i: number, f: keyof StaffUser, v: string) => void;
  showPassword: Record<number, boolean>;
  setShowPassword: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  return (
    <div className="border rounded-lg p-5 border-emerald-500/20 bg-emerald-50 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Staff Users
          </div>
          <p className="text-sm text-muted-foreground mt-1">Add team members for this branch. All users will be auto-assigned here.</p>
        </div>
        <Button size="sm" variant="outline" onClick={addUser} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add Staff
        </Button>
      </div>

      {form.users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg border-emerald-300 bg-white/50">
          <UserPlus className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="font-medium">No staff added yet</p>
          <p className="text-xs mt-1">Click "Add Staff" to create users for this branch.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {form.users.map((user, i) => (
            <div key={i} className="bg-white rounded-lg border border-emerald-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={ROLE_OPTIONS.find((r) => r.value === user.role)?.color || ''}
                >
                  {ROLE_OPTIONS.find((r) => r.value === user.role)?.label || user.role}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => removeUser(i)} className="h-6 px-2 text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Full Name"
                  value={user.fullName}
                  onChange={(e) => updateUser(i, 'fullName', e.target.value)}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={user.email}
                  onChange={(e) => updateUser(i, 'email', e.target.value)}
                />
                <div className="relative">
                  <Input
                    placeholder="Password"
                    type={showPassword[i] ? 'text' : 'password'}
                    value={user.password}
                    onChange={(e) => updateUser(i, 'password', e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => ({ ...p, [i]: !p[i] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword[i] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <Select value={user.role} onValueChange={(v) => updateUser(i, 'role', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepReview({ form }: { form: WizardState }) {
  const hasCaf = !!(form.provisionCaf || (form.cafEnabled && form.cafBaseUrl && form.cafUsername && form.cafPassword && form.cafBranchId));
  const hasLis = !!(form.lisEnabled && form.lisBaseUrl && form.labApiKey);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-5 border-primary bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Rocket className="w-5 h-5 text-primary" />
          Review & Launch
        </div>
        <p className="text-sm text-muted-foreground">Confirm everything looks correct before creating the branch.</p>
      </div>

      {/* Branch */}
      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Branch</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> {form.name}</div>
          <div><span className="text-muted-foreground">Code:</span> {form.code.toUpperCase()}</div>
          {form.tagline && <div><span className="text-muted-foreground">Tagline:</span> {form.tagline}</div>}
          {form.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {form.address}</div>}
          {form.phone && <div><span className="text-muted-foreground">Phone:</span> {form.phone}</div>}
          {form.email && <div><span className="text-muted-foreground">Email:</span> {form.email}</div>}
        </div>
      </div>

      {/* Integrations */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-4 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-600" /> CAF
          </p>
          <Badge variant="outline" className={hasCaf ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-muted text-muted-foreground'}>
            {hasCaf ? 'Configured' : 'Skipped'}
          </Badge>
          {hasCaf && <p className="text-xs text-muted-foreground">{form.provisionCaf ? 'CAF branch/user will be created automatically' : `Branch ID: ${form.cafBranchId}`}</p>}
        </div>
        <div className="border rounded-lg p-4 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-600" /> LIS
          </p>
          <Badge variant="outline" className={hasLis ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-muted text-muted-foreground'}>
            {hasLis ? 'Configured' : 'Skipped'}
          </Badge>
          {hasLis && <p className="text-xs text-muted-foreground">API Key: ****{form.labApiKey.slice(-4)}</p>}
        </div>
      </div>

      {form.cafEnabled && !hasCaf && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-700" />
          <AlertTitle>CAF needs one complete path</AlertTitle>
          <AlertDescription className="text-amber-800">
            Either enable automatic provisioning, or fill CAF base URL, username, password, and branch ID for an existing CAF branch.
          </AlertDescription>
        </Alert>
      )}

      {form.lisEnabled && !hasLis && (
        <Alert className="border-cyan-200 bg-cyan-50">
          <Info className="h-4 w-4 text-cyan-700" />
          <AlertTitle>LIS setup is incomplete</AlertTitle>
          <AlertDescription className="text-cyan-800">
            Fill LIS base URL and API key before using this branch for lab orders.
          </AlertDescription>
        </Alert>
      )}

      {/* Staff */}
      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-semibold flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-600" /> Staff ({form.users.length})
        </p>
        {form.users.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No staff added — you can add them later via Staff & Roles.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {form.users.map((u, i) => (
              <Badge key={i} variant="outline" className={ROLE_OPTIONS.find((r) => r.value === u.role)?.color || ''}>
                {u.fullName || u.email} ({ROLE_OPTIONS.find((r) => r.value === u.role)?.label || u.role})
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessStep({
  branchId, userErrors, onClose,
}: {
  branchId: string | null;
  userErrors: Array<{ email: string; error: string }>;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Branch Created Successfully</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your new branch is live and ready to use.
        </p>
      </div>

      {userErrors.length > 0 && (
        <div className="border rounded-lg p-3 bg-amber-50 border-amber-200 text-left max-w-md mx-auto">
          <p className="font-semibold text-amber-800 text-sm">Some staff accounts could not be created:</p>
          {userErrors.map((e, i) => (
            <p key={i} className="text-xs text-amber-700 mt-1">{e.email}: {e.error}</p>
          ))}
        </div>
      )}

      <Button onClick={onClose} className="mt-4">Done</Button>
    </div>
  );
}
