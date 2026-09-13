import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Trash2, Send } from 'lucide-react';

export interface TestItem {
  _id: string;
  code: string;
  name: string;
  price: number;
  category?: string;
  sampleType?: string;
  turnaroundTime?: number;
  isPanel?: boolean;
  panelComponents?: Array<{ testCode: string; testName: string }>;
}

interface DoctorLabOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: any | null;
  tests: TestItem[];
  testsLoading: boolean;
  testsError: boolean;
  testsLoadError: any;
  selectedTests: TestItem[];
  onAddTest: (test: TestItem) => void;
  onRemoveTest: (testId: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DoctorLabOrderModal({
  open,
  onOpenChange,
  editingOrder,
  tests,
  testsLoading,
  testsError,
  testsLoadError,
  selectedTests,
  onAddTest,
  onRemoveTest,
  onCancel,
  onSubmit,
  isPending,
}: DoctorLabOrderModalProps) {
  const [searchTest, setSearchTest] = useState('');

  const lisOrderables = Array.isArray(tests) ? tests : [];
  const filteredTests = useMemo(() => {
    if (!searchTest) return lisOrderables.slice(0, 25);
    const q = searchTest.toLowerCase();
    return lisOrderables.filter((t) =>
      t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [lisOrderables, searchTest]);

  const totalAmount = selectedTests.reduce((sum, t) => sum + (t.price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-left text-base">
            {editingOrder ? 'Edit LIS Test Request' : 'Create LIS Test Request'}
          </DialogTitle>
          <DialogDescription className="text-left">
            Search the LIS catalog and add tests or panels to a new request.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Search Tests</Label>
              <Input
                value={searchTest}
                onChange={(e) => setSearchTest(e.target.value)}
                placeholder="Search by test name or code..."
                className="mt-1"
              />
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {testsLoading ? (
                  <div className="h-full p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading LIS catalog
                  </div>
                ) : testsError ? (
                  <div className="p-6 text-center text-sm text-red-600">
                    Could not load LIS catalog.
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(testsLoadError as any)?.response?.data?.message ||
                        (testsLoadError as any)?.message ||
                        'Check backend LIS connection.'}
                    </p>
                  </div>
                ) : filteredTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No LIS tests or panels found
                  </div>
                ) : (
                  filteredTests.map((test) => (
                    <div
                      key={test._id || test.code}
                      className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 flex items-center justify-between"
                      onClick={() => onAddTest(test)}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{test.name}</p>
                          {test.isPanel && (
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              Panel
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {test.code} - Le {test.price?.toLocaleString()}
                          {test.isPanel && test.panelComponents && (
                            <span className="ml-1">({test.panelComponents.length} components)</span>
                          )}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>

            <div>
              <Label className="text-sm font-medium">Selected Tests ({selectedTests.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {selectedTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Click tests to add them
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedTests.map((test) => (
                      <div key={test._id || test.code} className="p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{test.name}</p>
                            {test.isPanel && (
                              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                Panel
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Le {test.price?.toLocaleString()}</p>
                          {test.isPanel && test.panelComponents && test.panelComponents.length > 0 && (
                            <div className="mt-1.5 ml-2 pl-2 border-l-2 border-primary/30">
                              {test.panelComponents.map((comp: any, idx: number) => (
                                <p key={idx} className="text-[11px] text-muted-foreground truncate">
                                  • {comp.testName || comp.testCode}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveTest(test._id || test.code)}
                          className="shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedTests.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Total: Le {totalAmount.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || selectedTests.length === 0}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {editingOrder ? 'Update Order' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
