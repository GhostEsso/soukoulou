"use client";

import { Bell, CalendarDays, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Notice {
  id: string;
  title: string;
  detail?: string;
  /** Déjà formaté côté serveur (« il y a 3 min »). */
  time?: string;
  href: string;
  unread?: boolean;
}

export interface HeaderToolsProps {
  /** Date du jour, formatée côté serveur pour éviter un écart d'hydratation. */
  today: string;
  notices: Notice[];
  noticesHref?: string;
  /** Absent tant que la messagerie n'existe pas : l'icône l'indique. */
  messagesHref?: string;
  unreadMessages?: number;
}

const Dot = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
      {count > 9 ? "9+" : count}
    </span>
  ) : null;

export function HeaderTools({ today, notices, noticesHref, messagesHref, unreadMessages = 0 }: HeaderToolsProps) {
  const [open, setOpen] = useState(false);
  const unread = notices.filter((n) => n.unread).length;

  return (
    <div className="flex items-center gap-1">
      <p className="mr-2 hidden items-center gap-2 text-sm text-muted-foreground md:flex">
        <CalendarDays className="size-4" aria-hidden />
        <span className="first-letter:uppercase">{today}</span>
      </p>

      {messagesHref ? (
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href={messagesHref} aria-label={`Messagerie${unreadMessages ? `, ${unreadMessages} non lus` : ""}`}>
            <MessageSquare aria-hidden />
            <Dot count={unreadMessages} />
          </Link>
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Messagerie : bientôt disponible" aria-disabled className="text-muted-foreground">
              <MessageSquare aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Messagerie : bientôt disponible</TooltipContent>
        </Tooltip>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`}>
            <Bell aria-hidden />
            <Dot count={unread} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <span className="text-xs text-muted-foreground">{unread} non lue{unread > 1 ? "s" : ""}</span>}
          </div>
          {notices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">Rien de nouveau pour l’instant.</p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex gap-3 px-4 py-3 text-sm hover:bg-muted/60", n.unread && "bg-accent/40")}
                  >
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{n.title}</span>
                      {n.detail && <span className="block text-muted-foreground">{n.detail}</span>}
                      {n.time && <span className="block text-xs text-muted-foreground">{n.time}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {noticesHref && notices.length > 0 && (
            <Link
              href={noticesHref}
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted/60"
            >
              Tout voir
            </Link>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
