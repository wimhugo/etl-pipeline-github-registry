import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function VocabularySourceEditor({ source, onSave, onClose }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'github',
    source_url: '',
    github_repo: '',
    github_path: '',
    github_branch: 'main',
    data_format: 'json',
    json_path_expression: '',
    value_field: 'id',
    label_field: 'label',
    inline_data: '',
    cache_duration_minutes: 60,
    is_active: true,
  });

  useEffect(() => {
    if (source) {
      setFormData({
        ...source,
        github_branch: source.github_branch || 'main',
        data_format: source.data_format || 'json',
        value_field: source.value_field || 'id',
        label_field: source.label_field || 'label',
        cache_duration_minutes: source.cache_duration_minutes || 60,
        is_active: source.is_active !== false,
      });
    }
  }, [source]);

  const handleSubmit = () => {
    // Validation
    if (!formData.name.trim()) {
      toast({ title: 'Validation error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    if (formData.source_type === 'github' && (!formData.github_repo || !formData.github_path)) {
      toast({ title: 'Validation error', description: 'GitHub repo and path are required for GitHub sources', variant: 'destructive' });
      return;
    }

    if (formData.source_type === 'url' && !formData.source_url) {
      toast({ title: 'Validation error', description: 'Source URL is required for URL sources', variant: 'destructive' });
      return;
    }

    if (formData.source_type === 'inline' && !formData.inline_data) {
      toast({ title: 'Validation error', description: 'Inline data is required for inline sources', variant: 'destructive' });
      return;
    }

    onSave(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source ? 'Edit Vocabulary' : 'Add Vocabulary'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Policy Statuses, ODRL Actions"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this vocabulary controls"
              className="h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source_type">Source Type *</Label>
              <Select
                value={formData.source_type}
                onValueChange={(value) => setFormData({ ...formData, source_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="url">External URL</SelectItem>
                  <SelectItem value="inline">Inline Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_format">Data Format *</Label>
              <Select
                value={formData.data_format}
                onValueChange={(value) => setFormData({ ...formData, data_format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="json-ld">JSON-LD</SelectItem>
                  <SelectItem value="yaml">YAML</SelectItem>
                  <SelectItem value="ttl">Turtle (TTL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.source_type === 'github' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="github_repo">GitHub Repository *</Label>
                <Input
                  id="github_repo"
                  value={formData.github_repo}
                  onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                  placeholder="owner/repo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github_path">File Path *</Label>
                  <Input
                    id="github_path"
                    value={formData.github_path}
                    onChange={(e) => setFormData({ ...formData, github_path: e.target.value })}
                    placeholder="path/to/vocab.json"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github_branch">Branch</Label>
                  <Input
                    id="github_branch"
                    value={formData.github_branch}
                    onChange={(e) => setFormData({ ...formData, github_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>
            </>
          )}

          {formData.source_type === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="source_url">Source URL *</Label>
              <Input
                id="source_url"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                placeholder="https://example.com/vocab.json"
              />
            </div>
          )}

          {formData.source_type === 'inline' && (
            <div className="space-y-2">
              <Label htmlFor="inline_data">Inline JSON Data *</Label>
              <Textarea
                id="inline_data"
                value={formData.inline_data}
                onChange={(e) => setFormData({ ...formData, inline_data: e.target.value })}
                placeholder='[{"id": "active", "label": "Active"}, {"id": "draft", "label": "Draft"}]'
                className="h-40 font-mono text-xs"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="json_path_expression">JSON Path Expression</Label>
            <Input
              id="json_path_expression"
              value={formData.json_path_expression}
              onChange={(e) => setFormData({ ...formData, json_path_expression: e.target.value })}
              placeholder="e.g., $.statuses[*] or items (leave empty if data is already an array)"
            />
            <p className="text-xs text-muted-foreground">
              Use dot notation for nested properties, [*] for arrays. Example: $.vocab.items[*]
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value_field">Value Field</Label>
              <Input
                id="value_field"
                value={formData.value_field}
                onChange={(e) => setFormData({ ...formData, value_field: e.target.value })}
                placeholder="id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label_field">Label Field</Label>
              <Input
                id="label_field"
                value={formData.label_field}
                onChange={(e) => setFormData({ ...formData, label_field: e.target.value })}
                placeholder="label"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cache_duration_minutes">Cache Duration (minutes)</Label>
            <Input
              id="cache_duration_minutes"
              type="number"
              value={formData.cache_duration_minutes}
              onChange={(e) => setFormData({ ...formData, cache_duration_minutes: parseInt(e.target.value) || 60 })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            {source ? 'Save Changes' : 'Create Vocabulary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}