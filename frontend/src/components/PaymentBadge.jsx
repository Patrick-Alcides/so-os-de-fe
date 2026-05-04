const styles = {
  OK: "bg-emerald-100 text-emerald-700",
  "DV 1": "bg-rose-100 text-rose-700",
  "DV 2+": "bg-rose-600 text-white",
};

export default function PaymentBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[status] || styles["DV 1"]}`}>
      {status}
    </span>
  );
}
