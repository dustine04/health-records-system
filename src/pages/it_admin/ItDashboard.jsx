import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  MapPin,
  RefreshCw,
  Download,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const cards = [
  {
    title: "Total Accounts",
    key: "total",
    icon: Users,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Active Accounts",
    key: "active",
    icon: UserCheck,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Inactive Accounts",
    key: "inactive",
    icon: UserX,
    color: "bg-amber-50 text-amber-700",
  },
  {
    title: "Districts",
    key: "districts",
    icon: Building2,
    color: "bg-violet-50 text-violet-700",
  },
  {
    title: "Barangays",
    key: "barangays",
    icon: MapPin,
    color: "bg-cyan-50 text-cyan-700",
  },
];
export default function ItDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    districts: 0,
    barangays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [total, active, inactive, districts, barangays] = await Promise.all(
        [
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .not("is_active", "is", true),
          supabase
            .from("districts")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("barangays")
            .select("id", { count: "exact", head: true }),
        ],
      );
      for (const result of [total, active, inactive, districts, barangays])
        if (result.error) throw result.error;
      setStats({
        total: total.count ?? 0,
        active: active.count ?? 0,
        inactive: inactive.count ?? 0,
        districts: districts.count ?? 0,
        barangays: barangays.count ?? 0,
      });
    } catch (err) {
      setError(err.message || "Could not load overview");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <DashboardLayout>
      <div className="space-y-7 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              IT Administrator Portal
            </span>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              System Overview
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Account inventory and administrative monitoring. Clinical
              approvals remain with the CHO Administrator.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ title, key, icon: Icon, color }) => (
            <div
              key={key}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <span className={`inline-flex rounded-xl p-3 ${color}`}>
                <Icon size={22} />
              </span>
              <p className="mt-4 text-sm text-slate-500">{title}</p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "…" : stats[key]}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              to: "/dashboard/it-admin/users",
              icon: Users,
              title: "User Management",
              desc: "Browse accounts and their activation status.",
            },
            {
              to: "/dashboard/it-admin/exports",
              icon: Download,
              title: "Data Exports",
              desc: "Export a filtered account directory without passwords.",
            },
            {
              to: "/dashboard/it-admin/audit-logs",
              icon: ScrollText,
              title: "Audit Logs",
              desc: "Review recorded administrative events when configured.",
            },
          ].map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <Icon className="text-slate-700" size={26} />
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-2 text-sm text-slate-500">{desc}</p>
            </Link>
          ))}
        </div>
        <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <ShieldCheck className="shrink-0 text-slate-700" size={20} />
          <p>
            Administrative views are read-only until verified server-side
            authorization and audit logging are implemented. Browser role checks
            alone do not protect health records.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
