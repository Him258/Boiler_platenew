import React, { useState, useEffect } from 'react';
// API client removed
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2, Briefcase } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';
import { initialBranches as branches } from './Branches';

const cls = "block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-primary sm:text-sm dark:bg-slate-900 dark:text-white dark:ring-slate-700";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

export function Departments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [data, setData] = useState([
    { id: 1, name: 'Engineering', branchId: 'HQ', head: 'Alice Smith', employees: 50, budget: '$5M', status: 'Active' },
    { id: 2, name: 'Sales', branchId: 'West Coast', head: 'Bob Jones', employees: 20, budget: '$1M', status: 'Active' }
  ]);
  
  // We will fetch Branches to show in the dropdown for Departments
  
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', branchId: '', head: '', employees: '', budget: '', status: 'Active' });

  // fetch logic removed

  // useEffect removed for local data

  const handleOpenDrawer = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormData(row);
    } else {
      setEditingId(null);
      setFormData({ name: '', branchId: '', head: '', employees: '', budget: '', status: 'Active' });
    }
    setIsDrawerOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: formData.name,
      branchId: formData.branchId,
      head: formData.head,
      employees: formData.employees,
      budget: formData.budget,
      status: formData.status
    };

    if (editingId) {
      setData(data.map(d => d.id === editingId ? { ...d, ...payload } : d));
    } else {
      setData([{ ...payload, id: Date.now() }, ...data]);
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
    (item.branchId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <UniversalCRUDLayout
      title="Departments"
      description="Manage departments within branches."
      toolbarActions={
        <Button onClick={() => handleOpenDrawer()}>
          <Plus className="mr-2 h-4 w-4" /> Add Department
        </Button>
      }
      searchProps={{
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        placeholder: "Search department or branch..."
      }}
      hasData={filteredData.length > 0}
      table={
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 dark:text-white text-slate-900">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Department Name</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Linked Branch</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Head of Department</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Employees</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Budget</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Status</th>
              <th className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-transparent">
            {filteredData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    {row.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {row.branchId ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {row.branchId}
                    </span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.head}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.employees}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.budget}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.status === 'Active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
        <StatCard title="Total Departments" value={data.length.toString()} icon="Briefcase" trend={`+${data.filter(d => d.status === 'Active').length} active`} color="purple" />
        <StatCard title="Active Employees" value={data.reduce((sum, d) => sum + (parseInt(d.employees) || 0), 0).toLocaleString()} icon="Users" trend={`in ${data.length} depts`} color="green" />
        <StatCard title="Total Budget" value={data.length > 0 ? data.map(d => d.budget || '$0').join(', ') : '$0'} icon="DollarSign" trend={`across ${data.length} depts`} color="blue" />
        <StatCard title="Avg Employees/Dept" value={data.length > 0 ? (data.reduce((sum, d) => sum + (parseInt(d.employees) || 0), 0) / data.length).toFixed(1) : '0'} icon="BarChart3" trend={`${data.filter(d => d.status !== 'Active').length} inactive`} color="orange" />
      </div>
    </UniversalCRUDLayout>

    <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Department" : "Add Department"}>
      <div className="space-y-4 mt-4">
        <div>
          <label className={labelCls}>Department Name</label>
          <input name="name" value={formData.name} onChange={handleChange} type="text" className={cls} placeholder="e.g. Engineering, Sales..." />
        </div>
        
        <div>
          <label className={labelCls}>Linked Branch <span className="text-xs text-slate-400 font-normal ml-2">(Parent Branch)</span></label>
          <select name="branchId" value={formData.branchId} onChange={handleChange} className={cls}>
            <option value="">Select Parent Branch...</option>
            {branches.map(b => (
              <option key={b.id} value={b.c1}>{b.c1}</option>
            ))}
          </select>
          {branches.length === 0 && <p className="text-xs text-amber-500 mt-1">⚠ No branches found. Create a branch first.</p>}
        </div>

        <div>
          <label className={labelCls}>Head of Department</label>
          <input name="head" value={formData.head} onChange={handleChange} type="text" className={cls} placeholder="Enter HOD Name..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Employees</label>
            <input name="employees" value={formData.employees} onChange={handleChange} type="number" className={cls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Budget</label>
            <input name="budget" value={formData.budget} onChange={handleChange} type="text" className={cls} placeholder="e.g. $100,000" />
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
