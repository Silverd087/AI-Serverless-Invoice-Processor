import { useState, useEffect, useCallback } from "react";
import type { NavigateFn } from "../App";
import StatusBadge from "../components/StatusBadge";
import Skeleton from "../components/Skeleton";
import "./InvoiceDetail.css";
import { type Schema } from "../../amplify/data/resource";
import { signedGet } from "../lib/signedRequest";

interface InvoiceDetailProps {
  invoiceId: string;
  navigate: NavigateFn;
}

type Invoice = Schema["Invoice"]["type"];


export default function InvoiceDetail({ invoiceId, navigate }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await signedGet(`/invoices/${invoiceId}`);
      const data = await response.json();
      setInvoice(data);

      if (!data.pdfUrl) {
        console.log("Error fetching presigned url")
      }
      setPdfUrl(data.pdfUrl);

    } catch (err) {
      console.error("Failed to fetch invoice:", err);
      setError("Failed to load invoice details.");
      setInvoice(DEMO_DETAIL);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  return (
    <div className="detail-page fade-up">
      <div className="detail-topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          <span className="back-btn-arrow">←</span>
          Back to Invoices
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 24 }}>
          ⚠ {error} (showing demo data)
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card header-card">
            <div className="header-card-top">
              <div>
                {loading
                  ? <Skeleton width={180} height={32} />
                  : <h1 className="detail-title">{invoice?.vendor ?? "Unknown Vendor"}</h1>}
                {loading
                  ? <Skeleton width={120} height={16} style={{ marginTop: 6 }} />
                  : <span className="detail-invoice-id">#{invoice?.id}</span>}
              </div>
              {loading
                ? <Skeleton width={90} height={26} />
                : <StatusBadge status={invoice?.status ?? "unknown"} />}
            </div>

            <div className="metrics-strip">
              <Metric
                label="Amount"
                value={invoice?.amount != null
                  ? `$${Number(invoice.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "—"}
                loading={loading}
                highlight
              />
              <Metric label="Invoice Date" value={formatDate(invoice?.date)} loading={loading} />
              <Metric label="Due Date" value={formatDate(invoice?.due_date)} loading={loading} />
              <Metric label="Currency" value={invoice?.currency ?? "USD"} loading={loading} />
            </div>
          </div>

          {(loading || (invoice?.line_items?.length ?? 0) > 0) && (
            <div className="detail-card">
              <h2 className="card-section-title">Line Items</h2>
              {loading ? (
                <div className="line-items-skeleton">
                  {[1, 2, 3].map((i) => <Skeleton key={i} height={44} style={{ marginBottom: 8 }} />)}
                </div>
              ) : (
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice?.line_items ?? []).map((item, i) => {
                      if (!item) return null;
                      return (
                        <tr key={i}>
                          <td>{item.description ?? "—"}</td>
                          <td className="mono">{item.quantity ?? "—"}</td>
                          <td className="mono">
                            {item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "—"}
                          </td>
                          <td className="mono" style={{ fontWeight: 600 }}>
                            {item.total != null ? `$${Number(item.total).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>
                        Total
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                        ${Number(invoice?.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          <div className="detail-card">
            <h2 className="card-section-title">Extracted Data</h2>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : (
              <div className="fields-grid">
                <Field label="Invoice Number" value={invoice?.invoice_number} />
                <Field label="PO Number" value={invoice?.po_number} />
                <Field label="Tax Amount" value={invoice?.tax_amount != null ? `$${Number(invoice.tax_amount).toFixed(2)}` : undefined} />
                <Field label="Subtotal" value={invoice?.subtotal != null ? `$${Number(invoice.subtotal).toFixed(2)}` : undefined} />
                <Field label="Payment Terms" value={invoice?.payment_terms} />
                <Field label="Notes" value={invoice?.notes} wide />
              </div>
            )}
          </div>
        </div>

        <div className="detail-sidebar">
          <div className="detail-card">
            <h2 className="card-section-title">Processing</h2>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : (
              <div className="fields-grid">
                <Field label="Processed At" value={formatDateTime(invoice?.processed_at)} />
                <Field label="Uploaded At" value={formatDateTime(invoice?.uploaded_at)} />
                <Field label="Confidence Score" value={invoice?.confidence != null ? `${Math.round(invoice.confidence * 100)}%` : undefined} />
                <Field label="Source File" value={invoice?.filename} mono />
              </div>
            )}
          </div>

          <div className="detail-card">
            <h2 className="card-section-title">Vendor</h2>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={36} />)}
              </div>
            ) : (
              <div className="fields-grid">
                <Field label="Name" value={invoice?.vendor} />
                <Field label="Address" value={invoice?.vendor_address} wide />
                <Field label="Email" value={invoice?.vendor_email} />
                <Field label="Phone" value={invoice?.vendor_phone} />
              </div>
            )}
          </div>

          {(pdfUrl || loading) && (
            <div className="detail-card file-card">
              <h2 className="card-section-title">Source File</h2>
              {loading ? (
                <Skeleton height={44} />
              ) : (
                <a
                  href={pdfUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="file-download-btn"
                >
                  <span className="file-icon">📄</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {invoice?.filename ?? "invoice.pdf"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Open original file ↗
                    </div>
                  </div>
                </a>
              )}
            </div>
          )}

          {!loading && invoice && <RawJson invoice={invoice} />}
        </div>
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string | null | undefined;
  loading: boolean;
  highlight?: boolean;
}

function Metric({ label, value, loading, highlight = false }: MetricProps) {
  return (
    <div className={`metric ${highlight ? "highlight" : ""}`}>
      <div className="metric-label">{label}</div>
      {loading
        ? <Skeleton width={80} height={22} />
        : <div className="metric-value">{value ?? "—"}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | number | undefined | null;
  mono?: boolean;
  wide?: boolean;
}

function Field({ label, value, mono = false, wide = false }: FieldProps) {
  return (
    <div className={`field-row ${wide ? "wide" : ""}`}>
      <span className="field-label">{label}</span>
      <span className={`field-value ${mono ? "mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

interface RawJsonProps {
  invoice: Invoice;
}

function RawJson({ invoice }: RawJsonProps) {
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="detail-card raw-json-card">
      <button className="raw-json-toggle" onClick={() => setOpen((o) => !o)}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{"{ }"}</span>
        Raw JSON
        <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="raw-json-body">
          {JSON.stringify(invoice, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatDate(str: string | undefined | null): string | null {
  if (!str) return null;
  return new Date(str).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function formatDateTime(str: string | undefined | null): string | null {
  if (!str) return null;
  return new Date(str).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const DEMO_DETAIL: Invoice = {
  id: "INV-2024-001",
  vendor: "Acme Corp",
  vendor_address: "123 Business Ave, San Francisco CA 94105",
  vendor_email: "billing@acme.com",
  vendor_phone: "+1 (415) 555-0100",
  date: "2024-12-01",
  due_date: "2024-12-31",
  invoice_number: "ACM-9921",
  po_number: "PO-2024-0087",
  amount: 4250.00,
  subtotal: 3982.08,
  tax_amount: 267.92,
  currency: "USD",
  payment_terms: "Net 30",
  status: "COMPLETED",
  confidence: 0.97,
  filename: "acme-invoice-dec-2024.pdf",
  uploaded_at: "2024-12-01T09:15:00Z",
  processed_at: "2024-12-01T09:15:42Z",
  notes: "Annual maintenance contract Q4 2024",
  line_items: [
    { description: "Enterprise License Renewal", quantity: 1, unit_price: 3000.00, total: 3000.00 },
    { description: "Support Hours", quantity: 8, unit_price: 95.26, total: 762.08 },
    { description: "Expedited Processing Fee", quantity: 1, unit_price: 220.00, total: 220.00 },
  ],
  createdAt: "2024-12-01T09:15:00Z",
  updatedAt: "2024-12-01T09:15:42Z",
};
