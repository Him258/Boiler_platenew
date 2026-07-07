import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { UniversalCRUDLayout } from '@/components/layout/UniversalCRUDLayout';
import { Drawer } from '@/components/ui/Drawer';
import { StatCard } from '@/components/ui/StatCard';
import { MockChart } from '@/components/ui/MockChart';

export const initialFiles = [
  { "id": 1, "c1": "q3_report.pdf", "c2": "PDF Document", "c3": "2.4 MB", "c4": "Alice Freeman", "c5": "Acme Corp", "c6": "2 mins ago" },
  { "id": 2, "c1": "logo_v2.png", "c2": "Image", "c3": "845 KB", "c4": "Bob Smith", "c5": "Stark Ind.", "c6": "1 hour ago" },
  { "id": 3, "c1": "user_export.csv", "c2": "Spreadsheet", "c3": "12.1 MB", "c4": "System", "c5": "Wayne Ent.", "c6": "Yesterday" },
  { "id": 4, "c1": "onboarding.mp4", "c2": "Video", "c3": "145.0 MB", "c4": "Diana Prince", "c5": "Acme Corp", "c6": "2 days ago" },
  { "id": 5, "c1": "contract_signed.pdf", "c2": "PDF Document", "c3": "1.2 MB", "c4": "Evan Wright", "c5": "Hooli", "c6": "Jan 15, 2026" },
  { "id": 6, "c1": "architecture_diagram.drawio", "c2": "Diagram", "c3": "3.5 MB", "c4": "Tech Lead", "c5": "Wayne Ent.", "c6": "Jan 20, 2026" },
  { "id": 7, "c1": "marketing_assets.zip", "c2": "Archive", "c3": "54.2 MB", "c4": "Marketing Team", "c5": "Stark Ind.", "c6": "Feb 01, 2026" },
  { "id": 8, "c1": "index.js", "c2": "Code", "c3": "45 KB", "c4": "Developer", "c5": "System", "c6": "Feb 15, 2026" }
];

export function Files() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [data, setData] = useState(initialFiles);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ c1: '', c2: '', c3: '', c4: '', c5: '', c6: '' });

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
      newData = data.map(d => d.id === editingId ? { ...formData, id: editingId } : d);
    } else {
      newData = [{ ...formData, id: Date.now() }, ...data];
    }
    setData(newData);
    
    initialFiles.length = 0;
    initialFiles.push(...newData);
    
    setIsDrawerOpen(false);
  };

  const handleDelete = (id) => {
    const newData = data.filter(d => d.id !== id);
    setData(newData);
    
    initialFiles.length = 0;
    initialFiles.push(...newData);
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
      title="File Manager"
      description="Manage uploads, documents, and media assets."
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
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">File Name</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Type</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Size</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Uploaded By</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Tenant</th>
              <th className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-200">Date</th>
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
                    row.c6 === 'Active' || row.c6 === 'Success' || row.c6 === 'Delivered' || row.c6 === 'Indexed' || row.c6 === 'Valid'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : row.c6 === 'Failed' || row.c6 === 'Bounced' || row.c6 === 'Invalid' || row.c6 === 'Timeout' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {row.c6 || 'Active'}
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
        <StatCard title="Total Files" value={data.length.toString()} icon="File" trend="uploaded" color="blue" />
        <StatCard title="Storage Used" value={`${data.reduce((sum, d) => sum + (parseFloat(d.c3) || 0), 0).toFixed(1)} MB`} icon="HardDrive" trend="approximate" color="orange" />
        <StatCard title="Available Space" value="Unlimited" icon="Cloud" trend="SaaS tier" color="green" />
        <StatCard title="Document Types" value={[...new Set(data.map(d => d.c2))].length.toString()} icon="Folder" trend="unique types" color="purple" />
      </div>
    </UniversalCRUDLayout>
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingId ? "Edit Record" : "Add Record"}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File Name</label>
            <input name="c1" value={formData.c1} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter File Name..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
            <input name="c2" value={formData.c2} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Type..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Size</label>
            <input name="c3" value={formData.c3} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Size..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Uploaded By</label>
            <select name="c4" value={formData.c4} onChange={handleChange} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
              <option value="">Select User...</option>
              <option value="Alice Freeman">Alice Freeman</option>
              <option value="Bob Smith">Bob Smith</option>
              <option value="Charlie Davis">Charlie Davis</option>
              <option value="Diana Prince">Diana Prince</option>
              <option value="Evan Wright">Evan Wright</option>
              <option value="Fiona Gallagher">Fiona Gallagher</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tenant</label>
            <select name="c5" value={formData.c5} onChange={handleChange} className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
              <option value="">Select Tenant...</option>
              <option value="Acme Corp">Acme Corp</option>
              <option value="Stark Ind.">Stark Ind.</option>
              <option value="Wayne Ent.">Wayne Ent.</option>
              <option value="Small Biz">Small Biz</option>
              <option value="Cyberdyne">Cyberdyne</option>
              <option value="Hooli">Hooli</option>
              <option value="Initech">Initech</option>
              <option value="Massive Dynamic">Massive Dynamic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
            <input name="c6" value={formData.c6} onChange={handleChange} type="text" className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 dark:bg-slate-900 dark:text-white dark:ring-slate-700" placeholder="Enter Date..." />
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
