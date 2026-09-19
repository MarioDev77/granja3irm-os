'use client';

import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bird, Boxes, CircleDollarSign,
  Egg, PawPrint, Sparkles, Users, Wheat,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

function fmtBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function MetricCard({ title, value, trend, icon: Icon, tone = 'default', detail }) {
  const trendUp = typeof trend === 'number' && trend >= 0;
  return (
    <Card className="border-white/10 bg-zinc-900/70 shadow-none transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between p-5">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold tracking-tight text-zinc-100">{value}</span>
            {typeof trend === 'number' && (
              <span className={`mb-1 flex items-center text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {trendUp ? <ArrowUpRight className="mr-0.5 size-3" /> : <ArrowDownRight className="mr-0.5 size-3" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
        <div
          className={`flex size-10 items-center justify-center rounded-xl ${
            tone === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-zinc-800 text-zinc-200'
          }`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardView({ data, accessDenied, userName }) {
  const hasChartData = data.weeklySeries.some((d) => d.ovos > 0 || d.racao > 0);

  return (
    <div>
      {accessDenied && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Seu perfil não tem permissão para acessar a página solicitada.
        </div>
      )}

      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span className="size-2 rounded-full bg-white" /> VISÃO GERAL DA GRANJA
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard principal</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe os principais indicadores da sua operação.</p>
        </div>
      </div>

      {!data.hasAnyProductionData && (
        <div className="mb-6 rounded-lg border border-white/10 bg-zinc-900/70 p-5 text-sm text-zinc-300">
          Não há dados registrados ainda. Cadastre galpões, lotes e aves para que os indicadores comecem a aparecer
          aqui automaticamente.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total de aves ativas" value={data.activeBirdCount.toLocaleString('pt-BR')} icon={PawPrint} detail="Aves com status ativo" />
        <MetricCard title="Lotes ativos" value={data.activeFlockCount} icon={Bird} detail={`${data.shedCount} galpão(ões) cadastrado(s)`} />
        <MetricCard title="Mortalidade (mês)" value={data.monthMortality} icon={Activity} detail="Aves no mês corrente" tone="red" />
        <MetricCard
          title="Ovos hoje"
          value={data.todayEggs.toLocaleString('pt-BR')}
          trend={data.eggTrend ?? undefined}
          icon={Egg}
          detail="Coletados hoje"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Usuários do sistema" value={data.totalUsers} icon={Users} />
        <MetricCard
          title="Consumo de ração (7d)"
          value={`${data.weeklySeries.reduce((s, d) => s + d.racao, 0).toLocaleString('pt-BR')} kg`}
          trend={data.feedTrend ?? undefined}
          icon={Wheat}
        />
        {data.finance ? (
          <>
            <MetricCard title="Receita do mês" value={fmtBRL(data.finance.revenue)} icon={CircleDollarSign} />
            <MetricCard
              title="Lucro estimado"
              value={fmtBRL(data.finance.profit)}
              icon={CircleDollarSign}
              detail={data.finance.profit >= 0 ? 'Positivo' : 'Negativo'}
              tone={data.finance.profit >= 0 ? 'default' : 'red'}
            />
          </>
        ) : (
          <MetricCard title="Alertas não lidos" value={data.unreadAlerts} icon={AlertTriangle} tone={data.unreadAlerts > 0 ? 'red' : 'default'} />
        )}
      </div>

      {data.finance && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Despesas do mês" value={fmtBRL(data.finance.expenses)} icon={CircleDollarSign} />
          <MetricCard title="Contas a pagar em aberto" value={fmtBRL(data.finance.openPayable)} icon={CircleDollarSign} />
          <MetricCard title="Contas a receber em aberto" value={fmtBRL(data.finance.openReceivable)} icon={CircleDollarSign} />
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="border-white/10 bg-zinc-900/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Evolução da operação (7 dias)</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Ovos coletados por dia</p>
            </div>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <ChartContainer config={{ ovos: { label: 'Ovos', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
                <AreaChart data={data.weeklySeries} margin={{ left: -20, right: 4, top: 8 }}>
                  <defs>
                    <linearGradient id="fillOvos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-ovos)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--color-ovos)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="ovos" stroke="var(--color-ovos)" strokeWidth={2.5} fill="url(#fillOvos)" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm text-zinc-500">Sem produção registrada nos últimos 7 dias.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Consumo de ração</CardTitle>
            <p className="text-xs text-muted-foreground">Quilos consumidos por dia</p>
          </CardHeader>
          <CardContent>
            {hasChartData ? (
              <ChartContainer config={{ racao: { label: 'Consumo', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
                <BarChart data={data.weeklySeries} margin={{ left: -20, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="racao" fill="var(--color-racao)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-16 text-center text-sm text-zinc-500">Sem consumo registrado nos últimos 7 dias.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-white/10 bg-zinc-900/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Lotes em destaque</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Lotes ativos mais recentes</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.topFlocks.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-zinc-500">Nenhum lote ativo cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-white/10 bg-white/[0.03] text-left text-xs text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Lote</th>
                      <th className="px-4 py-3 font-medium">Aves ativas</th>
                      <th className="px-4 py-3 font-medium">Idade</th>
                      <th className="px-6 py-3 font-medium">Mortalidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFlocks.map((f) => (
                      <tr key={f.id} className="border-b border-white/10 last:border-0">
                        <td className="px-6 py-3.5 font-medium">
                          {f.name} <span className="text-zinc-500">({f.code})</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{f.activeBirds}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{f.ageWeeks} sem.</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={f.mortalityRate >= 3 ? 'destructive' : 'secondary'}>{f.mortalityRate}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-900/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Alertas importantes</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Itens que precisam da sua atenção</p>
            </div>
            {data.unreadAlerts > 0 && (
              <Badge variant="outline" className="border-red-500/30 text-red-400">
                {data.unreadAlerts} alerta{data.unreadAlerts > 1 ? 's' : ''}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {data.recentAlerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Nenhum alerta pendente.</p>
            ) : (
              data.recentAlerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {data.insights.length > 0 && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            {data.insights.map((insight, i) => (
              <p key={i}>{insight}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
