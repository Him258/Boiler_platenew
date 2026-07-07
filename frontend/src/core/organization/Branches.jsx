import React, { useState, useEffect } from 'react';
// API client removed
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';

export const initialBranches = [
  { id: 1, c1: 'HQ', c2: 'Acme Corp', c3: 'Jane Doe', c4: '150', c5: 'New York', c6: 'Active' },
  { id: 2, c1: 'West Coast', c2: 'Acme Corp', c3: 'John Smith', c4: '45', c5: 'San Francisco', c6: 'Active' },
  { id: 3, c1: 'Main Branch', c2: 'Stark Industries', c3: 'Tony Stark', c4: '2000', c5: 'Los Angeles', c6: 'Active' }
];

export function Branches() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [data, setData] = useState(initialBranches);
  const [organizations, setOrganizations] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ c1: '', c2: '', c3: '', c4: '', c5: '', c6: '' });

  const [tenants, setTenants] = useState([
    { id: 1, organization: 'Acme Corp' },
    { id: 2, organization: 'Stark Industries' }
  ]);

  const fetchOrganizations = async () => {
    try {
      setOrganizations(tenants);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBranches = async () => {
    // Local data is already set in state
  };

  useEffect(() => {
    fetchBranches();
    fetchOrganizations();
  }, []);


  const handleOpenDrawer = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormData(row);
    } else {
      setEditingId(null);
      setFormData({ c1: '', c2: '', c3: '', c4: '', c5: '', c6: '' });
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
    
    // Mutate the exported array to persist data across page navigations (Mock Frontend DB)
    initialBranches.length = 0;
    initialBranches.push(...newData);
    
    setIsDrawerOpen(false);
  };

  const handleDelete = (id) => {
    const newData = data.filter(d => d.id !== id);
    setData(newData);
    
    // Mutate the exported array to persist data
    initialBranches.length = 0;
    initialBranches.push(...newData);
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
      title="Branches"
      description="Manage physical branches and office locations."
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
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Branch Name</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Linked Tenant</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Manager</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Employees</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">City</th>
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
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.c6 === 'Active' || row.c6 === 'Success' || row.c6 === 'Trusted' || row.c6 === 'Indexed' || row.c6 === 'Published'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : row.c6 === 'Expired' || row.c6 === 'Failed' || row.c6 === 'Blocked' || row.c6 === 'Suspended' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {row.c6}
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
      
    </UniversalCRUDLayout>
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Record" : "Add Record"}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Branch Name</label>
            <input name="c1" value={formData.c1} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Branch Name..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Linked Tenant <span className="text-xs text-slate-400 font-normal ml-2">(Which company does this branch belong to?)</span></label>
            <select name="c2" value={formData.c2} onChange={handleChange} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
              <option value="">Select Tenant</option>
              {organizations.map(org => (
                <option key={org.id} value={org.organization}>{org.organization}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Manager</label>
            <input name="c3" value={formData.c3} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Manager..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employees</label>
            <input name="c4" value={formData.c4} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Employees..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City</label>
            <input name="c5" value={formData.c5} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter City..." />
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
