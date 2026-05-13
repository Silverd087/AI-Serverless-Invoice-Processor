import { useState, useEffect, useCallback } from "react";
import type { NavigateFn } from "../App";
import StatusBadge from "../components/StatusBadge";
import UploadModal from "../components/UploadModal";
import EmptyState from "../components/EmptyState";
import Skeleton from "../components/Skeleton";
import "./Dashboard.css";
import { type Schema } from "../../amplify/data/resource";
import { signedGet } from "../lib/signedRequest";
import { AuthUser } from "aws-amplify/auth";

const FILTERS = ["All", "COMPLETED", "PROCESSING", "REVIEW", "FAILED"] as const;
type Filter = (typeof FILTERS)[number];
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

interface DashboardProps {
  navigate: NavigateFn;
  user: AuthUser
}

interface Stats {
  total: number;
  processed: number;
  pending: number;
  totalAmount: number;
}
type Invoice = Schema["Invoice"]["type"];


export default function Dashboard({ navigate, user }: DashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("All");
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await signedGet("/invoices");
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.invoices ?? [];
      setInvoices(list);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setError("Failed to load invoices.");
      setInvoices(DEMO_INVOICES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filtered = invoices
    .filter((inv) => {
      const matchSearch =
        inv.vendor?.toLowerCase().includes(search.toLowerCase()) ||
        inv.id?.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "All" ||
        inv.status?.toLowerCase() === filter.toLowerCase();
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.date ?? '').getTime() - new Date(a.date ?? '').getTime();
      if (sortBy === "date_asc") return new Date(a.date ?? '').getTime() - new Date(b.date ?? '').getTime();
      if (sortBy === "amount_desc") return (b.amount ?? 0) - (a.amount ?? 0);
      if (sortBy === "amount_asc") return (a.amount ?? 0) - (b.amount ?? 0);
      return 0;
    });

  const stats: Stats = {
    total: invoices.length,
    processed: invoices.filter((i) => i.status?.toLowerCase() === "completed").length,
    pending: invoices.filter((i) => i.status?.toLowerCase() === "processing").length,
    totalAmount: invoices
      .filter((i) => i.status?.toLowerCase() === "completed")
      .reduce((sum, i) => sum + (i.amount ?? 0), 0),
  };
  return (
    <div className="dashboard fade-up">
      <div className="stats-bar">
        <StatCard label="Total Invoices" value={stats.total} icon="📄" />
        <StatCard label="Processed" value={stats.processed} icon="✓" accent />
        <StatCard label="Pending" value={stats.pending} icon="⏳" />
        <StatCard
          label="Total Processed Value"
          value={`$${stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon="$"
          wide
        />
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="page-title">Invoices</h1>
          <div className="filter-tabs">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`filter-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              type="text"
              placeholder="Search vendor or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")}>✕</button>
            )}
          </div>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount ↓</option>
            <option value="amount_asc">Amount ↑</option>
          </select>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            <span>+</span> New Invoice
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠ {error}
          <button onClick={fetchInvoices}>Retry</button>
        </div>
      )}

      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><Skeleton /></td>
                  ))}
                </tr>
              ))
              : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title={search || filter !== "All" ? "No matches found" : "No invoices yet"}
                        desc={search || filter !== "All"
                          ? "Try adjusting your search or filter."
                          : "Upload your first invoice to get started."}
                        action={!search && filter === "All" ? (
                          <button className="btn-primary" onClick={() => setShowUpload(true)}>
                            + New Invoice
                          </button>
                        ) : undefined}
                      />
                    </td>
                  </tr>
                )
                : filtered.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className="invoice-row"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => navigate("detail", { invoiceId: inv.id })}
                  >
                    <td><span className="invoice-id mono">#{inv.id}</span></td>
                    <td>
                      <div className="vendor-cell">
                        <span className="vendor-avatar">
                          {(inv.vendor ?? "?")[0].toUpperCase()}
                        </span>
                        <span className="vendor-name">{inv.vendor ?? "—"}</span>
                      </div>
                    </td>
                    <td><span className="date-cell">{inv.date ? formatDate(inv.date) : "—"}</span></td>
                    <td>
                      <span className="amount-cell mono">
                        {inv.amount != null
                          ? `$${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </span>
                    </td>
                    <td><StatusBadge status={inv.status ?? "Unknown "} /></td>
                    <td><span className="row-arrow">→</span></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="table-footer">
          Showing {filtered.length} of {invoices.length} invoices
        </div>
      )}

      {showUpload && (
        <UploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            setTimeout(fetchInvoices, 1500);
          }}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
  wide?: boolean;
}

function StatCard({ label, value, icon, accent = false, wide = false }: StatCardProps) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""} ${wide ? "wide" : ""}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DEMO_INVOICES: Invoice[] = [
  { id: "INV-2024-001", vendor: "Acme Corp", date: "2024-12-01", amount: 4250.00, status: "COMPLETED" },
  { id: "INV-2024-002", vendor: "TechSupplies", date: "2024-12-03", amount: 1830.50, status: "PROCESSING" },
  { id: "INV-2024-003", vendor: "CloudPrint Inc", date: "2024-12-05", amount: 990.00, status: "COMPLETED" },
  { id: "INV-2024-004", vendor: "Meridian Labs", date: "2024-12-07", amount: 12400.00, status: "REVIEW" },
  { id: "INV-2024-005", vendor: "Spark Electric", date: "2024-12-09", amount: 670.75, status: "FAILED" },
  { id: "INV-2024-006", vendor: "Nortech Ltd", date: "2024-12-11", amount: 3100.00, status: "COMPLETED" },
  { id: "INV-2024-007", vendor: "Acme Corp", date: "2024-12-14", amount: 5500.00, status: "PROCESSING" },
] as Invoice[];
