import React, { useState, useEffect } from 'react';
// API client removed
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2, Building } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';
import { initialBranches } from './Branches';

const cls = "block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-primary sm:text-sm dark:bg-slate-900 dark:text-white dark:ring-slate-700";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

export function Organizations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [tenants, setTenants] = useState([
    { id: 1, organization: 'Acme Corp' },
    { id: 2, organization: 'Stark Industries' },
    { id: 3, organization: 'Wayne Enterprises' }
  ]);
  // Using dummy data for Organizations to separate it from the Tenants API,
  // but we still fetch tenants to show in the "Linked Tenant" dropdown.
  const [data, setData] = useState([
    {
      id: 1,
      name: "Acme North America",
      tenantId: "Acme Corp", // Simplified for UI demo
      owner: "John Doe",
      users: 120,
      branches: 4,
      status: "Active"
    },
    {
      id: 2,
      name: "Stark R&D Labs",
      tenantId: "Stark Industries",
      owner: "Tony Stark",
      users: 45,
      branches: 2,
      status: "Active"
    },
    {
      id: 3,
      name: "Wayne Logistics",
      tenantId: "Wayne Enterprises",
      owner: "Bruce Wayne",
      users: 300,
      branches: 12,
      status: "Active"
    }
  ]);

  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', tenantId: '', owner: '', users: '', branches: '', status: 'Active' });

  // fetch logic removed

  const handleOpenDrawer = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormData({
        name: row.name,
        tenantId: row.tenantId,
        owner: row.owner,
        users: row.users,
        branches: row.branches,
        status: row.status
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', tenantId: '', owner: '', users: '', branches: '', status: 'Active' });
    }
    setIsDrawerOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      setData(data.map(d => d.id === editingId ? { ...d, ...formData } : d));
    } else {
      setData([{ ...formData, id: Date.now() }, ...data]);
    }
    setIsDrawerOpen(false);
  };

  const handleDelete = (id) => {
    setData(data.filter(d => d.id !== id));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.tenantId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <UniversalCRUDLayout
      title="Organizations (Subsidiaries)"
      description="Manage child organizations/subsidiaries under your main Tenants."
      toolbarActions={
        <Button onClick={() => handleOpenDrawer()}>
          <Plus className="mr-2 h-4 w-4" /> Add Subsidiary
        </Button>
      }
      searchProps={{
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        placeholder: "Search subsidiary or tenant..."
      }}
      hasData={filteredData.length > 0}
      table={
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 dark:text-white text-slate-900">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Organization Name</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Linked Tenant</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Owner</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Total Users</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Branches</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Status</th>
              <th className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-transparent">
            {filteredData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    {row.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {row.tenantId}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.owner}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.users}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.branches}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.status === 'Active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => handleOpenDrawer(row)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800 transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Organizations" value={data.length.toString()} icon="Building2" trend={`+${data.filter(o => o.status === 'Active').length} active`} color="blue" />
        <StatCard title="Total Branches" value={data.reduce((sum, o) => sum + (parseInt(o.branches) || 0), 0).toString()} icon="MapPin" trend={`across ${data.length} orgs`} color="green" />
        <StatCard title="Total Users" value={data.reduce((sum, o) => sum + (parseInt(o.users) || 0), 0).toLocaleString()} icon="Briefcase" trend={`in ${data.length} orgs`} color="purple" />
        <StatCard title="Active Organizations" value={data.filter(o => o.status === 'Active').length.toString()} icon="Users" trend={`${data.filter(o => o.status !== 'Active').length} inactive`} color="orange" />
      </div>
    </UniversalCRUDLayout>

    <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Organization" : "Add Subsidiary Organization"}>
      <div className="space-y-4 mt-4">
        <div>
          <label className={labelCls}>Organization Name</label>
          <input name="name" value={formData.name} onChange={handleChange} type="text" className={cls} placeholder="e.g. Acme North America" />
        </div>
        
        <div>
          <label className={labelCls}>Linked Tenant <span className="text-xs text-slate-400 font-normal ml-2">(Parent Company)</span></label>
          <select name="tenantId" value={formData.tenantId} onChange={handleChange} className={cls}>
            <option value="">Select Parent Tenant...</option>
            {tenants.map(t => (
              <option key={t.id} value={t.organization}>{t.organization}</option>
            ))}
          </select>
          {tenants.length === 0 && <p className="text-xs text-amber-500 mt-1">Fetching tenants...</p>}
        </div>

        <div>
          <label className={labelCls}>Owner / CEO</label>
          <input name="owner" value={formData.owner} onChange={handleChange} type="text" className={cls} placeholder="Enter Owner name..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Total Users</label>
            <input name="users" value={formData.users} onChange={handleChange} type="number" className={cls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Branch</label>
            <select name="branches" value={formData.branches} onChange={handleChange} className={cls}>
              <option value="">Select Branch...</option>
              {initialBranches.map(b => (
                <option key={b.id} value={b.c1}>{b.c1}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={cls}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="pt-4 flex justify-end space-x-2 border-t dark:border-slate-700 mt-6">
          <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
    </>
  );
}
