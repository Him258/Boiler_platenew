import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';
import { initialFeatures } from './Features';

const cls = "block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-primary sm:text-sm dark:bg-slate-900 dark:text-white dark:ring-slate-700";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

export const initialPlans = [
  { id: 1, name: "Free Tier", monthlyPrice: 0, annualPrice: 0, subscribers: 12450, features: "Basic Features, 1 User, 1GB Storage", status: "Active" },
  { id: 2, name: "Startup Plan", monthlyPrice: 49, annualPrice: 490, subscribers: 3200, features: "Standard Features, 10 Users, 50GB Storage", status: "Active" },
  { id: 3, name: "Pro Plan", monthlyPrice: 99, annualPrice: 990, subscribers: 1500, features: "Advanced Features, 50 Users, 500GB Storage", status: "Active" },
  { id: 4, name: "Enterprise", monthlyPrice: 499, annualPrice: 4990, subscribers: 410, features: "Unlimited Features, Unlimited Users, 5TB Storage", status: "Active" },
  { id: 5, name: "Legacy V1", monthlyPrice: 29, annualPrice: 290, subscribers: 150, features: "Legacy Features", status: "Archived" },
  { id: 6, name: "Custom Enterprise", monthlyPrice: 1999, annualPrice: 19990, subscribers: 12, features: "Dedicated Support, Custom Limits", status: "Active" }
];

export function Plans() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [data, setData] = useState(initialPlans);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', monthlyPrice: '', annualPrice: '', features: '', status: 'Active' });

  const handleOpenDrawer = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormData({
        name: row.name,
        monthlyPrice: row.monthlyPrice,
        annualPrice: row.annualPrice,
        features: row.features,
        status: row.status
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', monthlyPrice: '', annualPrice: '', features: '', status: 'Active' });
    }
    setIsDrawerOpen(true);
  };

  const handleSave = () => {
    let newData;
    if (editingId) {
      newData = data.map(d => d.id === editingId ? { ...d, ...formData } : d);
    } else {
      newData = [{ ...formData, id: Date.now(), subscribers: 0 }, ...data];
    }
    setData(newData);
    
    initialPlans.length = 0;
    initialPlans.push(...newData);
    
    setIsDrawerOpen(false);
  };

  const handleDelete = (id) => {
    const newData = data.filter(d => d.id !== id);
    setData(newData);
    
    initialPlans.length = 0;
    initialPlans.push(...newData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <UniversalCRUDLayout
        title="Subscription Plans"
        description="Manage SaaS tiers, pricing, and feature limits."
        toolbarActions={
          <Button onClick={() => handleOpenDrawer()}>
            <Plus className="mr-2 h-4 w-4" /> Create Plan
          </Button>
        }
        searchProps={{
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          placeholder: "Search plans..."
        }}
        hasData={filteredData.length > 0}
        table={
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 dark:text-white text-slate-900">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Plan Name</th>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Monthly Price</th>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Annual Price</th>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Features</th>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Subscribers</th>
                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Status</th>
                <th className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-transparent">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-300 font-medium">${row.monthlyPrice}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">${row.annualPrice}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px]" title={row.features}>{row.features}</td>
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-300 font-medium">{row.subscribers.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      row.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
          <StatCard title="Total MRR" value={`$${data.reduce((sum, d) => sum + (Number(d.monthlyPrice) * Number(d.subscribers)), 0).toLocaleString()}`} icon="DollarSign" trend="monthly recurring" color="green" />
          <StatCard title="Active Subscribers" value={data.filter(d => d.status === 'Active').reduce((sum, d) => sum + Number(d.subscribers), 0).toLocaleString()} icon="Users" trend="currently subscribed" color="blue" />
          <StatCard title="Avg Revenue Per User" value={`$${(data.filter(d => d.status === 'Active').reduce((sum, d) => sum + Number(d.subscribers), 0) > 0 ? (data.reduce((sum, d) => sum + (Number(d.monthlyPrice) * Number(d.subscribers)), 0) / data.filter(d => d.status === 'Active').reduce((sum, d) => sum + Number(d.subscribers), 0)) : 0).toFixed(2)}`} icon="TrendingUp" trend="ARPU" color="purple" />
          <StatCard title="Churn Rate" value={`${(data.reduce((sum, d) => sum + Number(d.subscribers), 0) > 0 ? ((data.filter(d => d.status === 'Archived').reduce((sum, d) => sum + Number(d.subscribers), 0) / data.reduce((sum, d) => sum + Number(d.subscribers), 0)) * 100) : 0).toFixed(1)}%`} icon="TrendingDown" trend="archived plans" color="red" />
        </div>
      </UniversalCRUDLayout>

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Plan" : "Create Plan"}>
        <div className="space-y-5 mt-4">
          <div>
            <label className={labelCls}>Plan Name</label>
            <input name="name" value={formData.name} onChange={handleChange} type="text" className={cls} placeholder="e.g. Premium Plan" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Monthly Price ($)</label>
              <input name="monthlyPrice" value={formData.monthlyPrice} onChange={handleChange} type="number" className={cls} placeholder="99" />
            </div>
            <div>
              <label className={labelCls}>Annual Price ($)</label>
              <input name="annualPrice" value={formData.annualPrice} onChange={handleChange} type="number" className={cls} placeholder="990" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Included Features</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Select the features included in this plan</p>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-3 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              {initialFeatures.map(feat => {
                const isSelected = formData.features?.includes(feat.c1);
                return (
                  <label key={feat.id} className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-800"
                      checked={isSelected}
                      onChange={() => {
                        let currentFeatures = formData.features ? formData.features.split(',').map(f => f.trim()).filter(Boolean) : [];
                        if (currentFeatures.includes(feat.c1)) {
                          currentFeatures = currentFeatures.filter(f => f !== feat.c1);
                        } else {
                          currentFeatures.push(feat.c1);
                        }
                        setFormData(prev => ({ ...prev, features: currentFeatures.join(', ') }));
                      }}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{feat.c1}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <select name="status" value={formData.status} onChange={handleChange} className={cls}>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end space-x-2 border-t dark:border-slate-700">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Save Changes' : 'Create Plan'}</Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
