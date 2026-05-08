import { useEffect, useState } from "react";
import { useToast } from "../../components/shared/Toast";
import { api } from "../../utils/api";
import ConfirmModal from "../../components/shared/ConfirmModal";
import Skeleton from "../../components/shared/Skeleton";
import arabBankLogo from "../../assets/arab-bank.jpg";
import reflectLogo from "../../assets/reflect.jpg";
import bopLogo from "../../assets/bank-of-palestine.png";

const BANKS = [
  {
    id: "REFLECT",
    name: "محفظة ريفلكت",
    logo: reflectLogo,
    accountLabel: "رقم الجوال",
    accountPlaceholder: "0599123456",
    accountHelp: "رقم الجوال المرتبط بالمحفظة (10 أرقام يبدأ بـ 05)",
    pattern: /^05\d{8}$/,
    maxLength: 10,
    invalidMessage: "رقم الجوال يجب أن يبدأ بـ 05 ويتكوّن من 10 أرقام",
    uppercase: false,
  },
  {
    id: "ARAB_BANK",
    name: "البنك العربي",
    logo: arabBankLogo,
    accountLabel: "رقم الحساب (IBAN)",
    accountPlaceholder: "PS00ARAB000000000000000000000",
    accountHelp: "يبدأ بـ PS ثم رقمين ثم ARAB ثم 21 رقماً (29 خانة)",
    pattern: /^PS\d{2}ARAB\d{21}$/,
    maxLength: 29,
    invalidMessage: "صيغة IBAN غير صحيحة. مثال: PS00ARAB...",
    uppercase: true,
  },
  {
    id: "BANK_OF_PALESTINE",
    name: "بنك فلسطين",
    logo: bopLogo,
    accountLabel: "رقم الحساب (IBAN)",
    accountPlaceholder: "PS00PALS000000000000000000000",
    accountHelp: "يبدأ بـ PS ثم رقمين ثم PALS ثم 21 رقماً (29 خانة)",
    pattern: /^PS\d{2}PALS\d{21}$/,
    maxLength: 29,
    invalidMessage: "صيغة IBAN غير صحيحة. مثال: PS00PALS...",
    uppercase: true,
  },
];

function findBankByName(name) {
  return BANKS.find((b) => b.name === name);
}

