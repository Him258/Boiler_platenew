import React, { useState, useEffect } from 'react';
// API client removed for UI-only mode
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';
import { MockChart } from '@/components/ui/MockChart';

export const initialTenants = [
  { id: 1, c1: 'TNT-001', c2: 'Acme Corp', c3: 'Enterprise', c4: '1,200', c5: '50 GB', c6: 'Active' },
  { id: 2, c1: 'TNT-002', c2: 'Stark Industries', c3: 'Pro', c4: '45', c5: '10 GB', c6: 'Active' },
  { id: 3, c1: 'TNT-003', c2: 'Wayne Enterprises', c3: 'Enterprise', c4: '3,400', c5: '120 GB', c6: 'Active' },
  { id: 4, c1: 'TNT-004', c2: 'Globex', c3: 'Basic', c4: '12', c5: '2 GB', c6: 'Suspended' }
];

export function Companies() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [data, setData] = useState(initialTenants);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ c1: '', c2: '', c3: '', c4: '', c5: '', c6: '' });

  // fetchTenants removed as we are using dummy data

  const handleOpenDrawer = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormData(row);
    } else {
      setEditingId(null);
      setFormData({ c1: `TNT-00${data.length + 1}`, c2: '', c3: 'Free', c4: '0', c5: '0 GB', c6: 'Active' });
    }
    setIsDrawerOpen(true);
  };

  const handleSave = () => {
    let newData;
    if (editingId) {
      newData = data.map(d => d.id === editingId ? { ...d, ...formData } : d);
    } else {
      newData = [{ ...formData, id: Date.now() }, ...data];
    }
    setData(newData);
    
    // Persist to global mock state
    initialTenants.length = 0;
    initialTenants.push(...newData);
    
    setIsDrawerOpen(false);
  };

  const handleDelete = (id) => {
    const newData = data.filter(d => d.id !== id);
    setData(newData);
    
    // Persist to global mock state
    initialTenants.length = 0;
    initialTenants.push(...newData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <>
    <UniversalCRUDLayout
      title="Tenants"
      description="Manage all isolated tenants and organizations on the platform."
      toolbarActions={
        <Button onClick={() => handleOpenDrawer()}>
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      }
      searchProps={{
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        placeholder: "Search..."
      }}
      hasData={filteredData.length > 0}
      table={
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 dark:text-white text-slate-900">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Tenant ID</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Tenant Name</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Plan</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Users</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Database Size</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Status</th>
              <th className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-transparent">
            {filteredData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{row.c1}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.c2}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.c3}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.c4}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.c5}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.c6}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.c7 === 'Active' || row.c7 === 'Success' || row.c7 === 'Trusted' || row.c7 === 'Verified' || row.c7 === 'Paid' || row.c7 === 'System' || row.c7 === 'Published' || row.c7 === 'Enabled'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : row.c7 === 'Expired' || row.c7 === 'Failed' || row.c7 === 'Blocked' || row.c7 === 'Suspended' || row.c7 === 'Archived' || row.c7 === 'Disabled'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {row.c7 || row.c6 || row.c5 || 'Active'}
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
        <StatCard title="Total Tenants" value={data.length.toString()} icon="Database" trend={`+${data.filter(t => t.c6 === 'Active').length}`} color="blue" />
        <StatCard title="Active Plans" value={data.filter(t => t.c6 === 'Active').length.toString()} icon="CreditCard" trend={`${data.filter(t => t.c6 === 'Suspended').length} suspended`} color="green" />
        <StatCard title="Enterprise Tenants" value={data.filter(t => t.c3 === 'Enterprise').length.toString()} icon="Globe" trend={`${data.filter(t => t.c3 === 'Pro').length} Pro`} color="purple" />
        <StatCard title="Total Users" value={data.reduce((sum, t) => sum + (parseInt(t.c4) || 0), 0).toLocaleString()} icon="HardDrive" trend={`across ${data.length} tenants`} color="orange" />
      </div>
    </UniversalCRUDLayout>
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Record" : "Add Record"}>
        <div className="space-y-4 mt-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tenant Name</label>
            <input name="c2" value={formData.c2} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Tenant Name..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label>
            <select name="c3" value={formData.c3} onChange={handleChange} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
              <option value="">Select Plan...</option>
              <option value="Free">Free</option>
              <option value="Basic">Basic</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Users</label>
            <input name="c4" value={formData.c4} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Users..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Database Size</label>
            <input name="c5" value={formData.c5} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Database Size..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
            <select name="c6" value={formData.c6} onChange={handleChange} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
