import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Activity, Database, CheckCircle2, XCircle, RefreshCcw, HardDrive, Wifi } from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Mock RPM data
const MOCK_RPM = Array.from({length: 20}, (_, i) => ({
  time: `${i}m ago`,
  rpm: Math.floor(Math.random() * 500) + 100
})).reverse();

export default function AdminSystemPage() {
  const { stats } = useAdminStats();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
          <p className="text-foreground-muted text-sm mt-1">Infrastructure health, telegram bots, and API metrics.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <RefreshCcw className="w-4 h-4 mr-2" /> Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" /> API Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">Online</div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-foreground-muted">Version</span><span>v2.1.4</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Uptime</span><span>14d 8h 22m</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Memory</span><span>1.2 GB / 4.0 GB</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Database (Supabase)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">Connected</div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-foreground-muted">Size</span><span>456 MB</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Avg Response</span><span>45ms</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Pool Status</span><span>12 / 100 conns</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted flex items-center gap-2">
              <Wifi className="w-4 h-4 text-purple-400" /> Telegram Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {stats?.telegramHealth.okChannels} / {stats?.telegramHealth.totalChannels} OK
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-foreground-muted">Bot Status</span><span className="text-emerald-400">Running</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Rate Limit</span><span>Safe (15%)</span></div>
              <div className="flex justify-between"><span className="text-foreground-muted">Avg Latency</span><span>120ms</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" /> Allowed Requests Per Minute (RPM)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_RPM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="stepAfter" dataKey="rpm" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> Telegram Channel Shards
          </CardTitle>
          <Button variant="outline" size="sm">Add Channel</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({length: 8}).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-foreground">Shard 0{i+1}</span>
                  {i === 2 ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-foreground-muted flex justify-between">
                  <span>Usage</span>
                  <span>~1.2 TB</span>
                </div>
                <div className="w-full h-1 mt-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${i === 2 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.random() * 80 + 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
