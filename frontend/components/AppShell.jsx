'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Activity, AlertTriangle, Bell, Bird, Boxes, Bug, CircleDollarSign, ClipboardList,
  Egg, Factory, FileText, LayoutDashboard, Leaf, Menu, Package, PawPrint,
  Settings, ShieldCheck, ShoppingCart, Syringe, Tractor, Users, Wheat, X,
} from 'lucide-react';
import { SECTIONS, ROLE_LABELS, can } from '@/lib/rbac';

// Mesma estrutura de menu do Sidebar original (rotas reais, filtradas por
// RBAC) — só o visual muda para o estilo do mockup v0. Itens sem `href`
// ainda não têm tela implementada e não aparecem aqui (ver Sidebar.jsx
// antigo, mantido em components/ para referência, para a lista completa
// incl. itens "Em breve").
const NAV_GROUPS = [
  {
    label: 'PRODUÇÃO',
    items: [
      ['Dashboard', '/dashboard', LayoutDashboard, SECTIONS.DASHBOARD],
      ['Galpões', '/galpoes', Factory, SECTIONS.PRODUCTION],
      ['Lotes', '/lotes', Bird, SECTIONS.PRODUCTION],
      ['Aves', '/aves', PawPrint, SECTIONS.PRODUCTION],
      ['Produção de ovos', '/producao', Egg, SECTIONS.PRODUCTION],
      ['Mortalidade', '/mortalidade', Activity, SECTIONS.PRODUCTION],
      ['Controle ambiental', '/controle-ambiental', Leaf, SECTIONS.PRODUCTION],
    ],
  },
  {
    label: 'ALIMENTAÇÃO E ESTOQUE',
    items: [
      ['Rações', '/racoes', Wheat, SECTIONS.STOCK],
      ['Estoque de ração', '/estoque-racao', Boxes, SECTIONS.STOCK],
      ['Consumo de ração', '/consumo-racao', ClipboardList, SECTIONS.STOCK],
      ['Estoque de ovos', '/estoque-ovos', Package, SECTIONS.STOCK],
    ],
  },
  {
    label: 'SAÚDE',
    items: [
      ['Vacinação', '/vacinacao', Syringe, SECTIONS.HEALTH],
      ['Medicamentos', '/medicamentos', Bug, SECTIONS.HEALTH],
      ['Ocorrências', '/ocorrencias', AlertTriangle, SECTIONS.HEALTH],
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      ['Vendas', '/vendas', ShoppingCart, SECTIONS.SALES],
      ['Clientes', '/clientes', Users, SECTIONS.SALES],
      ['Compras', '/compras', ShoppingCart, SECTIONS.PURCHASES],
      ['Fornecedores', '/fornecedores', Factory, SECTIONS.PURCHASES],
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      ['Financeiro', '/financeiro', CircleDollarSign, SECTIONS.FINANCE],
      ['Fluxo de caixa', '/fluxo-caixa', CircleDollarSign, SECTIONS.FINANCE],
      ['Contas a pagar', '/contas-pagar', CircleDollarSign, SECTIONS.FINANCE],
      ['Contas a receber', '/contas-receber', CircleDollarSign, SECTIONS.FINANCE],
      ['Custos', '/custos', CircleDollarSign, SECTIONS.FINANCE],
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      ['Relatórios', '/relatorios', FileText, SECTIONS.REPORTS],
      ['Alertas', '/alertas', Bell, null],
      ['Auditoria', '/auditoria', ShieldCheck, SECTIONS.AUDIT],
      ['Usuários', '/usuarios', Users, SECTIONS.USERS],
    ],
  },
];

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let active = true;
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((data) => {
        if (!active) return;
        const list = data.notifications || [];
        setNotifications(list);
        setUnread(list.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const initials = (user?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-black text-white transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-black">
            <Tractor className="size-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-wide">GRANJA OLIVEIRA</p>
            <p className="text-[11px] text-zinc-400">Sistema de Gestão</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(([, , , section]) => !section || can(user?.role, section));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="mb-6">
                <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-emerald-100/45">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  {visibleItems.map(([label, href, Icon]) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                          active ? 'bg-white/12 font-semibold text-white' : 'text-emerald-50/70 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        <Icon className="size-[17px]" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          {can(user?.role, SECTIONS.SETTINGS) && (
            <Link
              href="/configuracoes"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/10"
            >
              <Settings className="size-4" />
              Configurações
            </Link>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-5 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-white/15 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-medium capitalize text-muted-foreground">{today}</p>
              <h1 className="text-xl font-semibold tracking-tight">Olá, {user?.name?.split(' ')[0] || ''}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-lg border border-white/15 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              aria-label="Notificações"
            >
              <Bell className="size-4" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500" />}
            </button>
            <div className="ml-2 hidden h-8 w-px bg-white/10 sm:block" />
            <div className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-white">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="ml-2 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          </div>
        </header>

        {notifOpen && (
          <div className="fixed right-5 top-[84px] z-50 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Notificações</h3>
              {unread > 0 && (
                <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-xs text-red-400">
                  {unread} nova{unread > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="py-4 text-center text-sm text-zinc-500">Nenhuma notificação registrada.</p>
              )}
              {notifications.slice(0, 8).map((n) => (
                <button
                  key={n.id}
                  onClick={() => setNotifOpen(false)}
                  className="flex items-start gap-3 rounded-lg border border-white/10 p-3 text-left hover:bg-white/5"
                >
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-zinc-600' : 'bg-red-500'}`} />
                  <span className="text-sm text-zinc-200">{n.message || n.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* As telas internas (Aves, Lotes, Financeiro etc.) usam a paleta
            "ink"/"olive" herdada do back-end original, pensada para um
            fundo claro (títulos em ink-900, texto secundário em ink-500,
            cards brancos). Sem este fundo claro aqui, esse texto fica quase
            invisível sobre o zinc-950 escuro do shell — por isso a área de
            conteúdo (diferente do cabeçalho/menu, que seguem escuros de
            propósito) recebe um fundo claro próprio. */}
        <div className="min-h-[calc(100vh-5rem)] bg-olive-50">
          <main className="mx-auto max-w-[1600px] p-5 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
