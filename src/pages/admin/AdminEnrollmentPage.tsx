import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Plus, Ticket, Download, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MOCK_CODES = Array.from({length: 15}, (_, i) => ({
  code: `NEXUS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  type: i % 3 === 0 ? 'Batch Promo' : 'Single User',
  chapter_id: 'ch_physics_101',
  uses: Math.floor(Math.random() * 20),
  max_uses: i % 3 === 0 ? 100 : 1,
  expires_at: new Date(Date.now() + Math.random() * 10000000000).toLocaleDateString(),
  is_active: Math.random() > 0.2
}));

export default function AdminEnrollmentPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code} to clipboard`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enrollment Codes</h1>
          <p className="text-foreground-muted text-sm mt-1">Generate and manage access codes for chapters and cycles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-2" /> Generate Codes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" />
                Quick Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-foreground-muted">Target Resource ID (Chapter/Cycle)</label>
                <Input placeholder="ch_..." className="h-9 bg-black/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted">Count</label>
                  <Input type="number" defaultValue={1} min={1} max={500} className="h-9 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted">Max Uses</label>
                  <Input type="number" defaultValue={1} min={1} className="h-9 bg-black/20" />
                </div>
              </div>
              <div className="space-y-2 pb-2">
                <label className="text-xs text-foreground-muted">Expiration Date (Optional)</label>
                <Input type="date" className="h-9 bg-black/20" />
              </div>
              <Button className="w-full">Generate</Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl h-full flex flex-col">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <Input 
                placeholder="Search codes..." 
                className="max-w-[250px] h-9 bg-black/20 border-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_CODES.filter(c => c.code.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10).map((code) => (
                    <TableRow key={code.code} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-sm text-primary">{code.code}</code>
                          <button onClick={() => copyCode(code.code)} className="text-foreground-muted hover:text-foreground">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-muted">{code.type}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">
                          {code.uses} / {code.max_uses}
                        </div>
                        <div className="w-16 h-1 mt-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(100, (code.uses / code.max_uses) * 100)}%` }} 
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-muted">{code.expires_at}</TableCell>
                      <TableCell>
                        {code.is_active && code.uses < code.max_uses ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-white/10 text-foreground-muted">Expired</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-white/5 text-xs text-foreground-muted text-center">
              Showing 10 recent codes
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
