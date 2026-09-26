'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import ChartCard from './ChartCard';

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function monthLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

export default function VaccinationCharts({ records }) {
  const byMonth = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const key = monthLabel(r.date);
      map.set(key, (map.get(key) || 0) + Number(r.quantity || 0));
    }
    return Array.from(map, ([month, doses]) => ({ month, doses })).slice(-12);
  }, [records]);

  const byVaccine = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      map.set(r.vaccine, (map.get(r.vaccine) || 0) + Number(r.quantity || 0));
    }
    return Array.from(map, ([vaccine, doses]) => ({ vaccine, doses }))
      .sort((a, b) => b.doses - a.doses)
      .slice(0, 6);
  }, [records]);

  const byFlock = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const name = r.flock?.name || 'Sem lote';
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map, ([name, aplicacoes]) => ({ name, aplicacoes })).sort((a, b) => b.aplicacoes - a.aplicacoes);
  }, [records]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Doses aplicadas por mês" subtitle="Soma da quantidade aplicada em todas as vacinas" isEmpty={byMonth.length === 0}>
        <ChartContainer config={{ doses: { label: 'Doses', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
          <BarChart data={byMonth} margin={{ left: -20, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="doses" fill="var(--color-doses)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Vacinas mais aplicadas" subtitle="Top 6 por total de doses" isEmpty={byVaccine.length === 0}>
        <ChartContainer config={{ doses: { label: 'Doses', color: 'var(--chart-3)' } }} className="h-[260px] w-full">
          <PieChart>
            <Tooltip content={<ChartTooltipContent />} />
            <Pie data={byVaccine} dataKey="doses" nameKey="vaccine" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {byVaccine.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Aplicações por lote"
        subtitle="Número de registros de vacinação por lote"
        isEmpty={byFlock.length === 0}
        className="xl:col-span-2"
      >
        <ChartContainer config={{ aplicacoes: { label: 'Aplicações', color: 'var(--chart-4)' } }} className="h-[260px] w-full">
          <BarChart data={byFlock} layout="vertical" margin={{ left: 16, right: 16, top: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} fontSize={11} width={110} />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="aplicacoes" fill="var(--color-aplicacoes)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
