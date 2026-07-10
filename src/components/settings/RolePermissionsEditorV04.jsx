import React from 'react';
import { useRole, NON_ADMIN_ROLES, KB_MANAGER_V04_FEATURES, KB_USER_V04_FEATURES, KB_API_V04_FEATURES } from '@/lib/RoleContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Lock } from 'lucide-react';

function FeatureTable({ title, features, permissionOverrides, onToggle }) {
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
                  const saved = permissionOverrides?.[f.path];
                  const checked = saved ? !!saved[role] : !!f.access[role];
                  return (
                    <td key={role} className="text-center px-3 py-2.5">
                      <div className="flex justify-center">
                        <Switch
                          checked={checked}
                          onCheckedChange={(val) => onToggle(f.path, role, val, f.access)}
                        />
                      </div>
                    </td>
                  );
                })}
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

export default function RolePermissionsEditorV04() {
  const { permissionOverrides, savePermissions } = useRole();

  const handleToggle = (path, role, value, defaultAccess) => {
    const current = permissionOverrides?.[path] || { ...defaultAccess };
    const updated = {
      ...(permissionOverrides || {}),
      [path]: {
        ...current,
        [role]: value,
        Administrator: true,
      },
    };
    savePermissions(updated);
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Role Permissions
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Toggle features on/off per role. Changes apply immediately. Administrator always has full access.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        <FeatureTable
          title="KB Manager"
          features={KB_MANAGER_V04_FEATURES}
          permissionOverrides={permissionOverrides}
          onToggle={handleToggle}
        />
        <FeatureTable
          title="KB User"
          features={KB_USER_V04_FEATURES}
          permissionOverrides={permissionOverrides}
          onToggle={handleToggle}
        />
        <FeatureTable
          title="KB API"
          features={KB_API_V04_FEATURES}
          permissionOverrides={permissionOverrides}
          onToggle={handleToggle}
        />
      </CardContent>
    </Card>
  );
}