export default function BankAccount() {
  const toast = useToast();
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [form, setForm] = useState({
    bankAccountHolder: "",
    bankAccountNumber: "",
    confirmAccountNumber: "",
  });
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, action: null, title: '', message: '' });

  const selectedBank = BANKS.find((b) => b.id === selectedBankId);

  useEffect(() => {
    api.withdrawals
      .getBankAccount()
      .then((res) => {
        const ba = res.bankAccount;
        if (ba?.bankName) {
          setHasBankAccount(true);
          const matched = findBankByName(ba.bankName);
          if (matched) setSelectedBankId(matched.id);
          setForm({
            bankAccountHolder: ba.bankAccountHolder || "",
            bankAccountNumber: ba.bankAccountNumber || "",
            confirmAccountNumber: ba.bankAccountNumber || "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSelectBank(id) {
    if (id === selectedBankId) return;
    setSelectedBankId(id);
    setError(null);
    setSuccess(null);
    setForm((f) => ({ ...f, bankAccountNumber: "", confirmAccountNumber: "" }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    let next = value;
    if (
      (name === "bankAccountNumber" || name === "confirmAccountNumber") &&
      selectedBank
    ) {
      if (selectedBank.id === "REFLECT") next = next.replace(/\D/g, "");
      if (selectedBank.uppercase) next = next.toUpperCase();
      if (selectedBank.maxLength) next = next.slice(0, selectedBank.maxLength);
    }
    setForm({ ...form, [name]: next });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedBank) {
      setError("يرجى اختيار البنك أو المحفظة أولاً");
      return;
    }
    if (!selectedBank.pattern.test(form.bankAccountNumber)) {
      setError(selectedBank.invalidMessage);
      return;
    }
    if (form.bankAccountNumber !== form.confirmAccountNumber) {
      setError("الرقمان غير متطابقين. أعد إدخالهما");
      return;
    }

    setSaving(true);
    try {
      await api.withdrawals.saveBankAccount({
        bankName: selectedBank.name,
        bankAccountHolder: form.bankAccountHolder,
        bankAccountNumber: form.bankAccountNumber,
        confirmAccountNumber: form.confirmAccountNumber,
      });
      setHasBankAccount(true);
      setSuccess("تم حفظ بيانات الحساب بنجاح");
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    setConfirmState({
      open: true,
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف الحساب البنكي؟',
      action: async () => {
        setDeleting(true);
        setError(null);
        setSuccess(null);
        setConfirmState((s) => ({ ...s, open: false }));
        try {
          await api.withdrawals.deleteBankAccount();
          setHasBankAccount(false);
          setSelectedBankId(null);
          setForm({
            bankAccountHolder: "",
            bankAccountNumber: "",
            confirmAccountNumber: "",
          });
          setSuccess("تم حذف الحساب البنكي بنجاح");
        } catch (err) {
          setError(err.message);
        } finally {
          setDeleting(false);
        }
      },
    });
  }

  if (loading) return <div style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}><Skeleton height={20} width="60%" /><div style={{ height: 12 }} /><Skeleton height={16} count={4} /></div>;

  return (
    <>
      <div className="owner-section-hero owner-bank-hero">
        <div className="owner-bank-hero-copy">
          <h1 className="owner-page-title owner-section-hero-title">
            الحساب البنكي
          </h1>
        </div>

        {hasBankAccount && (
          <button
            className="owner-btn owner-bank-delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "جاري الحذف..." : "حذف الحساب"}
          </button>
        )}
      </div>

      <div className="owner-bank-shell">
        <div className="owner-card owner-bank-unified-card">
          <div className="owner-card-header owner-bank-selector-header">
            <h2 className="owner-card-title">اختر البنك أو المحفظة</h2>
          </div>

          <div className="owner-bank-options">
            {BANKS.map((bank) => {
              const active = selectedBankId === bank.id;
              return (
                <button
                  type="button"
                  key={bank.id}
                  className={`owner-bank-option${active ? " active" : ""}`}
                  onClick={() => handleSelectBank(bank.id)}
                >
                  <img
                    src={bank.logo}
                    alt={bank.name}
                    className="owner-bank-logo"
                  />
                  <div className="owner-bank-option-text">
                    <div className="owner-bank-option-name">{bank.name}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedBank && (
            <>
              <div className="owner-card-header owner-bank-form-header">
                <h2 className="owner-card-title">
                  {hasBankAccount
                    ? "تعديل بيانات الحساب"
                    : "إضافة بيانات الحساب"}
                </h2>
              </div>

              <div className="owner-bank-form-body">
                {error && <div className="owner-form-error">{error}</div>}
                {success && <div className="owner-form-success">{success}</div>}

                <form onSubmit={handleSave} className="owner-bank-form">
                  <div className="owner-form-group">
                    <label className="owner-form-label">اسم صاحب الحساب</label>
                    <input
                      className="owner-form-input"
                      name="bankAccountHolder"
                      value={form.bankAccountHolder}
                      onChange={handleChange}
                      placeholder="الاسم كما هو في البطاقة"
                      required
                    />
                  </div>

                  <div className="owner-form-group">
                    <label className="owner-form-label">
                      {selectedBank.accountLabel}
                    </label>
                    <input
                      className="owner-form-input"
                      name="bankAccountNumber"
                      value={form.bankAccountNumber}
                      onChange={handleChange}
                      placeholder={selectedBank.accountPlaceholder}
                      inputMode={
                        selectedBank.id === "REFLECT" ? "numeric" : "text"
                      }
                      dir="ltr"
                      required
                    />
                    <p className="owner-form-help">{selectedBank.accountHelp}</p>
                  </div>

                  <div className="owner-form-group">
                    <label className="owner-form-label">
                      تأكيد {selectedBank.accountLabel}
                    </label>
                    <input
                      className="owner-form-input"
                      name="confirmAccountNumber"
                      value={form.confirmAccountNumber}
                      onChange={handleChange}
                      placeholder="أعد إدخاله"
                      inputMode={
                        selectedBank.id === "REFLECT" ? "numeric" : "text"
                      }
                      dir="ltr"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="owner-btn owner-btn-primary owner-bank-form-submit"
                    disabled={saving}
                  >
                    {saving ? "جاري الحفظ..." : "حفظ البيانات"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="تأكيد"
        variant="danger"
        onConfirm={async () => { await confirmState.action?.(); }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
