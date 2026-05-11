import React, { useState, useEffect } from 'react';
import { useRole, NON_ADMIN_ROLES, KB_MANAGER_FEATURES_DEFAULT, KB_USER_FEATURES_DEFAULT } from '@/lib/RoleContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, ShieldCheck, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function buildOverridesFromFeatures(features) {
  const result = {};
  features.forEach(f => {
    result[f.path] = { ...f.access };
  });
  return result;
}

function FeatureTable({ title, features, overrides, onChange }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider">{title}</h3>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium w-1/2">Feature</th>
              {NON_ADMIN_ROLES.map(role => (
                <th key={role} className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">{role}</th>
              ))}
              <th className="text-center px-3 py-2.5 text-xs text-muted-foreground font-medium">
                <span className="flex items-center justify-center gap-1"><Lock className="w-3 h-3" />Admin</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f.path} className={`border-b border-border/30 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                <td className="px-4 py-2.5 font-medium text-sm">{f.label}</td>
                {NON_ADMIN_ROLES.map(role => {
                  const current = overrides[f.path]?.[role] ?? f.access[role];
                  return (
                    <td key={role} className="text-center px-3 py-2.5">
                      <div className="flex justify-center">
                        <Switch
                          checked={!!current}
                          onCheckedChange={(val) => onChange(f.path, role, val)}
                        />
                      </div>
                    </td>
                  );
                })}
                {/* Administrator — always locked on */}
                <td className="text-center px-3 py-2.5">
                  <div className="flex justify-center">
                    <Switch checked={true} disabled className="opacity-40" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RolePermissionsEditor() {
  const { kbManagerFeatures, kbUserFeatures, savePermissions, permissionOverrides } = useRole();
  const { toast } = useToast();

  const [overrides, setOverrides] = useState(() =>
    permissionOverrides || {
      ...buildOverridesFromFeatures(kbManagerFeatures),
      ...buildOverridesFromFeatures(kbUserFeatures),
    }
  );

  useEffect(() => {
    if (!permissionOverrides) {
      setOverrides({
        ...buildOverridesFromFeatures(kbManagerFeatures),
        ...buildOverridesFromFeatures(kbUserFeatures),
      });
    }
  }, []);

  const handleChange = (path, role, value) => {
    setOverrides(prev => ({
      ...prev,
      [path]: {
        ...(prev[path] || {}),
        [role]: value,
        Administrator: true,
      },
    }));
  };

  const handleSave = () => {
    savePermissions(overrides);
    toast({ title: 'Permissions saved', description: 'Role feature access has been updated.' });
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Role Permissions
          </CardTitle>
          <Button onClick={handleSave} size="sm" className="gap-1.5 h-8">
            <Save className="w-3.5 h-3.5" />
            Save Permissions
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Configure which features are visible to each role. Administrator always has access to all features.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        <FeatureTable
          title="KB Manager"
          features={KB_MANAGER_FEATURES_DEFAULT}
          overrides={overrides}
          onChange={handleChange}
        />
        <FeatureTable
          title="KB User"
          features={KB_USER_FEATURES_DEFAULT}
          overrides={overrides}
          onChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}