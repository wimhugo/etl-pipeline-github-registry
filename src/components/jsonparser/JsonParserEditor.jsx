import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

export default function JsonParserEditor({ config, onSave, onClose }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    input_type: 'text',
    json_text: '',
    input_file_url: '',
    github_target_folder: '',
    github_target_file: '',
    github_branch: 'main',
    namespace: 'openrel',
    is_active: true,
  });
  const [previewing, setPreviewing] = useState(false);
  const [previewTtl, setPreviewTtl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        name: config.name || '',
        description: config.description || '',
        input_type: config.input_type || 'text',
        json_text: config.json_text || '',
        input_file_url: config.input_file_url || '',
        github_target_folder: config.github_target_folder || '',
        github_target_file: config.github_target_file || '',
        github_branch: config.github_branch || 'main',
        namespace: config.namespace || 'openrel',
        is_active: config.is_active !== false,
      });
    }
  }, [config]);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewTtl('');
    try {
      if (form.input_type === 'file' && !config?.id) {
        toast({ title: 'Preview unavailable', description: 'Save the configuration first to preview URL-based input.' });
        setPreviewing(false);
        return;
      }

      const res = config?.id
        ? await base44.functions.invoke('jsonToTtl', { config_id: config.id, preview: true })
        : await base44.functions.invoke('jsonToTtl', { json_text: form.json_text, preview: true });

      const data = res.data || res;
      if (data.ttl_preview) {
        setPreviewTtl(data.ttl_preview);
      } else {
        toast({ title: 'Preview failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    }
    setPreviewing(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Please provide a name for this configuration.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{config ? 'Edit' : 'New'} JSON Policy Parser</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input
              className="bg-muted/50"
              placeholder="e.g. ODRL Actions to TTL"
              value={form.name}
              onChange={e => update('name', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              className="bg-muted/50"
              placeholder="What this pipeline converts…"
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Input Type</Label>
              <Select value={form.input_type} onValueChange={v => update('input_type', v)}>
                <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Inline JSON Text</SelectItem>
                  <SelectItem value="file">URL (Fetch File)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Default Namespace</Label>
              <Input
                className="bg-muted/50 font-mono"
                placeholder="openrel"
                value={form.namespace}
                onChange={e => update('namespace', e.target.value)}
              />
            </div>
          </div>

          {form.input_type === 'text' ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">JSON Input</Label>
              <Textarea
                className="bg-muted/50 font-mono text-xs min-h-[200px]"
                placeholder={'{\n  "@context": { "odrl": "http://www.w3.org/ns/odrl/2/" },\n  "@graph": [\n    { "@id": "openrel:use", "@type": "odrl:Action", "skos:prefLabel": "Use" }\n  ]\n}'}
                value={form.json_text}
                onChange={e => update('json_text', e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Input File URL</Label>
              <Input
                className="bg-muted/50 font-mono text-xs"
                placeholder="https://raw.githubusercontent.com/owner/repo/main/data/policies.json"
                value={form.input_file_url}
                onChange={e => update('input_file_url', e.target.value)}
              />
            </div>
          )}

          <div className="border-t border-border/50 pt-4 space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">GitHub Target</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target Folder</Label>
                <Input
                  className="bg-muted/50 font-mono text-xs"
                  placeholder=".openrel/vocabs/openrel"
                  value={form.github_target_folder}
                  onChange={e => update('github_target_folder', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target File</Label>
                <Input
                  className="bg-muted/50 font-mono text-xs"
                  placeholder="policies.ttl"
                  value={form.github_target_file}
                  onChange={e => update('github_target_file', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Input
                className="bg-muted/50 font-mono text-xs"
                placeholder="main"
                value={form.github_branch}
                onChange={e => update('github_branch', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => update('is_active', v)} />
            <Label className="text-sm">Active</Label>
          </div>

          {previewTtl && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">TTL Preview</Label>
              <pre className="bg-muted/50 border border-border/50 rounded-md p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {previewTtl}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing}>
            <Eye className="w-4 h-4 mr-1.5" />
            {previewing ? 'Previewing…' : 'Preview TTL'}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}