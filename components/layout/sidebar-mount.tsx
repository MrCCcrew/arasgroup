"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import type { SessionUser } from "@/lib/types";

interface SidebarMountProps {
  userName?: string;
  session: SessionUser;
  companies: Array<{
    id: string;
    nameAr: string;
    nameEn?: string | null;
    type: string;
  }>;
}

export function SidebarMount(props: SidebarMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <Sidebar {...props} />;
}
