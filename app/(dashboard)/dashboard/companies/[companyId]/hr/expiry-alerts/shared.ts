export type AlertCategory = "employee" | "vehicle" | "license";
export type AlertSeverity = "expired" | "critical" | "warning" | "upcoming";

export type ExpiryAlertItem = {
  id: string;
  category: AlertCategory;
  entityId: string;
  title: string;
  subtitle: string;
  expiryType: string;
  expiryDate: string;
  daysLeft: number;
  href: string;
  licenseName?: string;
};

export type ExpiryAlertFilters = {
  search: string;
  category: "all" | AlertCategory;
  status: "all" | AlertSeverity;
  expiryType: string;
  dateFrom: string;
  dateTo: string;
};

export function severityFromDays(days: number): AlertSeverity {
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 60) return "warning";
  return "upcoming";
}

export function buildStats(alerts: ExpiryAlertItem[]) {
  return alerts.reduce(
    (acc, alert) => {
      const level = severityFromDays(alert.daysLeft);
      if (level === "expired") acc.expired += 1;
      else if (level === "critical") acc.in30 += 1;
      else if (level === "warning") acc.in60 += 1;
      else acc.in90 += 1;
      return acc;
    },
    { expired: 0, in30: 0, in60: 0, in90: 0 },
  );
}

export function applyAlertFilters(alerts: ExpiryAlertItem[], filters: ExpiryAlertFilters) {
  const search = filters.search.trim().toLowerCase();
  return alerts.filter((alert) => {
    if (filters.category !== "all" && alert.category !== filters.category) return false;
    if (filters.status !== "all" && severityFromDays(alert.daysLeft) !== filters.status) return false;
    if (filters.expiryType !== "all" && alert.expiryType !== filters.expiryType) return false;

    // Date range filter
    if (filters.dateFrom) {
      const alertDate = new Date(alert.expiryDate);
      const fromDate = new Date(filters.dateFrom);
      if (alertDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const alertDate = new Date(alert.expiryDate);
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      if (alertDate > toDate) return false;
    }

    if (!search) return true;
    const haystack = [alert.title, alert.subtitle, alert.expiryType, alert.category].join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

export function getExpiryTypeOptions(alerts: ExpiryAlertItem[]) {
  return [...new Set(alerts.map((alert) => alert.expiryType))].sort((a, b) => a.localeCompare(b, "ar"));
}

export function filtersFromSearchParams(searchParams: Record<string, string | string[] | undefined>): ExpiryAlertFilters {
  const value = (key: string) => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };

  const category = value("category");
  const status = value("status");

  return {
    search: value("search"),
    category: category === "employee" || category === "vehicle" || category === "license" ? category : "all",
    status:
      status === "expired" || status === "critical" || status === "warning" || status === "upcoming"
        ? status
        : "all",
    expiryType: value("expiryType") || "all",
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
  };
}

export function buildFilterQuery(filters: ExpiryAlertFilters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.expiryType !== "all") params.set("expiryType", filters.expiryType);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}
