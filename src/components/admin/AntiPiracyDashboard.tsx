import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users, Lock, HardDrive } from "lucide-react";

export function AntiPiracyDashboard() {
  const flags = [
    { id: '1', user: 'user@example.com', reason: 'Multiple IP addresses (5 in 1h)', risk: 'High', date: '2 mins ago' },
    { id: '2', user: 'test@student.com', reason: 'VPN/Proxy Detected', risk: 'Medium', date: '15 mins ago' },
    { id: '3', user: 'hacker123@mail.com', reason: 'Concurrent login attempts', risk: 'Low', date: '1 hour ago' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-white">Piracy & Security Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-black/40 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">High Risk Accounts</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">VPN Connections Blocked</CardTitle>
            <Lock className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">143</div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Concurrent Sessions</CardTitle>
            <Users className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">5</div>
            <p className="text-xs text-zinc-500">Auto-invalidated</p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Bound Devices</CardTitle>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">4,231</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-white">Recent Security Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">User</TableHead>
                <TableHead className="text-zinc-400">Flag Reason</TableHead>
                <TableHead className="text-zinc-400">Risk Level</TableHead>
                <TableHead className="text-zinc-400">Time</TableHead>
                <TableHead className="text-right text-zinc-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium text-zinc-300">{flag.user}</TableCell>
                  <TableCell className="text-zinc-400">{flag.reason}</TableCell>
                  <TableCell>
                    <Badge variant={flag.risk === 'High' ? 'destructive' : flag.risk === 'Medium' ? 'default' : 'outline'} className={flag.risk === 'Medium' ? 'bg-amber-500 hover:bg-amber-600' : ''}>
                      {flag.risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">{flag.date}</TableCell>
                  <TableCell className="text-right text-destructive hover:text-destructive/80 cursor-pointer text-sm">
                    Block User
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
