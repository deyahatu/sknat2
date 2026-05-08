import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../utils/api";
import Skeleton from "../../components/shared/Skeleton";

const NUMBER_KEY_ALLOWLIST = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

function blockNonDigits(e) {
  if (NUMBER_KEY_ALLOWLIST.includes(e.key)) return;
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === "." && !e.currentTarget.value.includes(".")) return;
  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
}

function sanitizePaste(e) {
  const pasted = (e.clipboardData || window.clipboardData).getData("text");
  if (!/^\d*\.?\d*$/.test(pasted)) e.preventDefault();
}

const STATUS_MAP = {
  PENDING: { label: "قيد الانتظار", cls: "pending" },
  APPROVED: { label: "موافق عليه", cls: "approved" },
  REJECTED: { label: "مرفوض", cls: "rejected" },
  COMPLETED: { label: "مكتمل", cls: "completed" },
};

const STATUS_FILTERS = [
  { value: "", label: "الكل" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "APPROVED", label: "موافق عليه" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "COMPLETED", label: "مكتمل" },
];

export default function Withdrawals() {
  const [balance, setBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasBankAccount, setHasBankAccount] = useState(true);

  async function load(status) {
    setLoading(true);
    try {
      const [histRes, bankRes] = await Promise.all([
        api.withdrawals.history(status),
        api.withdrawals.getBankAccount(),
      ]);
      setBalance(Number(histRes.wallet?.balance || 0));
      setLockedBalance(Number(histRes.wallet?.lockedBalance || 0));
      setAvailableBalance(Number(histRes.wallet?.availableBalance || 0));
      setRequests(histRes.requests || []);
      const ba = bankRes.bankAccount;
      setHasBankAccount(!!ba?.bankName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function handleRequest(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.withdrawals.request(Number(amount));
      setAmount("");
      setSuccess("تم تقديم طلب السحب بنجاح. بانتظار موافقة الإدارة.");
      await load(filter);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="owner-section-hero owner-withdrawals-hero">
        <div className="owner-withdrawals-hero-copy">
          <h1 className="owner-page-title owner-section-hero-title">
            طلبات السحب
          </h1>
        </div>

        <div className="owner-withdrawals-hero-side">
          <div className="owner-withdrawals-hero-balance">
            <span className="owner-withdrawals-hero-balance-label">
              الرصيد المتاح للسحب
            </span>
            <strong className="owner-withdrawals-hero-balance-value">
              {availableBalance.toFixed(2)} شيكل
            </strong>
          </div>
        </div>
      </div>

      {(lockedBalance > 0 || balance !== availableBalance) && (
        <div className="owner-withdrawals-balance-breakdown">
          <div className="owner-withdrawals-balance-row">
            <span>الرصيد الكلي</span>
            <strong>{balance.toFixed(2)} شيكل</strong>
          </div>
          <div className="owner-withdrawals-balance-row locked">
            <span>
              مقفول مؤقتاً
              <small> (دفعات حديثة خلال فترة الاسترداد - 7 أيام)</small>
            </span>
            <strong>{lockedBalance.toFixed(2)} شيكل</strong>
          </div>
          <div className="owner-withdrawals-balance-row available">
            <span>المتاح للسحب الآن</span>
            <strong>{availableBalance.toFixed(2)} شيكل</strong>
          </div>
        </div>
      )}

      {!hasBankAccount && (
        <div className="owner-withdrawals-page-alert">
          <span>يجب إضافة حساب بنكي أولًا قبل تقديم أي طلب سحب.</span>
          <Link
            to="/owner/bank-account"
            className="owner-withdrawals-page-alert-btn"
          >
            إضافة حساب بنكي
          </Link>
        </div>
      )}

      <div className="owner-withdrawals-request-shell">
        <div className="owner-card owner-withdrawals-request-card">
          <div className="owner-card-header owner-withdrawals-request-header">
            <div>
              <h2 className="owner-card-title">طلب سحب جديد</h2>
            </div>
          </div>

          <div className="owner-withdrawals-request-body">
            {error && <div className="owner-form-error">{error}</div>}
            {success && <div className="owner-form-success">{success}</div>}

            <form onSubmit={handleRequest} className="owner-withdrawals-form">
              <div className="owner-form-group">
                <label className="owner-form-label">المبلغ</label>
                <input
                  aria-label="مبلغ السحب"
                  className="owner-form-input owner-withdrawals-input"
                  type="number"
                  min="10"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={blockNonDigits}
                  onPaste={sanitizePaste}
                  inputMode="decimal"
                  placeholder="أدخل المبلغ المطلوب سحبه"
                  required
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                className="owner-btn owner-withdrawals-submit-btn"
                disabled={submitting || !hasBankAccount}
              >
                {submitting ? "جاري الإرسال..." : "تقديم طلب السحب"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="owner-card owner-withdrawals-history-card">
        <div className="owner-withdrawals-history-head">
          <div className="owner-withdrawals-history-top">
            <h2 className="owner-card-title owner-withdrawals-history-title">
              سجل الطلبات
            </h2>

            <div className="owner-filter-bar owner-withdrawals-filter-bar">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`owner-filter-btn${
                    filter === f.value ? " active" : ""
                  }`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="owner-table-wrap owner-withdrawals-table-wrap">
          {loading ? (
            <div style={{ padding: 20 }}><Skeleton height={40} /><div style={{ height: 16 }} /><Skeleton height={20} count={5} /></div>
          ) : requests.length === 0 ? (
            <div className="owner-empty">لا توجد طلبات سحب</div>
          ) : (
            <table className="owner-table owner-withdrawals-table">
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>البنك</th>
                  <th>رقم الحساب</th>
                  <th>الحالة</th>
                  <th>سبب الرفض</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const st = STATUS_MAP[r.status] || {
                    label: r.status,
                    cls: "pending",
                  };

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="owner-withdrawal-amount">
                          {Number(r.amount).toFixed(2)}
                          <span>شيكل</span>
                        </div>
                      </td>
                      <td>{r.bankName || "—"}</td>
                      <td dir="ltr" className="owner-withdrawal-account">
                        {r.bankAccountNumber || "—"}
                      </td>
                      <td>
                        <span className={`owner-badge ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td>{r.rejectionReason || "—"}</td>
                      <td dir="ltr" className="owner-withdrawal-date">
                        {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
