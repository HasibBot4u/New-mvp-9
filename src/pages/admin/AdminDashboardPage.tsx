import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRealtime } from "@/hooks/useRealtime";
import { Activity, Users, Video, DollarSign, Server, AlertTriangle } from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid 
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7'];

export default function AdminDashboardPage() {
  const { stats, isLoading } = useAdminStats();
  useRealtime();

  if (isLoading || !stats) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-white/5 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/5 rounded-xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-foreground-muted text-sm mt-1">Real-time metrics and system health.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("Code generated")}>Generate Code</Button>
          <Button variant="outline" size="sm" onClick={() => toast("Upload opened")}>Upload Video</Button>
          <Button variant="outline" size="sm" onClick={() => toast("Mode toggled")}>Maintenance</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Total Users</CardTitle>
            <Users className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-foreground-dim mt-1">
              {stats.activeUsersToday} active today
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Revenue Today</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">BDT {stats.revenueToday}</div>
            <p className="text-xs text-foreground-dim mt-1">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Total Videos</CardTitle>
            <Video className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVideos}</div>
            <p className="text-xs text-foreground-dim mt-1">1.2 TB storage used</p>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">System Health</CardTitle>
            <Server className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-emerald-400">All Systems Normal</div>
            <p className="text-xs text-foreground-dim mt-1">
              Telegram {stats.telegramHealth.okChannels}/{stats.telegramHealth.totalChannels} OK
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Signups Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.usersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="signups" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Views by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.viewsBySubject}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.viewsBySubject.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {stats.viewsBySubject.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-foreground-muted">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.map(act => (
                <div key={act.id} className="flex items-start gap-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    act.type === 'signup' ? 'bg-blue-500/10 text-blue-400' :
                    act.type === 'payment' ? 'bg-emerald-500/10 text-emerald-400' :
                    act.type === 'alert' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {act.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{act.title}</p>
                    <p className="text-xs text-foreground-dim mt-0.5">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Enrollment Code Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={stats.enrollmentUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                    cursor={{ fill: '#ffffff05' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
