"use client";

import {
  Banknote,
  Building2,
  ChevronDown,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  Presentation,
  NotebookPen,
  FileText,
  Users,
  Megaphone,
  CreditCard,
  FileCheck2,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  BookOpen,
  CalendarRange,
  Layers,
  School,
  Palette,
  ShieldCheck,
  Sparkles,
  Tags,
  Wallet,
  Table2,
  ChartColumn,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { HeaderTools, type HeaderToolsProps } from "@/components/header-tools";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

/** Sur mobile, le menu est un tiroir : on le referme dès qu'on change de page. */
function CloseMenuOnNavigate() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  return null;
}

const ICONS = {
  home: LayoutDashboard,
  upgrade: Sparkles,
  documents: FileCheck2,
  subscription: CreditCard,
  theme: Palette,
  demo: Building2,
  verifications: ShieldCheck,
  schools: Building2,
  payments: Banknote,
  plans: Tags,
  requirements: FileStack,
  calendars: CalendarDays,
  years: CalendarRange,
  levels: Layers,
  subjects: BookOpen,
  classes: School,
  students: GraduationCap,
  attendance: CalendarCheck,
  schedule: CalendarClock,
  teachers: Presentation,
  grades: NotebookPen,
  reports: FileText,
  parents: Users,
  announcements: Megaphone,
  fees: Wallet,
  feeGrid: Table2,
  feeStats: ChartColumn,
  payouts: Landmark,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: string | number;
  /** Actif seulement sur ce chemin exact (page d'accueil). */
  exact?: boolean;
}

/** « Complexe Scolaire Les Palmiers » → « CP » : premier et dernier mot. */
const schoolInitials = (name: string) => {
  const words = name.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w));
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
};

export function AppShell({
  title,
  subtitle,
  logo,
  groups,
  user,
  logoutAction,
  headerEnd,
  tools,
  children,
}: {
  title: string;
  subtitle?: string;
  logo?: string | null;
  groups: { label?: string; items: NavItem[] }[];
  user: { name: string; email: string | null };
  logoutAction: () => Promise<void>;
  headerEnd?: React.ReactNode;
  tools: HeaderToolsProps;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarProvider>
      <CloseMenuOnNavigate />
      <Sidebar collapsible="icon">
        <SidebarHeader className="relative h-14 justify-center border-b border-sidebar-border px-4 after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-sidebar group-data-[collapsible=icon]:px-2">
          {title === "Soukoulou" ? (
            <Link href="/espace" aria-label="Accueil Soukoulou">
              <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
            </Link>
          ) : (
            // Espace d'une école : son nom à la place de la marque.
            <Link href="/espace" className="flex min-w-0 items-center gap-2" title={subtitle ? `${title} · ${subtitle}` : title}>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- image privée relayée, pas d'optimisation
                <img src={logo} alt="" className="size-7 shrink-0 rounded-lg object-contain" />
              ) : (
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground"
                >
                  {schoolInitials(title)}
                </span>
              )}
              <span className="line-clamp-2 min-w-0 text-sm leading-tight font-semibold group-data-[collapsible=icon]:hidden">
                {title}
              </span>
            </Link>
          )}
        </SidebarHeader>
        <SidebarContent className="pt-2">
          {groups.map((g, gi) => (
            <SidebarGroup key={g.label ?? gi}>
              {g.label && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                          <Link href={item.href}>
                            <Icon aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.badge !== undefined && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          {/* Sur mobile, seul moyen d'ouvrir le menu. */}
          <SidebarTrigger className="-ml-1 md:hidden" aria-label="Ouvrir le menu" />
          <div className="flex-1" />
          {headerEnd}
          <HeaderTools {...tools} />
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden min-w-0 max-w-48 lg:block">
                <span className="block truncate text-sm leading-tight font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted-foreground lg:block" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOut aria-hidden />
                    Se déconnecter
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
