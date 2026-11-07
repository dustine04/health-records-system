import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Download, RefreshCw, ShieldCheck } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { supabase } from "../../lib/supabase";

const roleLabels = { cho_admin:"CHO Administrator", it_admin:"IT Administrator", nurse:"Nurse", midwife:"Midwife", bns:"BNS", bhw:"BHW" };
function csvCell(value) {
  const text = String(value ?? "");
  // Escape CSV formulas, including leading whitespace before the operator.
  const safe = /^\s*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export default function DataExports() {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("users")
        .select("id,username,first_name,middle_name,last_name,role,is_active,district_id,barangay_id,created_at")
        .order("id", { ascending: true }).limit(1000);
      if (queryError) throw queryError;
      setUsers(data || []);
    } catch(e) { setError(e.message || "Unable to load export data"); }
    finally { setLoading(false); }
  }, []);
  useEffect(()=>{load();},[load]);
  const filtered = useMemo(()=>users.filter(u=>(role==="all"||u.role===role)&&(status==="all"||(status==="active"?u.is_active===true:u.is_active!==true))),[users,role,status]);
  const exportCsv = () => {
    const header = ["User ID","Username","Full Name","Role","Status","District ID","Barangay ID","Created At"];
    const rows = filtered.map(u=>[u.id,u.username,[u.first_name,u.middle_name,u.last_name].filter(Boolean).join(" "),u.role,u.is_active?"Active":"Inactive",u.district_id,u.barangay_id,u.created_at]);
    const csv = "\uFEFF"+[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a"); anchor.href=url; anchor.download=`MCHMS_Accounts_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <DashboardLayout><div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">IT Administration</span><h1 className="mt-3 text-3xl font-bold">Data Exports</h1><p className="mt-2 text-sm text-slate-500">Download an account directory without passwords or clinical information.</p></div><button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={17} className={loading?"animate-spin":""}/>Refresh</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Database size={24}/></div><div><h2 className="text-lg font-bold">User Account Directory</h2><p className="text-sm text-slate-500">CSV · user identifiers, names, roles, account status and assignments</p></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Role<select value={role} onChange={e=>setRole(e.target.value)} className="mt-2 w-full rounded-lg border p-3 font-normal"><option value="all">All roles</option>{Object.entries(roleLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-sm font-semibold">Status<select value={status} onChange={e=>setStatus(e.target.value)} className="mt-2 w-full rounded-lg border p-3 font-normal"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
      <p className="mt-4 text-sm text-slate-500">{loading?"Loading…":`${filtered.length} matching accounts (up to 1,000 loaded)`}</p>
      <button onClick={exportCsv} disabled={loading||filtered.length===0} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"><Download size={18}/>Export CSV</button>
    </div>
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><ShieldCheck className="shrink-0" size={20}/><p>Clinical record exports are intentionally unavailable. They require explicit approval, purpose-based authorization, audited server-side exports, and protection of downloaded files. Even this account export should be restricted by backend permissions.</p></div>
  </div></DashboardLayout>;
}
